import { CreditsService } from '../credits'
import { getMetaDb } from '../db'
import { createTenantShardAccess } from '../db/shard-router'
import { logInfo } from '../lib/log'

export type ScheduledJobHandler = (
	controller: ScheduledController,
	env: Env,
	ctx: ExecutionContext
) => Promise<void>

export async function handleScheduled(
	controller: ScheduledController,
	env: Env,
	ctx: ExecutionContext
): Promise<void> {
	const handler = scheduledHandlers[controller.cron]
	if (!handler) {
		return
	}

	await handler(controller, env, ctx)
}

export const scheduledHandlers: Record<string, ScheduledJobHandler> = {
	'*/10 * * * *': async (controller, env): Promise<void> => {
		const db = getMetaDb(env.META_DB)
		const nowMs = controller.scheduledTime
		const retentionDays = parseRetentionDays(env.CREDITS_HISTORY_RETENTION_DAYS)
		const shards = await createTenantShardAccess(db, env).listShardDbs()

		for (const shard of shards) {
			const credits = new CreditsService(shard.db)

			const expireResult = await credits.expire({
				nowMs,
				limit: 20
			})
			logInfo('Credits expire job finished', {
				shard_id: shard.shardId,
				processed_entries: expireResult.processedEntries,
				processed_users: expireResult.processedUsers
			})

			const cleanupResult = await credits.cleanupTransactions({
				nowMs,
				retentionDays,
				limit: 100
			})
			logInfo('Credits cleanup job finished', {
				shard_id: shard.shardId,
				deleted_rows: cleanupResult.deletedRows
			})
		}
	}
}

function parseRetentionDays(raw: string | undefined): number {
	const value = Number(raw ?? '90')
	if (!Number.isInteger(value) || value <= 0) {
		return 90
	}
	return value
}
