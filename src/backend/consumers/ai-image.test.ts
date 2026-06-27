import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import { handleAIImageQueue } from './ai-image'
import { getMetaDb } from '../db'
import { createTenantShardAccess } from '../db/shard-router'
import { newAIImageClients } from '../ai/image'
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

vi.mock('../ai/image', () => {
	return {
		newAIImageClients: vi.fn()
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
		vi.mocked(newAIImageClients).mockReturnValue({
			simple: {
				generate: mocks.generate
			}
		} as unknown as ReturnType<typeof newAIImageClients>)
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
		const clientOptions = vi.mocked(newAIImageClients).mock.calls[0]?.[1] as
			| { provider?: string; model?: string }
			| undefined
		const clientUserId = vi.mocked(newAIImageClients).mock.calls[0]?.[1] as string | undefined
		const clientTenantDb = vi.mocked(newAIImageClients).mock.calls[0]?.[2] as unknown
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
})

function createTask(attemptCount: number): TaskRow {
	return {
		id: 't1',
		userId: 'u1',
		status: 'processing',
		provider: 'gemini',
		model: null,
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
