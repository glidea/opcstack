import { CreditsService } from '../credits'
import { getDb } from '../db'

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
		const db = getDb(env.DB)
		const nowMs = controller.scheduledTime
		const retentionDays = parseRetentionDays(env.CREDITS_HISTORY_RETENTION_DAYS)
		const credits = new CreditsService(db)

		await credits.expire({
			nowMs,
			limit: 20
		})
		await credits.cleanupTransactions({
			nowMs,
			retentionDays
		})
	}
}

function parseRetentionDays(raw: string | undefined): number {
	const value = Number(raw ?? '90')
	if (!Number.isInteger(value) || value <= 0) {
		return 90
	}
	return value
}
