import { and, desc, eq, like, ne, or, sql, type SQL } from 'drizzle-orm'
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
import { betaCode, d1Shard, userShard } from '../../db/schema'
import { parseRequest } from '../../lib/request'

type AdminUserRow = {
	id: string
	name: string
	email: string
	emailVerified: boolean
	image: string | null
	affCode: string | null
	registrationUtmSource: string | null
	createdAt: Date
	updatedAt: Date
	betaCode: string | null
	betaUsedAt: number | null
	shardId: string | null
	shardRegion: string | null
	shardDatabaseName: string | null
	shardDatabaseId: string | null
}

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
			image: user.image,
			affCode: user.affCode,
			registrationUtmSource: user.registrationUtmSource,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
			betaCode: betaCode.code,
			betaUsedAt: betaCode.usedAt,
			shardId: userShard.shardId,
			shardRegion: d1Shard.region,
			shardDatabaseName: d1Shard.databaseName,
			shardDatabaseId: d1Shard.databaseId
		})
		.from(user)
		.leftJoin(betaCode, eq(betaCode.usedBy, user.id))
		.leftJoin(userShard, eq(userShard.userId, user.id))
		.leftJoin(d1Shard, eq(d1Shard.id, userShard.shardId))
		.where(where)
		.orderBy(desc(user.createdAt))
		.limit(req.page_size)
		.offset((req.page - 1) * req.page_size)

	const items: ListAdminUsersResponseItem[] = rows.map(toResponseItem)
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

function toResponseItem(row: AdminUserRow): ListAdminUsersResponseItem {
	const betaAccess: ListAdminUsersResponseItem['beta_access'] =
		row.betaCode === null || row.betaUsedAt === null
			? null
			: {
				code: row.betaCode,
				used_at: row.betaUsedAt
			}
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
		image: row.image,
		aff_code: row.affCode,
		registration_utm_source: row.registrationUtmSource,
		created_at: row.createdAt.getTime(),
		updated_at: row.updatedAt.getTime(),
		beta_access: betaAccess,
		shard
	}
}
