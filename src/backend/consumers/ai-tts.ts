import { eq, sql } from 'drizzle-orm'
import { getMetaDb, runRawD1Batch, type D1RawRunQuery } from '../db'
import { aiTtsTask } from '../db/schema.shard'
import { createTenantShardAccess } from '../db/shard-router'
import { createAITTSClients } from '../ai/tts'
import {
	createAIChannelMetricQuery,
	rankAIChannels,
	type AIRankedChannel
} from '../ai/channel-routing'
import { AIError } from '../ai/error'
import { R2Error } from '../r2'
import { logError } from '../lib/log'
import type {
	AITTSLine,
	AITTSResult,
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

	const metricQueries: D1RawRunQuery[] = []
	const attemptCount: number = task.attemptCount + 1
	try {
		if (!task.model) {
			throw new AIError('AI_CHANNEL_CONFIG_INVALID')
		}

		const rankedChannels: AIRankedChannel[] = await rankAIChannels(tenant.db, env, {
			target: {
				taskType: 'tts',
				provider: task.provider as AITTSTask['provider']
			},
			model: task.model,
			excludedChannels: [],
			nowMs: Date.now()
		})
		let lastError: unknown = new AIError('AI_CHANNEL_NOT_FOUND')
		let completed: {
			channel: AIRankedChannel
			audio: AITTSResult
			startedAt: number
			finishedAt: number
		} | undefined

		for (const rankedChannel of rankedChannels) {
			const startedAt: number = Date.now()
			try {
				const client = createAITTSClients(env, task.userId, tenant.db, {
					provider: task.provider as AITTSTask['provider'],
					model: task.model,
					endpoint: rankedChannel.channel.endpoint
				}).simple
				const audio: AITTSResult = task.sourceJson
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
				completed = {
					channel: rankedChannel,
					audio,
					startedAt,
					finishedAt: Date.now()
				}
				break
			} catch (error) {
				lastError = error
				if (!isAITTSChannelFailure(error)) {
					throw error
				}
				logError(error, {
					taskId: task.id,
					userId: task.userId,
					provider: task.provider,
					model: task.model,
					channel: rankedChannel.channel.channel,
					attemptCount,
					maxAttempts: AI_TTS_MAX_ATTEMPTS
				})
				metricQueries.push(
					createAIChannelMetricQuery(tenant.db, {
						channel: rankedChannel.channel.channel,
						model: task.model,
						startedAtMs: startedAt,
						finishedAtMs: Date.now(),
						result: 'error'
					})
				)
			}
		}

		if (!completed) {
			throw lastError
		}

		const now: number = completed.finishedAt
		const taskUpdate = tenant.db.run(sql`
			UPDATE ai_tts_tasks
			SET status = ${'completed'},
				channel = ${completed.channel.channel.channel},
				result_json = ${JSON.stringify({ audio: completed.audio })},
				updated_at = ${now},
				completed_at = ${now}
			WHERE id = ${task.id}
		`)
		const successMetric: D1RawRunQuery = createAIChannelMetricQuery(tenant.db, {
			channel: completed.channel.channel.channel,
			model: task.model,
			startedAtMs: completed.startedAt,
			finishedAtMs: completed.finishedAt,
			result: 'success'
		})
		const statements: [D1RawRunQuery, ...D1RawRunQuery[]] = [
			taskUpdate,
			...metricQueries,
			successMetric
		]
		await runRawD1Batch(tenant.db, statements)

		message.ack()
		return
	} catch (error) {
		const now: number = Date.now()
		const messageText: string = error instanceof Error ? error.message : String(error)
		const nextStatus: AITTSTaskStatus =
			attemptCount >= AI_TTS_MAX_ATTEMPTS ? 'failed' : 'processing'
		if (metricQueries.length === 0) {
			logError(error, {
				taskId: task.id,
				userId: task.userId,
				provider: task.provider,
				model: task.model,
				attemptCount,
				maxAttempts: AI_TTS_MAX_ATTEMPTS,
				status: nextStatus
			})
		}
		const taskUpdate = tenant.db.run(sql`
			UPDATE ai_tts_tasks
			SET status = ${nextStatus},
				channel = NULL,
				attempt_count = ${attemptCount},
				last_error_message = ${messageText},
				updated_at = ${now}
			WHERE id = ${task.id}
		`)
		const statements: [D1RawRunQuery, ...D1RawRunQuery[]] = [taskUpdate, ...metricQueries]
		await runRawD1Batch(tenant.db, statements)

		if (attemptCount >= AI_TTS_MAX_ATTEMPTS) {
			message.ack()
			return
		}

		message.retry({ delaySeconds: retryDelaySeconds(attemptCount) })
	}
}

function isAITTSChannelFailure(error: unknown): boolean {
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
		case 'TTS_SOURCE_NOT_SUPPORTED':
		case 'INVALID_SPEAKER_COUNT':
		case 'UNKNOWN_SPEAKER':
			return false
		default:
			return true
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
