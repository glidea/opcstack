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
	// Add your schedule handler.
}
