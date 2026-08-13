import { eq, sql } from 'drizzle-orm'
import { getMetaDb, runRawD1Batch, type D1RawRunQuery } from '../db'
import { aiImageTask } from '../db/schema.shard'
import { createTenantShardAccess } from '../db/shard-router'
import { createAIImageClients } from '../ai/image'
import {
	createAIProviderMetricQuery,
	rankAIProviders,
	type AIRankedProvider
} from '../ai/provider-routing'
import { AIError } from '../ai/error'
import { R2Error } from '../r2'
import { logError } from '../lib/log'
import type {
	AIImageAspectRatio,
	AIImageReference,
	AIImageResult,
	AIImageSize
} from '../ai/image'
import type { AIImageGenerateQueueMessage } from '../ai/image/task'
import {
	getAIProviderCandidates,
	getAIRuntimeConfig,
	type AIImageProviderType,
	type AIRuntimeConfig
} from '../ai/config'

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

		const providerType: AIImageProviderType = task.providerType as AIImageProviderType
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
		const references = JSON.parse(task.referencesJson) as AIImageReference[]
		let lastError: unknown = new AIError('AI_PROVIDER_NOT_FOUND')
		let completed: {
			provider: AIRankedProvider
			images: AIImageResult[]
			startedAt: number
			finishedAt: number
		} | undefined

		for (const rankedProvider of rankedProviders) {
			const startedAt: number = Date.now()
			try {
				const client = createAIImageClients(env, task.userId, tenant.db, {
					type: providerType,
					model: task.model,
					endpoint: rankedProvider.provider.endpoint
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
				completed = {
					provider: rankedProvider,
					images,
					startedAt,
					finishedAt: Date.now()
				}
				break
			} catch (error) {
				lastError = error
				if (!isAIProviderFailure(error)) {
					throw error
				}
				logError(error, {
					taskId: task.id,
					userId: task.userId,
					providerType: task.providerType,
					model: task.model,
					providerId: rankedProvider.provider.id,
					attemptCount,
					maxAttempts: AI_IMAGE_MAX_ATTEMPTS
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
			UPDATE ai_image_tasks
			SET status = ${'completed'},
				provider_id = ${completed.provider.provider.id},
				result_json = ${JSON.stringify({ images: completed.images })},
				updated_at = ${now},
				completed_at = ${now}
			WHERE id = ${task.id}
		`)
		const successMetric = createAIProviderMetricQuery(tenant.db, {
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
		const now = Date.now()
		const messageText = error instanceof Error ? error.message : String(error)
		const nextStatus = attemptCount >= AI_IMAGE_MAX_ATTEMPTS ? 'failed' : 'processing'
		if (metricQueries.length === 0) {
			logError(error, {
				taskId: task.id,
				userId: task.userId,
				providerType: task.providerType,
				model: task.model,
				attemptCount,
				maxAttempts: AI_IMAGE_MAX_ATTEMPTS,
				status: nextStatus
			})
		}
		const taskUpdate = tenant.db.run(sql`
			UPDATE ai_image_tasks
			SET status = ${nextStatus},
				provider_id = NULL,
				attempt_count = ${attemptCount},
				last_error_message = ${messageText},
				updated_at = ${now}
			WHERE id = ${task.id}
		`)
		const statements: [D1RawRunQuery, ...D1RawRunQuery[]] = [taskUpdate, ...metricQueries]
		await runRawD1Batch(tenant.db, statements)

		if (attemptCount >= AI_IMAGE_MAX_ATTEMPTS) {
			message.ack()
			return
		}

		message.retry({ delaySeconds: retryDelaySeconds(attemptCount) })
	}
}

function isAIProviderFailure(error: unknown): boolean {
	if (error instanceof R2Error) {
		return false
	}
	if (!(error instanceof AIError)) {
		return true
	}

	switch (error.code) {
		case 'AI_IMAGE_REFERENCE_R2_READ_FAILED':
		case 'AI_IMAGE_R2_UPLOAD_DIR_REQUIRED':
		case 'AI_IMAGE_R2_UPLOAD_IS_PUBLIC_REQUIRED':
		case 'ALIYUN_LOW_CENSORSHIP_UNSUPPORTED':
		case 'ALIYUN_QWEN_NUMBER_OF_IMAGES_UNSUPPORTED':
		case 'ALIYUN_UNSUPPORTED_IMAGE_MIME_TYPE':
		case 'ALIYUN_Z_IMAGE_NUMBER_OF_IMAGES_UNSUPPORTED':
		case 'ALIYUN_Z_IMAGE_REFERENCES_UNSUPPORTED':
		case 'UNSUPPORTED_ALIYUN_IMAGE_MODEL':
		case 'UNSUPPORTED_ALIYUN_IMAGE_SIZE':
		case 'UNSUPPORTED_SEEDDREAM_IMAGE_SIZE':
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
