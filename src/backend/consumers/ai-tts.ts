import { eq } from 'drizzle-orm'
import { getMetaDb } from '../db'
import { aiTtsTask } from '../db/schema.shard'
import { createTenantShardAccess } from '../db/shard-router'
import { newAITTSClients } from '../ai/tts'
import { logError } from '../lib/log'
import type {
	AITTSLine,
	AITTSSourceInput,
	AITTSSpeaker,
	AITTSTask,
	AITTSTaskStatus
} from '../ai/tts'
import type { AITTSGenerateQueueMessage } from '../ai/tts/task'

const AI_TTS_MAX_ATTEMPTS = 3

export async function handleAITTSQueue(
	batch: MessageBatch<unknown>,
	env: Env
): Promise<void> {
	for (const message of batch.messages) {
		await handleAITTSMessage(message as Message<AITTSGenerateQueueMessage>, env)
	}
}

async function handleAITTSMessage(
	message: Message<AITTSGenerateQueueMessage>,
	env: Env
): Promise<void> {
	const body: AITTSGenerateQueueMessage = message.body
	const metaDb = getMetaDb(env.META_DB)
	const tenant = await createTenantShardAccess(metaDb, env).openUserDb(body.userId)
	const task = await tenant.db.query.aiTtsTask.findFirst({
		where: eq(aiTtsTask.id, body.taskId)
	})
	if (!task || task.status !== 'processing') {
		message.ack()
		return
	}

	try {
		const client = newAITTSClients(env, task.userId, tenant.db, {
			provider: task.provider as AITTSTask['provider'],
			model: task.model ?? undefined
		}).simple
		const audio = task.sourceJson
			? await client.generateSpeechFromSource({
					...(JSON.parse(task.sourceJson) as AITTSSourceInput),
					uploadToR2: task.uploadToR2 === 1
				})
			: await client.generateSpeech({
					instruction: task.instruction ?? undefined,
					speakers: JSON.parse(task.speakersJson) as AITTSSpeaker[],
					lines: JSON.parse(task.linesJson) as AITTSLine[],
					uploadToR2: task.uploadToR2 === 1
				})
		const now: number = Date.now()
		await tenant.db
			.update(aiTtsTask)
			.set({
				status: 'completed',
				resultJson: JSON.stringify({ audio }),
				updatedAt: now,
				completedAt: now
			})
			.where(eq(aiTtsTask.id, task.id))

		message.ack()
		return
	} catch (error) {
		const attemptCount: number = task.attemptCount + 1
		const now: number = Date.now()
		const messageText: string = error instanceof Error ? error.message : String(error)
		const nextStatus: AITTSTaskStatus =
			attemptCount >= AI_TTS_MAX_ATTEMPTS ? 'failed' : 'processing'
		logError(error, {
			taskId: task.id,
			userId: task.userId,
			provider: task.provider,
			model: task.model,
			attemptCount,
			maxAttempts: AI_TTS_MAX_ATTEMPTS,
			status: nextStatus
		})
		await tenant.db
			.update(aiTtsTask)
			.set({
				status: nextStatus,
				attemptCount,
				lastErrorMessage: messageText,
				updatedAt: now
			})
			.where(eq(aiTtsTask.id, task.id))

		if (attemptCount >= AI_TTS_MAX_ATTEMPTS) {
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
