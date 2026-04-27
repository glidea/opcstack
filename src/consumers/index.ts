
export type QueueConsumerHandler = (
	batch: MessageBatch<unknown>,
	env: Env,
	ctx: ExecutionContext
) => Promise<void>

// Register queue handlers here by queue name
export async function handleQueue(
	batch: MessageBatch<unknown>,
	env: Env,
	ctx: ExecutionContext
): Promise<void> {
	const handler = queueHandlers[batch.queue]
	if (!handler) {
		return
	}

	await handler(batch, env, ctx)
}

export const queueHandlers: Record<string, QueueConsumerHandler> = {
	// Add your queue handler.
}
