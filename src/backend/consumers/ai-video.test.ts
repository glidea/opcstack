import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { runCases, type TestCase } from '../testing/bdd'
import { handleAIVideoQueue } from './ai-video'
import { getMetaDb } from '../db'
import { createTenantShardAccess } from '../db/shard-router'
import { logError } from '../lib/log'

type TaskRow = {
	id: string
	userId: string
	status: string
	providerType: string
	providerId: string | null
	model: string | null
	prompt: string
	ratio: string | null
	resolution: string | null
	duration: number
	r2UploadDir: string | null
	r2UploadIsPublic: number
	referencesJson: string
	providerTaskId: string | null
	providerStartedAt: number | null
	failedProviderIdsJson: string
	resultJson: string | null
	attemptCount: number
	lastErrorMessage: string | null
	createdAt: number
	updatedAt: number
	completedAt: number | null
}

const mocks = vi.hoisted(() => {
	return {
		createSeedDanceProviderTask: vi.fn(),
		getSeedDanceProviderTask: vi.fn(),
		rankProviders: vi.fn(),
		metricQuery: vi.fn(),
		runRawD1Batch: vi.fn(),
		ack: vi.fn(),
		retry: vi.fn(),
		findFirst: vi.fn(),
		rawQueries: vi.fn(),
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

vi.mock('../ai/video/seedance', () => {
	return {
		createSeedDanceProviderTask: mocks.createSeedDanceProviderTask,
		getSeedDanceProviderTask: mocks.getSeedDanceProviderTask
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

describe('handleAIVideoQueue', () => {
	beforeEach((): void => {
		vi.resetAllMocks()
		vi.stubGlobal('fetch', async (): Promise<Response> => {
			return new Response('video-bytes', {
				headers: {
					'content-type': 'video/mp4'
				}
			})
		})
		vi.mocked(getMetaDb).mockReturnValue({ name: 'meta-db' } as unknown as ReturnType<typeof getMetaDb>)
		vi.mocked(createTenantShardAccess).mockReturnValue({
			openUserDb: vi.fn().mockResolvedValue({
				db: {
					query: {
						aiVideoTask: {
							findFirst: mocks.findFirst
						}
					},
					run: (query: unknown) => {
						const built = new SQLiteSyncDialect().sqlToQuery(query as never)
						const params = built.params as unknown[]
						mocks.rawQueries(built)
						if (built.sql.includes('UPDATE ai_video_tasks')) {
							if (built.sql.includes('SET provider_task_id')) {
								mocks.updateSet({
									providerTaskId: params[0],
									providerId: params[1],
									providerStartedAt: params[2]
								})
							} else {
								mocks.updateSet({
									status: params[0],
									providerId: built.sql.includes('result_json') ? params[1] : undefined,
									resultJson: built.sql.includes('result_json') ? params[2] : undefined,
									lastErrorMessage: built.sql.includes('last_error_message')
										? params[built.sql.includes('failed_provider_ids_json') ? 3 : 2]
										: undefined
								})
							}
						}
						return query
					},
					update: () => ({
						set: (value: unknown) => {
							mocks.updateSet(value)
							return {
								where: vi.fn()
							}
						}
					})
				}
			})
		} as unknown as ReturnType<typeof createTenantShardAccess>)
		mocks.rankProviders.mockResolvedValue([createRankedProvider('seedance-primary')])
		mocks.metricQuery.mockImplementation((_, input: unknown) => ({ input }))
		mocks.runRawD1Batch.mockResolvedValue([])
		mocks.createSeedDanceProviderTask.mockResolvedValue('remote-1')
		mocks.getSeedDanceProviderTask.mockResolvedValue({ status: 'running' })
		mocks.getAIRuntimeConfig.mockResolvedValue(createAIConfig())
	})

	type GivenDetail = {
		task: TaskRow
		providerStatus?: 'running' | 'completed'
		createError?: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		ackCalls: number
		retryCalls: number
		statusWritten: string
		hasResult: boolean
		lastErrorMessage: string
		logErrorCalls: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'new video task submits provider task and retries polling',
			given: 'processing task without provider task id',
			when: 'handling video queue',
			then: 'stores provider task id and retries',
			givenDetail: {
				task: createTask(null),
				providerStatus: 'running'
			},
			whenDetail: {},
			thenExpected: {
				ackCalls: 0,
				retryCalls: 1,
				statusWritten: '',
				hasResult: false,
				lastErrorMessage: '',
				logErrorCalls: 0
			}
		},
		{
			scenario: 'submitted video task completes result and ack',
			given: 'processing task with provider task id',
			when: 'handling video queue',
			then: 'stores completed video result',
			givenDetail: {
				task: createTask('remote-1'),
				providerStatus: 'completed'
			},
			whenDetail: {},
			thenExpected: {
				ackCalls: 1,
				retryCalls: 0,
				statusWritten: 'completed',
				hasResult: true,
				lastErrorMessage: '',
				logErrorCalls: 0
			}
		},
		{
			scenario: 'failed provider submission retries with error state',
			given: 'processing task and provider create fails',
			when: 'handling video queue',
			then: 'stores error and retries',
			givenDetail: {
				task: createTask(null),
				createError: 'provider down'
			},
			whenDetail: {},
			thenExpected: {
				ackCalls: 0,
				retryCalls: 1,
				statusWritten: 'processing',
				hasResult: false,
				lastErrorMessage: 'provider down',
				logErrorCalls: 1
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		mocks.findFirst.mockResolvedValue(given.task)
		if (given.createError) {
			mocks.createSeedDanceProviderTask.mockRejectedValue(new Error(given.createError))
		} else {
			mocks.createSeedDanceProviderTask.mockResolvedValue('remote-1')
		}
		if (given.providerStatus === 'completed') {
			mocks.getSeedDanceProviderTask.mockResolvedValue({
				status: 'completed',
				videoUrl: 'https://provider/video.mp4'
			})
		} else {
			mocks.getSeedDanceProviderTask.mockResolvedValue({
				status: 'running'
			})
		}
		const putMock = vi.fn().mockResolvedValue({
			key: 'private/u1/videos/out.mp4',
			url: 'https://app/api/r2/private/u1/videos/out.mp4'
		})

		await handleAIVideoQueue(
			{
				queue: 'video-generate',
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
			createEnv(putMock)
		)

		const written = mocks.updateSet.mock.calls.at(-1)?.[0] as
			| {
					status?: string
					resultJson?: string
					lastErrorMessage?: string
			  }
			| undefined

		return {
			ackCalls: mocks.ack.mock.calls.length,
			retryCalls: mocks.retry.mock.calls.length,
			statusWritten: written?.status ?? '',
			hasResult: written?.resultJson !== undefined,
			lastErrorMessage: written?.lastErrorMessage ?? '',
			logErrorCalls: vi.mocked(logError).mock.calls.length
		}
	})

	it('routes a new video task and persists its execution provider', async () => {
		const task: TaskRow = createTask(null)
		mocks.findFirst.mockResolvedValue(task)
		mocks.rankProviders.mockResolvedValue([createRankedProvider('seedance-primary')])
		mocks.createSeedDanceProviderTask.mockResolvedValue('remote-1')
		mocks.getSeedDanceProviderTask.mockResolvedValue({ status: 'running' })

		await handleAIVideoQueue(createBatch(task), createEnv())

		expect(mocks.rankProviders).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.anything(),
			expect.objectContaining({ model: 'video-model' })
		)
		expect(mocks.getAIRuntimeConfig).toHaveBeenCalledTimes(1)
		expect(mocks.createSeedDanceProviderTask).toHaveBeenCalledWith(
			expect.anything(),
			'u1',
			'video-model',
			expect.anything(),
			{
				baseURL: 'https://seedance-primary.example/v1',
				apiKey: 'seedance-primary-key'
			}
		)
		expect(mocks.updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				providerId: 'seedance-primary',
				providerStartedAt: expect.any(Number),
				providerTaskId: 'remote-1'
			})
		)
		expect(mocks.retry).toHaveBeenCalledWith({ delaySeconds: 30 })
	})

	it('persists pre-acceptance provider errors with the accepted remote binding', async () => {
		const task: TaskRow = createTask(null)
		mocks.findFirst.mockResolvedValue(task)
		mocks.rankProviders.mockResolvedValue([
			createRankedProvider('seedance-primary'),
			createRankedProvider('seedance-backup')
		])
		mocks.createSeedDanceProviderTask
			.mockRejectedValueOnce(new Error('official unavailable'))
			.mockResolvedValueOnce('remote-2')
		mocks.getSeedDanceProviderTask.mockResolvedValue({ status: 'running' })

		await handleAIVideoQueue(createBatch(task), createEnv())

		expect(mocks.metricQuery).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				providerId: 'seedance-primary',
				result: 'error'
			})
		)
		expect(mocks.runRawD1Batch.mock.calls[0]?.[1]).toHaveLength(2)
		expect(mocks.updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				providerId: 'seedance-backup',
				providerTaskId: 'remote-2'
			})
		)
		expect(mocks.retry).toHaveBeenCalledWith({ delaySeconds: 30 })
	})

	it('polls an existing remote task through its original disabled provider', async () => {
		const task: TaskRow = {
			...createTask('remote-1'),
			providerId: 'seedance-backup',
			providerStartedAt: 1000
		}
		mocks.findFirst.mockResolvedValue(task)
		mocks.getAIRuntimeConfig.mockResolvedValue({
			...createAIConfig(),
			providers: createAIConfig().providers.map((provider) => {
				return provider.id === 'seedance-backup' ? { ...provider, enabled: false } : provider
			})
		})
		mocks.getSeedDanceProviderTask.mockResolvedValue({ status: 'running' })

		await handleAIVideoQueue(createBatch(task), createEnv())

		expect(mocks.rankProviders).not.toHaveBeenCalled()
		expect(mocks.getSeedDanceProviderTask).toHaveBeenCalledWith('remote-1', {
			baseURL: 'https://seedance-backup.example/v1',
			apiKey: 'seedance-backup-key'
		})
		expect(mocks.retry).toHaveBeenCalledWith({ delaySeconds: 30 })
	})

	it('records a completion metric for the original video provider', async () => {
		const task: TaskRow = {
			...createTask('remote-1'),
			providerId: 'seedance-primary',
			providerStartedAt: 1000
		}
		mocks.findFirst.mockResolvedValue(task)
		mocks.getSeedDanceProviderTask.mockResolvedValue({
			status: 'completed',
			videoUrl: 'https://provider/video.mp4'
		})
		const putMock = vi.fn().mockResolvedValue({
			key: 'private/u1/videos/out.mp4',
			url: 'https://app/api/r2/private/u1/videos/out.mp4'
		})

		await handleAIVideoQueue(createBatch(task), createEnv(putMock))

		expect(mocks.metricQuery).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				providerId: 'seedance-primary',
				model: 'video-model',
				result: 'success',
				startedAtMs: 1000
			})
		)
		expect(mocks.runRawD1Batch.mock.calls[0]?.[1]).toHaveLength(2)
		expect(mocks.updateSet).toHaveBeenLastCalledWith(
			expect.objectContaining({ providerId: 'seedance-primary', status: 'completed' })
		)
		expect(mocks.ack).toHaveBeenCalledTimes(1)
	})

	it('clears a failed remote provider and retries with another provider', async () => {
		const firstTask: TaskRow = {
			...createTask('remote-1'),
			providerId: 'seedance-primary',
			providerStartedAt: 1000
		}
		const nextTask: TaskRow = {
			...createTask(null),
			failedProviderIdsJson: JSON.stringify(['seedance-primary'])
		}
		mocks.findFirst.mockResolvedValueOnce(firstTask).mockResolvedValueOnce(nextTask)
		mocks.getSeedDanceProviderTask.mockResolvedValueOnce({
			status: 'failed',
			errorMessage: 'provider rejected task'
		})
		mocks.rankProviders.mockResolvedValue([createRankedProvider('seedance-backup')])
		mocks.createSeedDanceProviderTask.mockResolvedValue('remote-2')
		mocks.getSeedDanceProviderTask.mockResolvedValueOnce({ status: 'running' })

		await handleAIVideoQueue(createBatch(firstTask), createEnv())

		expect(mocks.metricQuery).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				providerId: 'seedance-primary',
				result: 'error',
				startedAtMs: 1000
			})
		)
		expect(mocks.runRawD1Batch.mock.calls[0]?.[1]).toHaveLength(2)
		const failedUpdate = mocks.rawQueries.mock.calls
			.map((call): { sql: string; params: unknown[] } => call[0])
			.find((query): boolean => query.sql.includes('UPDATE ai_video_tasks'))
		expect(failedUpdate?.sql).toContain('provider_id = NULL')
		expect(failedUpdate?.sql).toContain('provider_task_id = NULL')
		expect(failedUpdate?.sql).toContain('provider_started_at = NULL')
		expect(failedUpdate?.params).toContain(JSON.stringify(['seedance-primary']))
		expect(mocks.retry).toHaveBeenCalledWith({ delaySeconds: 10 })

		await handleAIVideoQueue(createBatch(nextTask), createEnv())

		expect(mocks.rankProviders).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.anything(),
			expect.objectContaining({ excludedProviderIds: ['seedance-primary'] })
		)
		expect(mocks.createSeedDanceProviderTask).toHaveBeenCalledWith(
			expect.anything(),
			'u1',
			'video-model',
			expect.anything(),
			expect.objectContaining({ baseURL: 'https://seedance-backup.example/v1' })
		)
	})

	it('keeps the remote binding when polling fails', async () => {
		const task: TaskRow = {
			...createTask('remote-1'),
			providerId: 'seedance-primary',
			providerStartedAt: 1000
		}
		mocks.findFirst.mockResolvedValue(task)
		mocks.getSeedDanceProviderTask.mockRejectedValue(new Error('poll unavailable'))

		await handleAIVideoQueue(createBatch(task), createEnv())

		expect(mocks.metricQuery).not.toHaveBeenCalled()
		expect(mocks.runRawD1Batch).not.toHaveBeenCalled()
		expect(mocks.updateSet).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'processing' }))
		expect(mocks.retry).toHaveBeenCalledWith({ delaySeconds: 10 })
	})

	it('fails the local task when every provider has a terminal failure', async () => {
		const task: TaskRow = {
			...createTask(null),
			failedProviderIdsJson: JSON.stringify([
				'seedance-primary',
				'seedance-backup'
			])
		}
		mocks.findFirst.mockResolvedValue(task)
		mocks.rankProviders.mockResolvedValue([])

		await handleAIVideoQueue(createBatch(task), createEnv())

		expect(mocks.createSeedDanceProviderTask).not.toHaveBeenCalled()
		expect(mocks.updateSet).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'failed' }))
		expect(mocks.ack).toHaveBeenCalledTimes(1)
		expect(mocks.retry).not.toHaveBeenCalled()
	})
})

function createRankedProvider(id: string): {
	provider: {
		id: string
		name: string
		type: 'video_seedance'
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
			type: 'video_seedance',
			models: ['video-model'],
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
		queue: 'video-generate',
		messages: [
			{
				body: { taskId: task.id, userId: task.userId },
				ack: mocks.ack,
				retry: mocks.retry
			}
		]
	} as unknown as MessageBatch<unknown>
}

function createEnv(putMock: ReturnType<typeof vi.fn> = vi.fn()): Env {
	return {
		META_DB: {},
		CONFIG_ENCRYPTION_KEY: 'test-config-key',
		APP_BASE_URL: 'https://app',
		R2: { put: putMock }
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
			createRankedProvider('seedance-primary').provider,
			createRankedProvider('seedance-backup').provider
		],
		version: 1
	}
}

function createTask(providerTaskId: string | null): TaskRow {
	return {
		id: 't1',
		userId: 'u1',
		status: 'processing',
		providerType: 'video_seedance',
		model: 'video-model',
		providerId: providerTaskId ? 'seedance-primary' : null,
		prompt: 'make a video',
		ratio: null,
		resolution: '720p',
		duration: 5,
		r2UploadDir: 'videos',
		r2UploadIsPublic: 0,
		referencesJson: '[]',
		providerTaskId,
		providerStartedAt: providerTaskId ? 1 : null,
		failedProviderIdsJson: '[]',
		resultJson: null,
		attemptCount: 0,
		lastErrorMessage: null,
		createdAt: 1,
		updatedAt: 1,
		completedAt: null
	}
}
