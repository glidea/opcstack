import { and, eq, inArray, sql } from 'drizzle-orm'
import { getTenantShardDb, type MetaDb, type TenantShardDb } from '.'
import { d1Shard, userShard } from './schema.meta'

export type D1ShardRegion = 'wnam' | 'enam' | 'weur' | 'eeur' | 'apac' | 'oc'

export type WorkerRegionSource = {
	continent?: string
}

const DEFAULT_D1_SHARD_REGION: D1ShardRegion = 'apac'

export type ResolvedUserShard = {
	shardId: string
	bindingName: string
}

export type TenantShardInfo = {
	shardId: string
	bindingName: string
}

export type TenantShardClient = TenantShardInfo & {
	db: TenantShardDb
}

export type TenantShardSession = TenantShardClient & {
	session: D1DatabaseSession
}

export function createTenantShardAccess(metaDb: MetaDb, env: Env): TenantShardAccess {
	return new TenantShardAccess(metaDb, env)
}

export function resolveD1ShardRegion(cf: WorkerRegionSource | undefined): D1ShardRegion {
	const continent = cf?.continent ?? ''
	switch (continent) {
		case 'AS':
			return 'apac'
		case 'EU':
			return 'weur'
		case 'OC':
			return 'oc'
		default:
			return DEFAULT_D1_SHARD_REGION
	}
}

export class TenantShardAccess {
	private readonly metaDb: MetaDb
	private readonly env: Env

	constructor(metaDb: MetaDb, env: Env) {
		this.metaDb = metaDb
		this.env = env
	}

	async resolveUserShard(userId: string, preferredRegion: D1ShardRegion): Promise<ResolvedUserShard> {
		return resolveUserShard(this.metaDb, userId, preferredRegion)
	}

	async openUserDb(
		userId: string,
		preferredRegion: D1ShardRegion = DEFAULT_D1_SHARD_REGION
	): Promise<TenantShardClient> {
		const resolved = await this.resolveUserShard(userId, preferredRegion)
		return this.openDb(resolved)
	}

	openShardSession(
		shard: TenantShardInfo,
		bookmark: D1SessionBookmark | D1SessionConstraint
	): TenantShardSession {
		const d1 = getTenantD1Binding(this.env, shard.bindingName)
		const session = d1.withSession(bookmark)
		return {
			...shard,
			session,
			db: getTenantShardDb(session)
		}
	}

	async listShardDbs(): Promise<TenantShardClient[]> {
		const shards = await this.listShards()
		return shards.map((shard) => this.openDb(shard))
	}

	private async listShards(): Promise<TenantShardInfo[]> {
		const shards = await this.metaDb.query.d1Shard.findMany({
			columns: {
				id: true,
				bindingName: true
			},
			where: inArray(d1Shard.status, ['active', 'draining'])
		})
		return shards.map((shard) => ({
			shardId: shard.id,
			bindingName: shard.bindingName
		}))
	}

	private openDb(shard: TenantShardInfo): TenantShardClient {
		return {
			...shard,
			db: getTenantShardDb(getTenantD1Binding(this.env, shard.bindingName))
		}
	}
}

async function resolveUserShard(
	metaDb: MetaDb,
	userId: string,
	preferredRegion: D1ShardRegion
): Promise<ResolvedUserShard> {
	const existing = await metaDb.query.userShard.findFirst({
		where: eq(userShard.userId, userId)
	})
	if (existing) {
		const shard = await metaDb.query.d1Shard.findFirst({
			where: eq(d1Shard.id, existing.shardId)
		})
		if (!shard) {
			throw new Error('D1_SHARD_NOT_FOUND')
		}
		return {
			shardId: existing.shardId,
			bindingName: shard.bindingName
		}
	}

	const shard =
		(await metaDb.query.d1Shard.findFirst({
			where: and(eq(d1Shard.status, 'active'), eq(d1Shard.region, preferredRegion)),
			orderBy: [d1Shard.assignedCount, d1Shard.id]
		})) ??
		(await metaDb.query.d1Shard.findFirst({
			where: eq(d1Shard.status, 'active'),
			orderBy: [d1Shard.assignedCount, d1Shard.id]
		}))
	if (!shard) {
		throw new Error('NO_ACTIVE_D1_SHARD')
	}

	const result = await metaDb
		.insert(userShard)
		.values({
			userId,
			shardId: shard.id,
			createdAt: Date.now()
		})
		.onConflictDoNothing()
		.run()
	if (readD1Changes(result) === 0) {
		const concurrent = await metaDb.query.userShard.findFirst({
			where: eq(userShard.userId, userId)
		})
		if (!concurrent) {
			throw new Error('D1_USER_SHARD_NOT_FOUND')
		}
		const concurrentShard = await metaDb.query.d1Shard.findFirst({
			where: eq(d1Shard.id, concurrent.shardId)
		})
		if (!concurrentShard) {
			throw new Error('D1_SHARD_NOT_FOUND')
		}
		return {
			shardId: concurrent.shardId,
			bindingName: concurrentShard.bindingName
		}
	}

	await metaDb
		.update(d1Shard)
		.set({
			assignedCount: sql`${d1Shard.assignedCount} + 1`,
			updatedAt: Date.now()
		})
		.where(eq(d1Shard.id, shard.id))

	return {
		shardId: shard.id,
		bindingName: shard.bindingName
	}
}

function getTenantD1Binding(env: Env, bindingName: string): D1Database {
	const d1 = (env as unknown as Record<string, D1Database | undefined>)[bindingName]
	if (!d1) {
		throw new Error('TENANT_D1_BINDING_NOT_FOUND')
	}
	return d1
}

function readD1Changes(result: unknown): number {
	const row = result as { meta?: { changes?: number } }
	return Number(row.meta?.changes ?? 0)
}
