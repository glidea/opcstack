import { eq, sql } from 'drizzle-orm'
import { getMetaDb, runRawD1Batch, type D1RawRunQuery } from '../db'
import { aiTtsTask } from '../db/schema.shard'
import { createTenantShardAccess } from '../db/shard-router'
import { createAITTSClients } from '../ai/tts'
import {
	createAIProviderMetricQuery,
	rankAIProviders,
	type AIRankedProvider
} from '../ai/provider-routing'
import { AIError } from '../ai/error'
import { R2Error } from '../r2'
import { logError } from '../lib/log'
import type {
	AITTSLine,
	AITTSResult,
	AITTSSourceInput,
	AITTSSpeaker,
	AITTSTaskStatus
} from '../ai/tts'
import type { AITTSGenerateQueueMessage } from '../ai/tts/task'
import {
	getAIProviderCandidates,
	getAIRuntimeConfig,
	type AITTSProviderType,
	type AIRuntimeConfig
} from '../ai/config'

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
	const aiConfig: AIRuntimeConfig = await getAIRuntimeConfig(
		metaDb,
		env.CONFIG_ENCRYPTION_KEY
	)

	const metricQueries: D1RawRunQuery[] = []
	const attemptCount: number = task.attemptCount + 1
	try {
		if (!task.model) {
			throw new AIError('AI_PROVIDER_CONFIG_INVALID')
		}

		const providerType: AITTSProviderType = task.providerType as AITTSProviderType
		const rankedProviders: AIRankedProvider[] = await rankAIProviders(
			tenant.db,
			getAIProviderCandidates(aiConfig, providerType, task.model),
			aiConfig.routing,
			{
			model: task.model,
			excludedProviderIds: [],
			nowMs: Date.now()
			}
		)
		let lastError: unknown = new AIError('AI_PROVIDER_NOT_FOUND')
		let completed: {
			provider: AIRankedProvider
			audio: AITTSResult
			startedAt: number
			finishedAt: number
		} | undefined

		for (const rankedProvider of rankedProviders) {
			const startedAt: number = Date.now()
			try {
				const client = createAITTSClients(env, task.userId, tenant.db, {
					type: providerType,
					model: task.model,
					endpoint: rankedProvider.provider.endpoint
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
					provider: rankedProvider,
					audio,
					startedAt,
					finishedAt: Date.now()
				}
				break
			} catch (error) {
				lastError = error
				if (!isAITTSProviderFailure(error)) {
					throw error
				}
				logError(error, {
					taskId: task.id,
					userId: task.userId,
					providerType: task.providerType,
					model: task.model,
					providerId: rankedProvider.provider.id,
					attemptCount,
					maxAttempts: AI_TTS_MAX_ATTEMPTS
				})
				metricQueries.push(
					createAIProviderMetricQuery(tenant.db, {
						providerId: rankedProvider.provider.id,
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
				provider_id = ${completed.provider.provider.id},
				result_json = ${JSON.stringify({ audio: completed.audio })},
				updated_at = ${now},
				completed_at = ${now}
			WHERE id = ${task.id}
		`)
		const successMetric: D1RawRunQuery = createAIProviderMetricQuery(tenant.db, {
			providerId: completed.provider.provider.id,
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
				providerType: task.providerType,
				model: task.model,
				attemptCount,
				maxAttempts: AI_TTS_MAX_ATTEMPTS,
				status: nextStatus
			})
		}
		const taskUpdate = tenant.db.run(sql`
			UPDATE ai_tts_tasks
			SET status = ${nextStatus},
				provider_id = NULL,
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

function isAITTSProviderFailure(error: unknown): boolean {
	if (error instanceof R2Error) {
		return false
	}
	if (!(error instanceof AIError)) {
		return true
	}

	switch (error.code) {
		case 'UNSUPPORTED_AI_PROVIDER':
		case 'AI_PROVIDER_NOT_FOUND':
		case 'AI_PROVIDER_CONFIG_INVALID':
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
