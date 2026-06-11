import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import { handleAITTSQueue } from './ai-tts'
import { getMetaDb } from '../db'
import { createTenantShardAccess } from '../db/shard-router'
import { newAITTSClients } from '../ai/tts'
import { logError } from '../lib/log'

type TaskRow = {
	id: string
	userId: string
	status: string
	provider: string
	model: string | null
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

vi.mock('../ai/tts', () => {
	return {
		newAITTSClients: vi.fn()
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
		vi.mocked(newAITTSClients).mockReturnValue({
			simple: {
				generateSpeech: mocks.generateSpeech
			}
		} as unknown as ReturnType<typeof newAITTSClients>)
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
		generateUserId: string
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
				generateUserId: '',
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
				generateUserId: '',
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
				generateUserId: '',
				logErrorCalls: 1,
				logTaskId: 't1',
				logAttemptCount: 3
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		mocks.findFirst.mockResolvedValue(given.task)
		if (given.generateError) {
			mocks.generateSpeech.mockRejectedValue(new Error(given.generateError))
		} else {
			mocks.generateSpeech.mockResolvedValue({ audioBase64: 'a', mimeType: 'audio/wav' })
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
			{ META_DB: {} } as Env
		)

		const written = mocks.updateSet.mock.calls.at(-1)?.[0] as
			| {
					status?: string
					resultJson?: string
					lastErrorMessage?: string
			  }
			| undefined
		const clientUserId = vi.mocked(newAITTSClients).mock.calls[0]?.[1] as string | undefined
		const clientTenantDb = vi.mocked(newAITTSClients).mock.calls[0]?.[2] as unknown
		const generateInput = mocks.generateSpeech.mock.calls[0]?.[0] as
			| { userId?: string; uploadToR2?: boolean }
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
			generateUploadToR2: generateInput?.uploadToR2 ?? false,
			generateUserId: generateInput?.userId ?? '',
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
