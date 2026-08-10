import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { runCases, type TestCase } from '../testing/bdd'
import { handleAIImageQueue } from './ai-image'
import { getMetaDb } from '../db'
import { createTenantShardAccess } from '../db/shard-router'
import { createAIImageClients } from '../ai/image'
import { AIError } from '../ai/error'
import { R2Error } from '../r2'
import { logError } from '../lib/log'

type TaskRow = {
	id: string
	userId: string
	status: string
	provider: string
	model: string | null
	prompt: string
	numberOfImages: number | null
	aspectRatio: string | null
	imageSize: string | null
	lowCensorship: number
	uploadToR2: number
	r2UploadDir: string | null
	r2UploadIsPublic: number
	referencesJson: string
	resultJson: string | null
	attemptCount: number
	lastErrorMessage: string | null
	createdAt: number
	updatedAt: number
	completedAt: number | null
}

const mocks = vi.hoisted(() => {
	return {
		generate: vi.fn(),
		rankChannels: vi.fn(),
		metricQuery: vi.fn(),
		runRawD1Batch: vi.fn(),
		ack: vi.fn(),
		retry: vi.fn(),
		findFirst: vi.fn(),
		updateSet: vi.fn(),
		logError: vi.fn()
	}
})

vi.mock('../db', () => {
	return {
		getMetaDb: vi.fn(),
		runRawD1Batch: mocks.runRawD1Batch
	}
})

vi.mock('../db/shard-router', () => {
	return {
		createTenantShardAccess: vi.fn()
	}
})

vi.mock('../ai/image', () => {
	return {
		createAIImageClients: vi.fn()
	}
})

vi.mock('../ai/channel-routing', () => {
	return {
		rankAIChannels: mocks.rankChannels,
		createAIChannelMetricQuery: mocks.metricQuery
	}
})

vi.mock('../lib/log', () => {
	return {
		logError: mocks.logError
	}
})

describe('handleAIImageQueue', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(getMetaDb).mockReturnValue({ name: 'meta-db' } as unknown as ReturnType<typeof getMetaDb>)
		vi.mocked(createTenantShardAccess).mockReturnValue({
			openUserDb: vi.fn().mockResolvedValue({
					db: {
					query: {
						aiImageTask: {
							findFirst: mocks.findFirst
						}
					},
					run: (query: unknown) => {
						const built = new SQLiteSyncDialect().sqlToQuery(query as never)
						const params = built.params as unknown[]
						mocks.updateSet({
							status: params[0],
							channel: built.sql.includes('result_json') ? params[1] : null,
							resultJson: built.sql.includes('result_json') ? params[2] : undefined,
							lastErrorMessage: built.sql.includes('last_error_message') ? params[2] : undefined
						})
						return query
					}
				}
			})
		} as unknown as ReturnType<typeof createTenantShardAccess>)
		vi.mocked(createAIImageClients).mockReturnValue({
			simple: {
				generate: mocks.generate
			}
		} as unknown as ReturnType<typeof createAIImageClients>)
		mocks.rankChannels.mockResolvedValue([createRankedChannel('IMAGE_GEMINI_OFFICIAL')])
		mocks.metricQuery.mockImplementation((_, input: unknown) => ({ input }))
		mocks.runRawD1Batch.mockResolvedValue([])
	})

	type GivenDetail = {
		task: TaskRow
		generateError?: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		ackCalls: number
		retryCalls: number
		retryDelaySeconds: number
		statusWritten: string
		hasResult: boolean
		lastErrorMessage: string
		clientUserId: string
		clientTenantDbPassed: boolean
		generateUserId: string
		generateR2UploadIsPublic: boolean
		logErrorCalls: number
		logTaskId: string
		logAttemptCount: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'completed image task writes result and ack',
			given: 'processing task and generate succeeds',
			when: 'handling image queue',
			then: 'stores completed result',
			givenDetail: {
				task: createTask(0)
			},
			whenDetail: {},
			thenExpected: {
				ackCalls: 1,
				retryCalls: 0,
				retryDelaySeconds: 0,
				statusWritten: 'completed',
				hasResult: true,
				lastErrorMessage: '',
				clientUserId: 'u1',
				clientTenantDbPassed: true,
				generateUserId: '',
				generateR2UploadIsPublic: true,
				logErrorCalls: 0,
				logTaskId: '',
				logAttemptCount: 0
			}
		},
		{
			scenario: 'failed image task retries with backoff',
			given: 'processing task and generate fails before max attempts',
			when: 'handling image queue',
			then: 'stores error and retries with delay',
			givenDetail: {
				task: createTask(0),
				generateError: 'provider down'
			},
			whenDetail: {},
			thenExpected: {
				ackCalls: 0,
				retryCalls: 1,
				retryDelaySeconds: 10,
				statusWritten: 'processing',
				hasResult: false,
				lastErrorMessage: 'provider down',
				clientUserId: 'u1',
				clientTenantDbPassed: true,
				generateUserId: '',
				generateR2UploadIsPublic: true,
				logErrorCalls: 1,
				logTaskId: 't1',
				logAttemptCount: 1
			}
		},
		{
			scenario: 'failed image task reaches max attempts',
			given: 'processing task and final attempt fails',
			when: 'handling image queue',
			then: 'marks failed and ack',
			givenDetail: {
				task: createTask(4),
				generateError: 'provider down'
			},
			whenDetail: {},
			thenExpected: {
				ackCalls: 1,
				retryCalls: 0,
				retryDelaySeconds: 0,
				statusWritten: 'failed',
				hasResult: false,
				lastErrorMessage: 'provider down',
				clientUserId: 'u1',
				clientTenantDbPassed: true,
				generateUserId: '',
				generateR2UploadIsPublic: true,
				logErrorCalls: 1,
				logTaskId: 't1',
				logAttemptCount: 5
			}
		}
	]

	runCases(cases, async (given): Promise<ThenExpected> => {
		mocks.findFirst.mockResolvedValue(given.task)
		if (given.generateError) {
			mocks.generate.mockRejectedValue(new Error(given.generateError))
		} else {
			mocks.generate.mockResolvedValue([{ imageBase64: 'a', mimeType: 'image/png' }])
		}

		await handleAIImageQueue(
			{
				queue: 'image_generate',
				messages: [
					{
						body: {
							taskId: given.task.id,
							userId: given.task.userId
						},
						ack: mocks.ack,
						retry: mocks.retry
					}
				]
			} as unknown as MessageBatch<unknown>,
			{ META_DB: {} } as Env
		)

		const written = mocks.updateSet.mock.calls.at(-1)?.[0] as
			| {
					status?: string
					resultJson?: string
					lastErrorMessage?: string
			  }
			| undefined
		const clientOptions = vi.mocked(createAIImageClients).mock.calls[0]?.[1] as
			| { provider?: string; model?: string }
			| undefined
		const clientUserId = vi.mocked(createAIImageClients).mock.calls[0]?.[1] as string | undefined
		const clientTenantDb = vi.mocked(createAIImageClients).mock.calls[0]?.[2] as unknown
		const generateInput = mocks.generate.mock.calls[0]?.[0] as
			| { userId?: string; r2UploadIsPublic?: boolean }
			| undefined
		const retryOptions = mocks.retry.mock.calls[0]?.[0] as { delaySeconds?: number } | undefined
		const logFields = vi.mocked(logError).mock.calls[0]?.[1] as
			| {
					taskId?: string
					attemptCount?: number
			  }
			| undefined

		return {
			ackCalls: mocks.ack.mock.calls.length,
			retryCalls: mocks.retry.mock.calls.length,
			retryDelaySeconds: retryOptions?.delaySeconds ?? 0,
			statusWritten: written?.status ?? '',
			hasResult: written?.resultJson !== undefined,
			lastErrorMessage: written?.lastErrorMessage ?? '',
			clientUserId: clientUserId ?? '',
			clientTenantDbPassed: clientTenantDb !== undefined,
			generateUserId: generateInput?.userId ?? '',
			generateR2UploadIsPublic: generateInput?.r2UploadIsPublic ?? false,
			logErrorCalls: mocks.logError.mock.calls.length,
			logTaskId: logFields?.taskId ?? '',
			logAttemptCount: logFields?.attemptCount ?? 0
		}
	})

	it('tries ranked channels in order and records one batch for failover', async () => {
		const task: TaskRow = createTask(0)
		mocks.findFirst.mockResolvedValue(task)
		mocks.rankChannels.mockResolvedValue([
			createRankedChannel('IMAGE_GEMINI_OFFICIAL'),
			createRankedChannel('IMAGE_GEMINI_RESELLER_A')
		])
		mocks.generate
			.mockRejectedValueOnce(new Error('official unavailable'))
			.mockResolvedValueOnce([{ imageBase64: 'a', mimeType: 'image/png' }])

		await handleAIImageQueue(createBatch(task), createEnv())

		expect(mocks.generate).toHaveBeenCalledTimes(2)
		expect(vi.mocked(createAIImageClients).mock.calls.map((call) => call[3])).toEqual([
			{
				provider: 'gemini',
				model: 'gemini-model',
				endpoint: {
					baseURL: 'https://IMAGE_GEMINI_OFFICIAL.example/v1',
					apiKey: 'IMAGE_GEMINI_OFFICIAL-key'
				}
			},
			{
				provider: 'gemini',
				model: 'gemini-model',
				endpoint: {
					baseURL: 'https://IMAGE_GEMINI_RESELLER_A.example/v1',
					apiKey: 'IMAGE_GEMINI_RESELLER_A-key'
				}
			}
		])
		expect(mocks.runRawD1Batch).toHaveBeenCalledTimes(1)
		expect(mocks.runRawD1Batch.mock.calls[0]?.[1]).toHaveLength(3)
		expect(mocks.updateSet).toHaveBeenLastCalledWith(
			expect.objectContaining({ channel: 'IMAGE_GEMINI_RESELLER_A', status: 'completed' })
		)
		expect(mocks.metricQuery.mock.calls.map((call) => call[1])).toEqual([
			expect.objectContaining({ channel: 'IMAGE_GEMINI_OFFICIAL', result: 'error' }),
			expect.objectContaining({ channel: 'IMAGE_GEMINI_RESELLER_A', result: 'success' })
		])
		expect(mocks.logError).toHaveBeenCalledWith(
			expect.any(Error),
			expect.objectContaining({ channel: 'IMAGE_GEMINI_OFFICIAL' })
		)
		expect(mocks.ack).toHaveBeenCalledTimes(1)
	})

	it('retries the queue message after every channel fails', async () => {
		const task: TaskRow = createTask(0)
		mocks.findFirst.mockResolvedValue(task)
		mocks.rankChannels.mockResolvedValue([
			createRankedChannel('IMAGE_GEMINI_OFFICIAL'),
			createRankedChannel('IMAGE_GEMINI_RESELLER_A')
		])
		mocks.generate.mockRejectedValue(new Error('provider unavailable'))

		await handleAIImageQueue(createBatch(task), createEnv())

		expect(mocks.generate).toHaveBeenCalledTimes(2)
		expect(mocks.runRawD1Batch).toHaveBeenCalledTimes(1)
		expect(mocks.runRawD1Batch.mock.calls[0]?.[1]).toHaveLength(3)
		expect(mocks.metricQuery.mock.calls.map((call) => call[1])).toEqual([
			expect.objectContaining({ channel: 'IMAGE_GEMINI_OFFICIAL', result: 'error' }),
			expect.objectContaining({ channel: 'IMAGE_GEMINI_RESELLER_A', result: 'error' })
		])
		expect(mocks.retry).toHaveBeenCalledWith({ delaySeconds: 10 })
	})

	it('does not record a metric for a local validation error', async () => {
		const task: TaskRow = createTask(0)
		mocks.findFirst.mockResolvedValue(task)
		mocks.generate.mockRejectedValue(new AIError('AI_IMAGE_R2_UPLOAD_DIR_REQUIRED'))

		await handleAIImageQueue(createBatch(task), createEnv())

		expect(mocks.runRawD1Batch.mock.calls[0]?.[1]).toHaveLength(1)
		expect(mocks.metricQuery).not.toHaveBeenCalled()
		expect(mocks.retry).toHaveBeenCalledWith({ delaySeconds: 10 })
	})

	it('does not record a metric for an R2 error', async () => {
		const task: TaskRow = createTask(0)
		mocks.findFirst.mockResolvedValue(task)
		mocks.generate.mockRejectedValue(new R2Error('R2_NOT_CONFIGURED'))

		await handleAIImageQueue(createBatch(task), createEnv())

		expect(mocks.metricQuery).not.toHaveBeenCalled()
		expect(mocks.retry).toHaveBeenCalledWith({ delaySeconds: 10 })
	})
})

function createRankedChannel(channel: string): {
	channel: {
		channel: string
		target: { taskType: 'image'; provider: 'gemini' }
		models: readonly string[]
		priceMultiplier: number
		endpoint: { baseURL: string; apiKey: string }
	}
	score: number
} {
	return {
		channel: {
			channel,
			target: { taskType: 'image', provider: 'gemini' },
			models: ['gemini-model'],
			priceMultiplier: 1,
			endpoint: {
				baseURL: `https://${channel}.example/v1`,
				apiKey: `${channel}-key`
			}
		},
		score: 100
	}
}

function createBatch(task: TaskRow): MessageBatch<unknown> {
	return {
		queue: 'image-generate',
		messages: [
			{
				body: { taskId: task.id, userId: task.userId },
				ack: mocks.ack,
				retry: mocks.retry
			}
		]
	} as unknown as MessageBatch<unknown>
}

function createEnv(): Env {
	return {
		META_DB: {},
		AI_ROUTING_ERROR_WEIGHT: '1',
		AI_ROUTING_LATENCY_WEIGHT: '0.8',
		AI_ROUTING_PRICE_WEIGHT: '0.2',
		IMAGE_GEMINI_OFFICIAL_BASE_URL: 'https://IMAGE_GEMINI_OFFICIAL.example/v1',
		IMAGE_GEMINI_OFFICIAL_MODELS: 'gemini-model',
		IMAGE_GEMINI_OFFICIAL_PRICE_MULTIPLIER: '1',
		IMAGE_GEMINI_OFFICIAL_API_KEY: 'IMAGE_GEMINI_OFFICIAL-key',
		IMAGE_GEMINI_RESELLER_A_BASE_URL: 'https://IMAGE_GEMINI_RESELLER_A.example/v1',
		IMAGE_GEMINI_RESELLER_A_MODELS: 'gemini-model',
		IMAGE_GEMINI_RESELLER_A_PRICE_MULTIPLIER: '1',
		IMAGE_GEMINI_RESELLER_A_API_KEY: 'IMAGE_GEMINI_RESELLER_A-key'
	} as unknown as Env
}

function createTask(attemptCount: number): TaskRow {
	return {
		id: 't1',
		userId: 'u1',
		status: 'processing',
		provider: 'gemini',
		model: 'gemini-model',
		prompt: 'draw',
		numberOfImages: 1,
		aspectRatio: '1:1',
		imageSize: '1K',
		lowCensorship: 0,
		uploadToR2: 0,
		r2UploadDir: null,
		r2UploadIsPublic: 1,
		referencesJson: '[]',
		resultJson: null,
		attemptCount,
		lastErrorMessage: null,
		createdAt: 1,
		updatedAt: 1,
		completedAt: null
	}
}
