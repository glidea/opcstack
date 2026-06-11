import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import { handleAIVideoQueue } from './ai-video'
import { getMetaDb } from '../db'
import { createTenantShardAccess } from '../db/shard-router'
import { logError } from '../lib/log'

type TaskRow = {
	id: string
	userId: string
	status: string
	provider: string
	model: string | null
	prompt: string
	ratio: string | null
	resolution: string | null
	duration: number
	r2UploadDir: string | null
	r2UploadIsPublic: number
	referencesJson: string
	providerTaskId: string | null
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
		ack: vi.fn(),
		retry: vi.fn(),
		findFirst: vi.fn(),
		updateSet: vi.fn(),
		updateWhere: vi.fn(),
		logError: vi.fn()
	}
})

vi.mock('../db', () => {
	return {
		getMetaDb: vi.fn()
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

vi.mock('../lib/log', () => {
	return {
		logError: mocks.logError
	}
})

describe('handleAIVideoQueue', () => {
	beforeEach((): void => {
		vi.clearAllMocks()
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
					update: () => ({
						set: (value: unknown) => {
							mocks.updateSet(value)
							return {
								where: mocks.updateWhere
							}
						}
					})
				}
			})
		} as unknown as ReturnType<typeof createTenantShardAccess>)
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
			{
				META_DB: {},
				VIDEO_SEEDDANCE_MODEL: 'doubao-seedance-2-0-fast-260128',
				APP_BASE_URL: 'https://app',
				R2: {
					put: putMock
				}
			} as unknown as Env
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
})

function createTask(providerTaskId: string | null): TaskRow {
	return {
		id: 't1',
		userId: 'u1',
		status: 'processing',
		provider: 'seedance',
		model: null,
		prompt: 'make a video',
		ratio: null,
		resolution: '720p',
		duration: 5,
		r2UploadDir: 'videos',
		r2UploadIsPublic: 0,
		referencesJson: '[]',
		providerTaskId,
		resultJson: null,
		attemptCount: 0,
		lastErrorMessage: null,
		createdAt: 1,
		updatedAt: 1,
		completedAt: null
	}
}
