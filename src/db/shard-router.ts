import { eq, sql } from 'drizzle-orm'
import type { AppDb } from '.'
import { d1Shard, userShard } from './schema.meta'

export type ResolvedUserShard = {
	shardId: string
	bindingName: string
}

export async function resolveUserShard(metaDb: AppDb, userId: string): Promise<ResolvedUserShard> {
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

	const shard = await metaDb.query.d1Shard.findFirst({
		where: eq(d1Shard.status, 'active'),
		orderBy: [d1Shard.assignedCount, d1Shard.id]
	})
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

export function getTenantD1(env: Env, bindingName: string): D1Database {
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
