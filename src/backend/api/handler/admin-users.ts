import { and, desc, eq, inArray, like, ne, or, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import type { Context } from 'hono'
import type { ApiEnv } from '..'
import {
	ListAdminUsersApi,
	UpdateAdministratorEmailApi,
	type ListAdminUsersResponse,
	type ListAdminUsersResponseItem,
	type UpdateAdministratorEmailResponse
} from '../../../api-contract/admin-users'
import { user } from '../../db/schema.auth'
import { affReferral, betaCode, d1Shard, userShard } from '../../db/schema'
import { createTenantShardAccess, type TenantShardAccess } from '../../db/shard-router'
import { creditBalance } from '../../db/schema.shard'
import { formatDecimal } from '../../lib/decimal'
import { parseRequest } from '../../lib/request'

type AdminUserRow = {
	id: string
	name: string
	email: string
	emailVerified: boolean
	registrationUtmSource: string | null
	createdAt: Date
	updatedAt: Date
	betaCodeId: string | null
	inviterName: string | null
	inviterEmail: string | null
	shardId: string | null
	shardRegion: string | null
	shardDatabaseName: string | null
	shardDatabaseId: string | null
	shardBindingName: string | null
}

type CreditBalanceRow = {
	userId: string
	balance: number
}

type ShardUsers = {
	bindingName: string
	userIds: string[]
}

const inviterUser = alias(user, 'inviter_user')

export async function listAdminUsersHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, ListAdminUsersApi.request)
	if (!request.success) {
		const error = ListAdminUsersApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}

	const req = request.data
	const db = ctx.get('metaDb')
	const where: SQL | undefined = req.search === undefined
		? undefined
		: or(
			like(user.id, `%${req.search}%`),
			like(user.email, `%${req.search}%`),
			like(user.name, `%${req.search}%`)
		)
	const totalRows: Array<{ total: number }> = await db
		.select({ total: sql<number>`count(*)` })
		.from(user)
		.where(where)
	const rows: AdminUserRow[] = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified,
			registrationUtmSource: user.registrationUtmSource,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
			betaCodeId: betaCode.id,
			inviterName: inviterUser.name,
			inviterEmail: inviterUser.email,
			shardId: userShard.shardId,
			shardRegion: d1Shard.region,
			shardDatabaseName: d1Shard.databaseName,
			shardDatabaseId: d1Shard.databaseId,
			shardBindingName: d1Shard.bindingName
		})
		.from(user)
		.leftJoin(betaCode, eq(betaCode.usedBy, user.id))
		.leftJoin(affReferral, eq(affReferral.inviteeUserId, user.id))
		.leftJoin(inviterUser, eq(inviterUser.id, affReferral.inviterUserId))
		.leftJoin(userShard, eq(userShard.userId, user.id))
		.leftJoin(d1Shard, eq(d1Shard.id, userShard.shardId))
		.where(where)
		.orderBy(desc(user.createdAt))
		.limit(req.page_size)
		.offset((req.page - 1) * req.page_size)

	const userIdsByShard: Map<string, ShardUsers> = new Map<string, ShardUsers>()
	for (const row of rows) {
		if (row.shardId === null || row.shardBindingName === null) {
			continue
		}
		const shard: ShardUsers = userIdsByShard.get(row.shardId) ?? {
			bindingName: row.shardBindingName,
			userIds: []
		}
		shard.userIds.push(row.id)
		userIdsByShard.set(row.shardId, shard)
	}

	const balancesByUserId: Map<string, number> = new Map<string, number>()
	const shardAccess: TenantShardAccess = createTenantShardAccess(db, ctx.env)
	for (const [shardId, shard] of userIdsByShard) {
		const shardDb = shardAccess.openShardSession(
			{ shardId, bindingName: shard.bindingName },
			'first-unconstrained'
		).db
		const balances: CreditBalanceRow[] = await shardDb
			.select({ userId: creditBalance.userId, balance: creditBalance.balance })
			.from(creditBalance)
			.where(inArray(creditBalance.userId, shard.userIds))
		for (const balance of balances) {
			balancesByUserId.set(balance.userId, balance.balance)
		}
	}

	const items: ListAdminUsersResponseItem[] = rows.map((row: AdminUserRow): ListAdminUsersResponseItem => {
		return toResponseItem(row, balancesByUserId.get(row.id) ?? 0)
	})
	return ctx.json({
		items,
		total: Number(totalRows[0]?.total ?? 0)
	} as ListAdminUsersResponse)
}

export async function updateAdministratorEmailHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, UpdateAdministratorEmailApi.request)
	if (!request.success) {
		const error = UpdateAdministratorEmailApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}

	const existing = await ctx.get('metaDb').query.user.findFirst({
		columns: { id: true },
		where: and(eq(user.email, request.data.email), ne(user.id, ctx.get('userId')))
	})
	if (existing) {
		const response = UpdateAdministratorEmailApi.errors.EMAIL_ALREADY_EXISTS()
		return ctx.json(response.body, response.status)
	}

	const rows: Array<{ email: string }> = await ctx
		.get('metaDb')
		.update(user)
		.set({ email: request.data.email, updatedAt: new Date() })
		.where(eq(user.id, ctx.get('userId')))
		.returning({ email: user.email })
	const administrator = rows[0]
	if (!administrator) {
		throw new Error('ADMINISTRATOR_NOT_FOUND')
	}
	return ctx.json({ email: administrator.email } as UpdateAdministratorEmailResponse)
}

function toResponseItem(row: AdminUserRow, balance: number): ListAdminUsersResponseItem {
	const inviter: ListAdminUsersResponseItem['inviter'] =
		row.inviterName === null || row.inviterEmail === null
			? null
			: { name: row.inviterName, email: row.inviterEmail }
	const shard: ListAdminUsersResponseItem['shard'] =
		row.shardId === null ||
		row.shardRegion === null ||
		row.shardDatabaseName === null ||
		row.shardDatabaseId === null
			? null
			: {
				id: row.shardId,
				region: row.shardRegion,
				database_name: row.shardDatabaseName,
				database_id: row.shardDatabaseId
			}

	return {
		id: row.id,
		name: row.name,
		email: row.email,
		email_verified: row.emailVerified,
		registration_utm_source: row.registrationUtmSource,
		created_at: row.createdAt.getTime(),
		updated_at: row.updatedAt.getTime(),
		credit_balance: formatDecimal(balance),
		beta_access: row.betaCodeId !== null,
		inviter,
		shard
	}
}
