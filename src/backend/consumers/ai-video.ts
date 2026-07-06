import { eq } from 'drizzle-orm'
import { getMetaDb } from '../db'
import { aiVideoTask } from '../db/schema.shard'
import { createTenantShardAccess } from '../db/shard-router'
import {
	createSeedDanceProviderTask,
	getSeedDanceProviderTask
} from '../ai/video/seedance'
import { AIError } from '../ai/error'
import { createR2Client } from '../r2'
import { logError } from '../lib/log'
import type { TenantShardDb } from '../db'
import type {
	AIVideoGenerateInput,
	AIVideoProviderTaskResult,
	AIVideoResult,
	AIVideoTaskStatus
} from '../ai/video'
import type { AIVideoGenerateQueueMessage } from '../ai/video/task'
import type { AIVideoTaskRow } from '../db/schema.shard'

const AI_VIDEO_MAX_ATTEMPTS = 3
const AI_VIDEO_POLL_DELAY_SECONDS = 30

export async function handleAIVideoQueue(
	batch: MessageBatch<unknown>,
	env: Env
): Promise<void> {
	for (const message of batch.messages) {
		await handleAIVideoMessage(message as Message<AIVideoGenerateQueueMessage>, env)
	}
}

async function handleAIVideoMessage(
	message: Message<AIVideoGenerateQueueMessage>,
	env: Env
): Promise<void> {
	const body: AIVideoGenerateQueueMessage = message.body
	const metaDb = getMetaDb(env.META_DB)
	const tenant = await createTenantShardAccess(metaDb, env).openUserDb(body.userId)
	const task = await tenant.db.query.aiVideoTask.findFirst({
		where: eq(aiVideoTask.id, body.taskId)
	})
	if (!task || task.status !== 'processing') {
		message.ack()
		return
	}

	try {
		const providerTaskId: string = await ensureProviderTask(env, tenant.db, task)
		const videoUrl: string | undefined = await ensureProviderTaskCompleted(env, task, providerTaskId)
		if (!videoUrl) {
			message.retry({ delaySeconds: AI_VIDEO_POLL_DELAY_SECONDS })
			return
		}

		await completeVideoTask(env, tenant.db, task, videoUrl)
		message.ack()
		return
	} catch (error) {
		const attemptCount: number = task.attemptCount + 1
		const now: number = Date.now()
		const messageText: string = error instanceof Error ? error.message : String(error)
		const nextStatus: AIVideoTaskStatus =
			attemptCount >= AI_VIDEO_MAX_ATTEMPTS ? 'failed' : 'processing'
		logError(error, {
			taskId: task.id,
			userId: task.userId,
			provider: task.provider,
			model: task.model,
			attemptCount,
			maxAttempts: AI_VIDEO_MAX_ATTEMPTS,
			status: nextStatus
		})

		await tenant.db
			.update(aiVideoTask)
			.set({
				status: nextStatus,
				attemptCount,
				lastErrorMessage: messageText,
				updatedAt: now
			})
			.where(eq(aiVideoTask.id, task.id))

		if (attemptCount >= AI_VIDEO_MAX_ATTEMPTS) {
			message.ack()
			return
		}

		message.retry({ delaySeconds: retryDelaySeconds(attemptCount) })
	}
}

async function ensureProviderTask(
	env: Env,
	db: TenantShardDb,
	task: AIVideoTaskRow
): Promise<string> {
	if (task.providerTaskId) {
		return task.providerTaskId
	}

	const input: AIVideoGenerateInput = toGenerateInput(task)
	const model: string = task.model ?? env.VIDEO_SEEDDANCE_MODEL
	const providerTaskId: string = await createProviderTask(env, task, model, input)
	await db
		.update(aiVideoTask)
		.set({
			providerTaskId,
			updatedAt: Date.now()
		})
		.where(eq(aiVideoTask.id, task.id))

	return providerTaskId
}

async function createProviderTask(
	env: Env,
	task: AIVideoTaskRow,
	model: string,
	input: AIVideoGenerateInput
): Promise<string> {
	switch (task.provider) {
		case 'seedance':
			return createSeedDanceProviderTask(env, task.userId, model, input)
		default:
			throw new AIError('UNSUPPORTED_AI_PROVIDER', `Unsupported AI provider: ${task.provider}`)
	}
}

async function ensureProviderTaskCompleted(
	env: Env,
	task: AIVideoTaskRow,
	providerTaskId: string
): Promise<string | undefined> {
	const result: AIVideoProviderTaskResult = await getProviderTask(env, task, providerTaskId)
	switch (result.status) {
		case 'running':
			return undefined
		case 'failed':
			throw new AIError('AI_VIDEO_PROVIDER_TASK_FAILED', result.errorMessage)
		case 'completed':
			return result.videoUrl
	}
}

async function getProviderTask(
	env: Env,
	task: AIVideoTaskRow,
	providerTaskId: string
): Promise<AIVideoProviderTaskResult> {
	switch (task.provider) {
		case 'seedance':
			return getSeedDanceProviderTask(env, providerTaskId)
		default:
			throw new AIError('UNSUPPORTED_AI_PROVIDER', `Unsupported AI provider: ${task.provider}`)
	}
}

async function completeVideoTask(
	env: Env,
	db: TenantShardDb,
	task: AIVideoTaskRow,
	videoUrl: string
): Promise<void> {
	const input: AIVideoGenerateInput = toGenerateInput(task)
	const response: Response = await fetch(videoUrl)
	if (!response.ok || !response.body) {
		throw new AIError('AI_VIDEO_DOWNLOAD_FAILED')
	}

	const r2 = await createR2Client(env, task.userId).put({
		dir: input.r2UploadDir ?? 'videos',
		filename: `${Date.now()}-${crypto.randomUUID()}.mp4`,
		body: response.body,
		contentType: 'video/mp4',
		isPublic: input.r2UploadIsPublic
	})
	const video: AIVideoResult = {
		mimeType: 'video/mp4',
		r2,
		providerUrl: videoUrl
	}
	const now: number = Date.now()
	await db
		.update(aiVideoTask)
		.set({
			status: 'completed',
			resultJson: JSON.stringify({ video }),
			updatedAt: now,
			completedAt: now
		})
		.where(eq(aiVideoTask.id, task.id))
}

function toGenerateInput(task: AIVideoTaskRow): AIVideoGenerateInput {
	return {
		prompt: task.prompt,
		references: JSON.parse(task.referencesJson) as AIVideoGenerateInput['references'],
		ratio: task.ratio === null ? undefined : (task.ratio as AIVideoGenerateInput['ratio']),
		resolution:
			task.resolution === null ? undefined : (task.resolution as AIVideoGenerateInput['resolution']),
		duration: task.duration,
		r2UploadDir: task.r2UploadDir ?? undefined,
		r2UploadIsPublic: task.r2UploadIsPublic === 1
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
