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

	await metaDb.insert(userShard).values({
		userId,
		shardId: shard.id,
		createdAt: Date.now()
	})
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
