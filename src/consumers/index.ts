import { AI_IMAGE_QUEUE_NAME } from '../ai/image/task'
import { AI_TTS_QUEUE_NAME } from '../ai/tts/task'
import { AI_VIDEO_QUEUE_NAME } from '../ai/video/task'
import { handleAIImageQueue } from './ai-image'
import { handleAITTSQueue } from './ai-tts'
import { handleAIVideoQueue } from './ai-video'

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
	[AI_IMAGE_QUEUE_NAME]: handleAIImageQueue,
	[AI_TTS_QUEUE_NAME]: handleAITTSQueue,
	[AI_VIDEO_QUEUE_NAME]: handleAIVideoQueue
}
