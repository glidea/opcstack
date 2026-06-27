import { eq } from 'drizzle-orm'
import { getMetaDb } from '../db'
import { aiImageTask } from '../db/schema.shard'
import { createTenantShardAccess } from '../db/shard-router'
import { newAIImageClients } from '../ai/image'
import { logError } from '../lib/log'
import type {
	AIImageAspectRatio,
	AIImageReference,
	AIImageSize,
	AIImageTask
} from '../ai/image'
import type { AIImageGenerateQueueMessage } from '../ai/image/task'

const AI_IMAGE_MAX_ATTEMPTS = 3

export async function handleAIImageQueue(
	batch: MessageBatch<unknown>,
	env: Env
): Promise<void> {
	for (const message of batch.messages) {
		await handleAIImageMessage(message as Message<AIImageGenerateQueueMessage>, env)
	}
}

async function handleAIImageMessage(
	message: Message<AIImageGenerateQueueMessage>,
	env: Env
): Promise<void> {
	const body = message.body
	const metaDb = getMetaDb(env.META_DB)
	const tenant = await createTenantShardAccess(metaDb, env).openUserDb(body.userId)
	const task = await tenant.db.query.aiImageTask.findFirst({
		where: eq(aiImageTask.id, body.taskId)
	})
	if (!task || task.status !== 'processing') {
		message.ack()
		return
	}

	try {
		const references = JSON.parse(task.referencesJson) as AIImageReference[]
		const client = newAIImageClients(env, task.userId, tenant.db, {
			provider: task.provider as AIImageTask['provider'],
			model: task.model ?? undefined
		}).simple
		const images = await client.generate({
			prompt: task.prompt,
			numberOfImages: task.numberOfImages ?? undefined,
			references,
			aspectRatio: task.aspectRatio as AIImageAspectRatio | undefined,
			imageSize: task.imageSize as AIImageSize | undefined,
			lowCensorship: task.lowCensorship === 1,
			uploadToR2: task.uploadToR2 === 1,
			r2UploadDir: task.r2UploadDir ?? undefined,
			r2UploadIsPublic: task.r2UploadIsPublic === 1
		})
		const now = Date.now()
		await tenant.db
			.update(aiImageTask)
			.set({
				status: 'completed',
				resultJson: JSON.stringify({ images }),
				updatedAt: now,
				completedAt: now
			})
			.where(eq(aiImageTask.id, task.id))

		message.ack()
		return

	} catch (error) {
		const attemptCount = task.attemptCount + 1
		const now = Date.now()
		const messageText = error instanceof Error ? error.message : String(error)
		const nextStatus = attemptCount >= AI_IMAGE_MAX_ATTEMPTS ? 'failed' : 'processing'
		logError(error, {
			taskId: task.id,
			userId: task.userId,
			provider: task.provider,
			model: task.model,
			attemptCount,
			maxAttempts: AI_IMAGE_MAX_ATTEMPTS,
			status: nextStatus
		})
		await tenant.db
			.update(aiImageTask)
			.set({
				status: nextStatus,
				attemptCount,
				lastErrorMessage: messageText,
				updatedAt: now
			})
			.where(eq(aiImageTask.id, task.id))

		if (attemptCount >= AI_IMAGE_MAX_ATTEMPTS) {
			message.ack()
			return
		}

		message.retry({ delaySeconds: retryDelaySeconds(attemptCount) })
	}
}

function retryDelaySeconds(attempts: number): number {
	switch (attempts) {
		case 1:
			return 10
		case 2:
			return 30
		case 3:
			return 90
		case 4:
			return 300
		default:
			return 600
	}
}
