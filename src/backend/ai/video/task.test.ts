import { describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import { createAIVideoTask, getAIVideoTask } from './task'
import type { TenantShardDb } from '../../db'
import type { AIVideoGenerateInput } from '.'

type InsertedRow = {
	id: string
	userId: string
	status: string
	providerType: string
	providerId?: string
	model?: string
	prompt: string
	ratio?: string
	resolution?: string
	duration: number
	r2UploadDir?: string
	r2UploadIsPublic?: number
	referencesJson: string
	providerTaskId?: string
	resultJson?: string
	attemptCount?: number
	lastErrorMessage?: string
	createdAt: number
	updatedAt: number
	completedAt?: number
}

describe('createAIVideoTask', () => {
	type GivenDetail = {
		input: AIVideoGenerateInput
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: string
		providerType: string
		queueTaskId: string
		queueUserId: string
		ratio: string
		referenceCount: number
		r2UploadIsPublic: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'creates processing video task and sends queue message',
			given: 'async video input with r2 references',
			when: 'creating video task',
			then: 'stores task fields and enqueues task id',
			givenDetail: {
				input: {
					prompt: 'make a product video',
					references: [
						{ type: 'image', r2: { key: 'private/u1/a.png' } },
						{ type: 'audio', r2: { key: 'private/u1/a.wav' } }
					],
					ratio: '16:9',
					resolution: '720p',
					duration: 5,
					r2UploadDir: 'videos',
					r2UploadIsPublic: true
				}
			},
			whenDetail: {},
			thenExpected: {
				status: 'processing',
				providerType: 'video_seedance',
				queueTaskId: 'created',
				queueUserId: 'u1',
				ratio: '16:9',
				referenceCount: 2,
				r2UploadIsPublic: true
			}
		},
		{
			scenario: 'defaults task ratio to adaptive behavior',
			given: 'async video input without ratio',
			when: 'creating video task',
			then: 'does not expose adaptive as business enum',
			givenDetail: {
				input: {
					prompt: 'make a video',
					duration: 5
				}
			},
			whenDetail: {},
			thenExpected: {
				status: 'processing',
				providerType: 'video_seedance',
				queueTaskId: 'created',
				queueUserId: 'u1',
				ratio: '',
				referenceCount: 0,
				r2UploadIsPublic: false
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		const rows: InsertedRow[] = []
		const sendMock = vi.fn()
		const db: TenantShardDb = createDb(rows)
		const env = {
			Q_VIDEO_GENERATE: {
				send: sendMock
			}
		} as unknown as Env

		const task = await createAIVideoTask(env, db, 'video_seedance', 'm1', 'u1', given.input)
		const queueBody = sendMock.mock.calls[0]?.[0] as
			| {
					taskId?: string
					userId?: string
			  }
			| undefined

		return {
			status: task.status,
			providerType: task.providerType,
			queueTaskId: queueBody?.taskId === task.id ? 'created' : '',
			queueUserId: queueBody?.userId ?? '',
			ratio: task.ratio ?? '',
			referenceCount: task.references.length,
			r2UploadIsPublic: task.r2UploadIsPublic
		}
	})
})

describe('getAIVideoTask', () => {
	type GivenDetail = Record<string, never>
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: string
		mimeType: string
		lastErrorMessage: string
		completedAt: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'returns stored video task with result details',
			given: 'completed task row',
			when: 'getting video task',
			then: 'maps row fields into task object',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				status: 'completed',
				mimeType: 'video/mp4',
				lastErrorMessage: 'retry failed once',
				completedAt: 123
			}
		}
	]

	runCases(cases, async (): Promise<ThenExpected> => {
		const rows: InsertedRow[] = [
			{
				id: 't1',
				userId: 'u1',
				status: 'completed',
				providerType: 'video_seedance',
				model: 'm1',
				prompt: 'make a video',
				duration: 5,
				r2UploadIsPublic: 1,
				referencesJson: '[]',
				providerTaskId: 'remote-1',
				resultJson: JSON.stringify({
					video: {
						mimeType: 'video/mp4',
						r2: { key: 'private/u1/videos/a.mp4', url: 'https://app/api/r2/private/u1/videos/a.mp4' },
						providerUrl: 'https://provider/video.mp4'
					}
				}),
				attemptCount: 1,
				lastErrorMessage: 'retry failed once',
				createdAt: 1,
				updatedAt: 2,
				completedAt: 123
			}
		]
		const task = await getAIVideoTask(createDb(rows), 't1')

		return {
			status: task?.status ?? '',
			mimeType: task?.result?.video.mimeType ?? '',
			lastErrorMessage: task?.lastErrorMessage ?? '',
			completedAt: task?.completedAt ?? 0
		}
	})
})

function createDb(rows: InsertedRow[]): TenantShardDb {
	return {
		insert: () => ({
			values: async (row: InsertedRow): Promise<void> => {
				rows.push({
					...row,
					attemptCount: 0
				})
			}
		}),
		query: {
			aiVideoTask: {
				findFirst: async (): Promise<InsertedRow | undefined> => {
					return rows[0]
				}
			}
		}
	} as unknown as TenantShardDb
}
