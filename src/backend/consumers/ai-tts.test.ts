import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { runCases, type TestCase } from '../testing/bdd'
import { handleAITTSQueue } from './ai-tts'
import { getMetaDb } from '../db'
import { createTenantShardAccess } from '../db/shard-router'
import { createAITTSClients } from '../ai/tts'
import { AIError } from '../ai/error'
import { R2Error } from '../r2'
import { logError } from '../lib/log'

type TaskRow = {
	id: string
	userId: string
	status: string
	providerType: string
	providerId: string | null
	model: string | null
	sourceJson: string | null
	instruction: string | null
	speakersJson: string
	linesJson: string
	uploadToR2: number
	resultJson: string | null
	attemptCount: number
	lastErrorMessage: string | null
	createdAt: number
	updatedAt: number
	completedAt: number | null
}

const mocks = vi.hoisted(() => {
	return {
		generateSpeech: vi.fn(),
		generateSpeechFromSource: vi.fn(),
		rankProviders: vi.fn(),
		metricQuery: vi.fn(),
		runRawD1Batch: vi.fn(),
		ack: vi.fn(),
		retry: vi.fn(),
		findFirst: vi.fn(),
		updateSet: vi.fn(),
		logError: vi.fn(),
		getAIRuntimeConfig: vi.fn()
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

vi.mock('../ai/tts', () => {
	return {
		createAITTSClients: vi.fn()
	}
})

vi.mock('../ai/provider-routing', () => {
	return {
		rankAIProviders: mocks.rankProviders,
		createAIProviderMetricQuery: mocks.metricQuery
	}
})

vi.mock('../ai/config', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../ai/config')>()
	return {
		...actual,
		getAIRuntimeConfig: mocks.getAIRuntimeConfig
	}
})

vi.mock('../lib/log', () => {
	return {
		logError: mocks.logError
	}
})

describe('handleAITTSQueue', () => {
	beforeEach((): void => {
		vi.clearAllMocks()
		vi.mocked(getMetaDb).mockReturnValue({ name: 'meta-db' } as unknown as ReturnType<typeof getMetaDb>)
		vi.mocked(createTenantShardAccess).mockReturnValue({
			openUserDb: vi.fn().mockResolvedValue({
				db: {
					query: {
						aiTtsTask: {
							findFirst: mocks.findFirst
						}
					},
					run: (query: unknown) => {
						const built = new SQLiteSyncDialect().sqlToQuery(query as never)
						const params = built.params as unknown[]
						mocks.updateSet({
							status: params[0],
							providerId: built.sql.includes('result_json') ? params[1] : null,
							resultJson: built.sql.includes('result_json') ? params[2] : undefined,
							lastErrorMessage: built.sql.includes('last_error_message') ? params[2] : undefined
						})
						return query
					}
				}
			})
		} as unknown as ReturnType<typeof createTenantShardAccess>)
		vi.mocked(createAITTSClients).mockReturnValue({
			simple: {
				generateSpeech: mocks.generateSpeech,
				generateSpeechFromSource: mocks.generateSpeechFromSource
			}
		} as unknown as ReturnType<typeof createAITTSClients>)
		mocks.rankProviders.mockResolvedValue([createRankedProvider('gemini-primary', 'tts_gemini')])
		mocks.metricQuery.mockImplementation((_, input: unknown) => ({ input }))
		mocks.runRawD1Batch.mockResolvedValue([])
		mocks.getAIRuntimeConfig.mockResolvedValue(createAIConfig())
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
		generateUploadToR2: boolean
		generateSourceInputUrl: string
		generateUserId: string
		clientProvider: string
		logErrorCalls: number
		logTaskId: string
		logAttemptCount: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'completed tts task writes result and ack',
			given: 'processing task and generate succeeds',
			when: 'handling tts queue',
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
				generateUploadToR2: true,
				generateSourceInputUrl: '',
				generateUserId: '',
				clientProvider: 'gemini',
				logErrorCalls: 0,
				logTaskId: '',
				logAttemptCount: 0
			}
		},
		{
			scenario: 'failed tts task retries with backoff',
			given: 'processing task and generate fails before max attempts',
			when: 'handling tts queue',
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
				generateUploadToR2: true,
				generateSourceInputUrl: '',
				generateUserId: '',
				clientProvider: 'gemini',
				logErrorCalls: 1,
				logTaskId: 't1',
				logAttemptCount: 1
			}
		},
		{
			scenario: 'failed tts task reaches max attempts',
			given: 'processing task and final attempt fails',
			when: 'handling tts queue',
			then: 'marks failed and ack',
			givenDetail: {
				task: createTask(2),
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
				generateUploadToR2: true,
				generateSourceInputUrl: '',
				generateUserId: '',
				clientProvider: 'gemini',
				logErrorCalls: 1,
				logTaskId: 't1',
				logAttemptCount: 3
			}
		},
		{
			scenario: 'completed seed task passes provider to client factory',
			given: 'processing seed task and generate succeeds',
			when: 'handling tts queue',
			then: 'uses seed provider from task',
			givenDetail: {
				task: {
					...createTask(0),
					providerType: 'tts_seed',
					speakersJson: JSON.stringify([
						{ name: 'Host', voiceName: 'zh_female_cancan_mars_bigtts' }
					])
				}
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
				generateUploadToR2: true,
				generateSourceInputUrl: '',
				generateUserId: '',
				clientProvider: 'seed',
				logErrorCalls: 0,
				logTaskId: '',
				logAttemptCount: 0
			}
		},
		{
			scenario: 'completed seed source task calls source generator',
			given: 'processing seed source task and generate succeeds',
			when: 'handling tts queue',
			then: 'uses source input from task',
			givenDetail: {
				task: {
					...createTask(0),
					providerType: 'tts_seed',
					sourceJson: JSON.stringify({
						inputUrl: 'https://example.com/article',
						durationHintSeconds: 300
					}),
					speakersJson: JSON.stringify([]),
					linesJson: JSON.stringify([])
				}
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
				generateUploadToR2: true,
				generateSourceInputUrl: 'https://example.com/article',
				generateUserId: '',
				clientProvider: 'seed',
				logErrorCalls: 0,
				logTaskId: '',
				logAttemptCount: 0
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		mocks.findFirst.mockResolvedValue(given.task)
		if (given.generateError) {
			mocks.generateSpeech.mockRejectedValue(new Error(given.generateError))
			mocks.generateSpeechFromSource.mockRejectedValue(new Error(given.generateError))
		} else {
			mocks.generateSpeech.mockResolvedValue({ audioBase64: 'a', mimeType: 'audio/wav' })
			mocks.generateSpeechFromSource.mockResolvedValue({ audioBase64: 'a', mimeType: 'audio/mpeg' })
		}

		await handleAITTSQueue(
			{
				queue: 'tts_generate',
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
			createEnv()
		)

		const written = mocks.updateSet.mock.calls.at(-1)?.[0] as
			| {
					status?: string
					resultJson?: string
					lastErrorMessage?: string
			  }
			| undefined
		const clientUserId = vi.mocked(createAITTSClients).mock.calls[0]?.[1] as string | undefined
		const clientTenantDb = vi.mocked(createAITTSClients).mock.calls[0]?.[2] as unknown
		const clientOptions = vi.mocked(createAITTSClients).mock.calls[0]?.[3] as
			| { provider?: string }
			| undefined
		const generateInput = mocks.generateSpeech.mock.calls[0]?.[0] as
			| { userId?: string; uploadToR2?: boolean }
			| undefined
		const generateSourceInput = mocks.generateSpeechFromSource.mock.calls[0]?.[0] as
			| { inputUrl?: string; uploadToR2?: boolean }
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
			generateUploadToR2: generateInput?.uploadToR2 ?? generateSourceInput?.uploadToR2 ?? false,
			generateSourceInputUrl: generateSourceInput?.inputUrl ?? '',
			generateUserId: generateInput?.userId ?? '',
			clientProvider: clientOptions?.provider ?? '',
			logErrorCalls: mocks.logError.mock.calls.length,
			logTaskId: logFields?.taskId ?? '',
			logAttemptCount: logFields?.attemptCount ?? 0
		}
	})

	it('tries ranked TTS providers in order and records the selected provider', async () => {
		const task: TaskRow = createTask(0)
		mocks.findFirst.mockResolvedValue(task)
		mocks.rankProviders.mockResolvedValue([
			createRankedProvider('gemini-primary', 'tts_gemini'),
			createRankedProvider('gemini-backup', 'tts_gemini')
		])
		mocks.generateSpeech
			.mockRejectedValueOnce(new Error('official unavailable'))
			.mockResolvedValueOnce({ audioBase64: 'a', mimeType: 'audio/wav' })

		await handleAITTSQueue(createBatch(task), createEnv())

		expect(mocks.generateSpeech).toHaveBeenCalledTimes(2)
		expect(mocks.getAIRuntimeConfig).toHaveBeenCalledTimes(1)
		expect(vi.mocked(createAITTSClients).mock.calls.map((call) => call[3])).toEqual([
			{
				provider: 'gemini',
				model: 'gemini-model',
				endpoint: {
					baseURL: 'https://gemini-primary.example/v1',
					apiKey: 'gemini-primary-key'
				}
			},
			{
				provider: 'gemini',
				model: 'gemini-model',
				endpoint: {
					baseURL: 'https://gemini-backup.example/v1',
					apiKey: 'gemini-backup-key'
				}
			}
		])
		expect(mocks.updateSet).toHaveBeenLastCalledWith(
			expect.objectContaining({ providerId: 'gemini-backup', status: 'completed' })
		)
		expect(mocks.metricQuery.mock.calls.map((call) => call[1])).toEqual([
			expect.objectContaining({ providerId: 'gemini-primary', result: 'error' }),
			expect.objectContaining({ providerId: 'gemini-backup', result: 'success' })
		])
		expect(mocks.runRawD1Batch.mock.calls[0]?.[1]).toHaveLength(3)
		expect(mocks.ack).toHaveBeenCalledTimes(1)
	})

	it('routes a source task through the same provider pool', async () => {
		const task: TaskRow = {
			...createTask(0),
			providerType: 'tts_seed',
			model: 'seed-podcast-model',
			sourceJson: JSON.stringify({ inputUrl: 'https://example.com/article' }),
			speakersJson: JSON.stringify([]),
			linesJson: JSON.stringify([])
		}
		mocks.findFirst.mockResolvedValue(task)
		mocks.rankProviders.mockResolvedValue([createRankedProvider('seed-primary', 'tts_seed')])
		mocks.generateSpeechFromSource.mockResolvedValue({ audioBase64: 'a', mimeType: 'audio/mpeg' })

		await handleAITTSQueue(createBatch(task), createEnv())

		expect(mocks.rankProviders).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.anything(),
			expect.objectContaining({ model: 'seed-podcast-model' })
		)
		expect(mocks.generateSpeechFromSource).toHaveBeenCalledWith(
			expect.objectContaining({ inputUrl: 'https://example.com/article', uploadToR2: true })
		)
		expect(mocks.ack).toHaveBeenCalledTimes(1)
	})

	it('retries after every TTS provider fails', async () => {
		const task: TaskRow = createTask(0)
		mocks.findFirst.mockResolvedValue(task)
		mocks.rankProviders.mockResolvedValue([
			createRankedProvider('gemini-primary', 'tts_gemini'),
			createRankedProvider('gemini-backup', 'tts_gemini')
		])
		mocks.generateSpeech.mockRejectedValue(new Error('provider unavailable'))

		await handleAITTSQueue(createBatch(task), createEnv())

		expect(mocks.generateSpeech).toHaveBeenCalledTimes(2)
		expect(mocks.runRawD1Batch.mock.calls[0]?.[1]).toHaveLength(3)
		expect(mocks.retry).toHaveBeenCalledWith({ delaySeconds: 10 })
	})

	it('does not record a metric for a local TTS error', async () => {
		const task: TaskRow = createTask(0)
		mocks.findFirst.mockResolvedValue(task)
		mocks.generateSpeech.mockRejectedValueOnce(new AIError('INVALID_SPEAKER_COUNT'))

		await handleAITTSQueue(createBatch(task), createEnv())

		expect(mocks.metricQuery).not.toHaveBeenCalled()
	})

	it('does not record a metric for an R2 error', async () => {
		const task: TaskRow = createTask(0)
		mocks.findFirst.mockResolvedValue(task)
		mocks.generateSpeech.mockRejectedValueOnce(new R2Error('R2_NOT_CONFIGURED'))

		await handleAITTSQueue(createBatch(task), createEnv())

		expect(mocks.metricQuery).not.toHaveBeenCalled()
	})
})

function createRankedProvider(id: string, type: 'tts_gemini' | 'tts_seed'): {
	provider: {
		id: string
		name: string
		type: 'tts_gemini' | 'tts_seed'
		models: string[]
		priceMultiplier: number
		endpoint: { baseURL: string; apiKey: string }
		enabled: boolean
	}
	score: number
} {
	return {
		provider: {
			id,
			name: id,
			type,
			models: ['gemini-model', 'seed-podcast-model'],
			priceMultiplier: 1,
			endpoint: {
				baseURL: `https://${id}.example/v1`,
				apiKey: `${id}-key`
			},
			enabled: true
		},
		score: 100
	}
}

function createBatch(task: TaskRow): MessageBatch<unknown> {
	return {
		queue: 'tts-generate',
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
		CONFIG_ENCRYPTION_KEY: 'test-config-key'
	} as unknown as Env
}

function createAIConfig(): {
	routing: { errorWeight: number; latencyWeight: number; priceWeight: number }
	taskRetentionDays: number
	providers: Array<ReturnType<typeof createRankedProvider>['provider']>
	version: number
} {
	return {
		routing: { errorWeight: 1, latencyWeight: 0.8, priceWeight: 0.2 },
		taskRetentionDays: 30,
		providers: [
			createRankedProvider('gemini-primary', 'tts_gemini').provider,
			createRankedProvider('seed-primary', 'tts_seed').provider
		],
		version: 1
	}
}

function createTask(attemptCount: number): TaskRow {
	return {
		id: 't1',
		userId: 'u1',
		status: 'processing',
		providerType: 'tts_gemini',
		providerId: null,
		model: 'gemini-model',
		sourceJson: null,
		instruction: 'podcast style',
		speakersJson: JSON.stringify([{ name: 'Host', voiceName: 'Charon' }]),
		linesJson: JSON.stringify([{ speakerName: 'Host', text: 'Hello' }]),
		uploadToR2: 1,
		resultJson: null,
		attemptCount,
		lastErrorMessage: null,
		createdAt: 1,
		updatedAt: 1,
		completedAt: null
	}
}
