import { eq, sql } from 'drizzle-orm'
import { getMetaDb, runRawD1Batch, type D1RawRunQuery, type TenantShardDb } from '../db'
import { aiVideoTask } from '../db/schema.shard'
import { createTenantShardAccess } from '../db/shard-router'
import {
	createAIChannelMetricQuery,
	rankAIChannels,
	resolveAIChannel,
	type AIChannel,
	type AIChannelTarget,
	type AIRankedChannel
} from '../ai/channel-routing'
import { AIError } from '../ai/error'
import type { AIEndpoint } from '../ai/endpoint'
import {
	createSeedDanceProviderTask,
	getSeedDanceProviderTask
} from '../ai/video/seedance'
import { createR2Client, R2Error } from '../r2'
import { logError } from '../lib/log'
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

interface AIVideoExecution {
	providerTaskId: string
	channel: AIChannel
	channelStartedAt: number
}

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

	const metricQueries: D1RawRunQuery[] = []
	try {
		const execution: AIVideoExecution | undefined = await ensureProviderTask(
			env,
			tenant.db,
			task,
			metricQueries
		)
		if (!execution) {
			await failExhaustedTask(tenant.db, task)
			message.ack()
			return
		}

		const result: AIVideoProviderTaskResult = await getProviderTask(
			task,
			execution.providerTaskId,
			execution.channel.endpoint
		)
		switch (result.status) {
			case 'running':
				message.retry({ delaySeconds: AI_VIDEO_POLL_DELAY_SECONDS })
				return
			case 'failed':
				await failProviderTask(tenant.db, task, execution, result.errorMessage)
				if (task.attemptCount + 1 >= AI_VIDEO_MAX_ATTEMPTS) {
					message.ack()
					return
				}
				message.retry({ delaySeconds: retryDelaySeconds(task.attemptCount + 1) })
				return
			case 'completed':
				await completeVideoTask(env, tenant.db, task, execution, result.videoUrl)
				message.ack()
				return
		}
	} catch (error) {
		const attemptCount: number = task.attemptCount + 1
		const now: number = Date.now()
		const messageText: string = error instanceof Error ? error.message : String(error)
		const nextStatus: AIVideoTaskStatus =
			attemptCount >= AI_VIDEO_MAX_ATTEMPTS ? 'failed' : 'processing'
		if (metricQueries.length === 0) {
			logError(error, {
				taskId: task.id,
				userId: task.userId,
				provider: task.provider,
				model: task.model,
				channel: task.channel ?? undefined,
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
		} else {
			const taskUpdate = tenant.db.run(sql`
				UPDATE ai_video_tasks
				SET status = ${nextStatus},
					attempt_count = ${attemptCount},
					last_error_message = ${messageText},
					updated_at = ${now}
				WHERE id = ${task.id}
			`)
			const statements: [D1RawRunQuery, ...D1RawRunQuery[]] = [taskUpdate, ...metricQueries]
			await runRawD1Batch(tenant.db, statements)
		}

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
	task: AIVideoTaskRow,
	metricQueries: D1RawRunQuery[]
): Promise<AIVideoExecution | undefined> {
	if (!task.model) {
		throw new AIError('AI_CHANNEL_CONFIG_INVALID')
	}
	const target: AIChannelTarget = {
		taskType: 'video',
		provider: task.provider as 'seedance'
	}
	if (task.providerTaskId) {
		if (!task.channel || task.channelStartedAt === null) {
			throw new AIError('AI_CHANNEL_CONFIG_INVALID')
		}
		return {
			providerTaskId: task.providerTaskId,
			channel: resolveAIChannel(env, task.channel, target, task.model),
			channelStartedAt: task.channelStartedAt
		}
	}

	const failedChannels: string[] = JSON.parse(task.failedChannelsJson) as string[]
	const rankedChannels: AIRankedChannel[] = await rankAIChannels(db, env, {
		target,
		model: task.model,
		excludedChannels: failedChannels,
		nowMs: Date.now()
	})
	if (rankedChannels.length === 0) {
		return undefined
	}

	const input: AIVideoGenerateInput = toGenerateInput(task)
	let lastError: unknown = new AIError('AI_CHANNEL_NOT_FOUND')
	for (const rankedChannel of rankedChannels) {
		const startedAt: number = Date.now()
		let providerTaskId: string
		try {
			providerTaskId = await createProviderTask(
				env,
				task,
				task.model,
				input,
				rankedChannel.channel.endpoint
			)
		} catch (error) {
			lastError = error
			if (!isAIVideoChannelFailure(error)) {
				throw error
			}
			logError(error, {
				taskId: task.id,
				userId: task.userId,
				provider: task.provider,
				model: task.model,
				channel: rankedChannel.channel.channel,
				attemptCount: task.attemptCount + 1,
				maxAttempts: AI_VIDEO_MAX_ATTEMPTS
			})
			metricQueries.push(
				createAIChannelMetricQuery(db, {
					channel: rankedChannel.channel.channel,
					model: task.model,
					startedAtMs: startedAt,
					finishedAtMs: Date.now(),
					result: 'error'
				})
			)
			continue
		}

		const taskUpdate = db.run(sql`
			UPDATE ai_video_tasks
			SET provider_task_id = ${providerTaskId},
				channel = ${rankedChannel.channel.channel},
				channel_started_at = ${startedAt},
				updated_at = ${Date.now()}
			WHERE id = ${task.id}
		`)
		const statements: [D1RawRunQuery, ...D1RawRunQuery[]] = [taskUpdate, ...metricQueries]
		await runRawD1Batch(db, statements)
		metricQueries.splice(0, metricQueries.length)
		return {
			providerTaskId,
			channel: rankedChannel.channel,
			channelStartedAt: startedAt
		}
	}

	throw lastError
}

async function createProviderTask(
	env: Env,
	task: AIVideoTaskRow,
	model: string,
	input: AIVideoGenerateInput,
	endpoint: AIEndpoint
): Promise<string> {
	switch (task.provider) {
		case 'seedance':
			return createSeedDanceProviderTask(env, task.userId, model, input, endpoint)
		default:
			throw new AIError('UNSUPPORTED_AI_PROVIDER', `Unsupported AI provider: ${task.provider}`)
	}
}

async function getProviderTask(
	task: AIVideoTaskRow,
	providerTaskId: string,
	endpoint: AIEndpoint
): Promise<AIVideoProviderTaskResult> {
	switch (task.provider) {
		case 'seedance':
			return getSeedDanceProviderTask(providerTaskId, endpoint)
		default:
			throw new AIError('UNSUPPORTED_AI_PROVIDER', `Unsupported AI provider: ${task.provider}`)
	}
}

async function failProviderTask(
	db: TenantShardDb,
	task: AIVideoTaskRow,
	execution: AIVideoExecution,
	errorMessage: string
): Promise<void> {
	if (!task.model) {
		throw new AIError('AI_CHANNEL_CONFIG_INVALID')
	}
	const attemptCount: number = task.attemptCount + 1
	const now: number = Date.now()
	const nextStatus: AIVideoTaskStatus =
		attemptCount >= AI_VIDEO_MAX_ATTEMPTS ? 'failed' : 'processing'
	const failedChannels: Set<string> = new Set(JSON.parse(task.failedChannelsJson) as string[])
	failedChannels.add(execution.channel.channel)
	const taskUpdate = db.run(sql`
		UPDATE ai_video_tasks
		SET status = ${nextStatus},
			channel = NULL,
			provider_task_id = NULL,
			channel_started_at = NULL,
			failed_channels_json = ${JSON.stringify([...failedChannels])},
			attempt_count = ${attemptCount},
			last_error_message = ${errorMessage},
			updated_at = ${now}
		WHERE id = ${task.id}
	`)
	const metricQuery: D1RawRunQuery = createAIChannelMetricQuery(db, {
		channel: execution.channel.channel,
		model: task.model,
		startedAtMs: execution.channelStartedAt,
		finishedAtMs: now,
		result: 'error'
	})
	await runRawD1Batch(db, [taskUpdate, metricQuery])
	logError(new AIError('AI_VIDEO_PROVIDER_TASK_FAILED', errorMessage), {
		taskId: task.id,
		userId: task.userId,
		provider: task.provider,
		model: task.model,
		channel: execution.channel.channel,
		attemptCount,
		maxAttempts: AI_VIDEO_MAX_ATTEMPTS,
		status: nextStatus
	})
}

async function failExhaustedTask(db: TenantShardDb, task: AIVideoTaskRow): Promise<void> {
	const now: number = Date.now()
	await db
		.update(aiVideoTask)
		.set({
			status: 'failed',
			lastErrorMessage: new AIError('AI_CHANNEL_NOT_FOUND').message,
			updatedAt: now
		})
		.where(eq(aiVideoTask.id, task.id))
}

async function completeVideoTask(
	env: Env,
	db: TenantShardDb,
	task: AIVideoTaskRow,
	execution: AIVideoExecution,
	videoUrl: string
): Promise<void> {
	if (!task.model) {
		throw new AIError('AI_CHANNEL_CONFIG_INVALID')
	}
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
	const taskUpdate = db.run(sql`
		UPDATE ai_video_tasks
		SET status = ${'completed'},
			channel = ${execution.channel.channel},
			result_json = ${JSON.stringify({ video })},
			updated_at = ${now},
			completed_at = ${now}
		WHERE id = ${task.id}
	`)
	const metricQuery: D1RawRunQuery = createAIChannelMetricQuery(db, {
		channel: execution.channel.channel,
		model: task.model,
		startedAtMs: execution.channelStartedAt,
		finishedAtMs: now,
		result: 'success'
	})
	await runRawD1Batch(db, [taskUpdate, metricQuery])
}

function isAIVideoChannelFailure(error: unknown): boolean {
	if (error instanceof R2Error) {
		return false
	}
	if (!(error instanceof AIError)) {
		return true
	}

	switch (error.code) {
		case 'UNSUPPORTED_AI_PROVIDER':
		case 'AI_CHANNEL_NOT_FOUND':
		case 'AI_CHANNEL_CONFIG_INVALID':
		case 'AI_VIDEO_DOWNLOAD_FAILED':
			return false
		default:
			return true
	}
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
