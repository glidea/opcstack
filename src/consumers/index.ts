import { AI_IMAGE_QUEUE_NAME } from '../ai/image/task'
import { handleAIImageQueue } from './ai-image'

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
	[AI_IMAGE_QUEUE_NAME]: handleAIImageQueue
}
