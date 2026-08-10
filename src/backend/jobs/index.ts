import { sql } from 'drizzle-orm'
import { CreditsService } from '../credits'
import { getMetaDb, runRawD1Batch } from '../db'
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
		const metricCutoff: number = nowMs - 24 * 60 * 60 * 1000
		const taskRetentionDays: number = Number(env.AI_TASK_RETENTION_DAYS)
		const taskCutoff: number = nowMs - taskRetentionDays * 24 * 60 * 60 * 1000
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

			const aiCleanupResults: D1Result[] = await runRawD1Batch(shard.db, [
				shard.db.run(sql`
					DELETE FROM ai_channel_metric_buckets
					WHERE bucket_start < ${metricCutoff}
				`),
				shard.db.run(sql`
					DELETE FROM ai_image_tasks
					WHERE status IN ('completed', 'failed')
						AND updated_at < ${taskCutoff}
				`),
				shard.db.run(sql`
					DELETE FROM ai_tts_tasks
					WHERE status IN ('completed', 'failed')
						AND updated_at < ${taskCutoff}
				`),
				shard.db.run(sql`
					DELETE FROM ai_video_tasks
					WHERE status IN ('completed', 'failed')
						AND updated_at < ${taskCutoff}
				`)
			])
			logInfo('AI cleanup job finished', {
				shard_id: shard.shardId,
				deleted_metric_buckets: readDeletedRows(aiCleanupResults[0]),
				deleted_image_tasks: readDeletedRows(aiCleanupResults[1]),
				deleted_tts_tasks: readDeletedRows(aiCleanupResults[2]),
				deleted_video_tasks: readDeletedRows(aiCleanupResults[3])
			})
		}
	}
}

function readDeletedRows(result: D1Result | undefined): number {
	return Number(result?.meta.changes ?? 0)
}

function parseRetentionDays(raw: string | undefined): number {
	const value = Number(raw ?? '90')
	if (!Number.isInteger(value) || value <= 0) {
		return 90
	}
	return value
}
