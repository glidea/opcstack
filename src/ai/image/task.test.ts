import { describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import { createAIImageTask, getAIImageTask } from './task'
import type { TenantShardDb } from '../../db'
import type { AISimpleImageClientGenerateInput } from '.'

type InsertedRow = {
	id: string
	userId: string
	status: string
	provider: string
	model?: string
	prompt: string
	numberOfImages?: number
	aspectRatio?: string
	imageSize?: string
	lowCensorship: number
	uploadToR2: number
	r2UploadDir?: string
	r2UploadIsPublic?: number
	referencesJson: string
	resultJson?: string
	attemptCount?: number
	lastErrorMessage?: string
	createdAt: number
	updatedAt: number
	completedAt?: number
}

describe('createAIImageTask', () => {
	type GivenDetail = {
		input: AISimpleImageClientGenerateInput
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: string
		provider: string
		queueTaskId: string
		queueUserId: string
		findFirstCalls: number
		referenceCount: number
		uploadToR2: boolean
		r2UploadIsPublic: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'creates processing task and sends queue message',
			given: 'async image input with r2 reference',
			when: 'creating image task',
			then: 'stores task fields and enqueues task id',
			givenDetail: {
				input: {
					prompt: 'draw',
					numberOfImages: 2,
					aspectRatio: '16:9',
					imageSize: '1K',
					lowCensorship: true,
					uploadToR2: true,
					r2UploadDir: 'generated',
					r2UploadIsPublic: true,
					references: [{ r2: { key: 'private/u1/a.png', variant: 'small' } }]
				}
			},
			whenDetail: {},
			thenExpected: {
				status: 'processing',
				provider: 'openai',
				queueTaskId: 'created',
				queueUserId: 'u1',
				findFirstCalls: 0,
				referenceCount: 1,
				uploadToR2: true,
				r2UploadIsPublic: true
			}
		},
		{
			scenario: 'defaults task R2 upload to private',
			given: 'async image input without isPublic',
			when: 'creating image task',
			then: 'stores private upload flag',
			givenDetail: {
				input: {
					prompt: 'draw',
					uploadToR2: true
				}
			},
			whenDetail: {},
			thenExpected: {
				status: 'processing',
				provider: 'openai',
				queueTaskId: 'created',
				queueUserId: 'u1',
				findFirstCalls: 0,
				referenceCount: 0,
				uploadToR2: true,
				r2UploadIsPublic: false
			}
		}
	]

	runCases(cases, async (given): Promise<ThenExpected> => {
		const rows: InsertedRow[] = []
		const sendMock = vi.fn()
		let findFirstCalls = 0
		const db = createDb(rows, () => {
			findFirstCalls += 1
		})
		const env = {
			Q_IMAGE_GENERATE: {
				send: sendMock
			}
		} as unknown as Env

		const task = await createAIImageTask(env, db, 'openai', 'm1', 'u1', given.input)
		const queueBody = sendMock.mock.calls[0]?.[0] as
			| {
					taskId?: string
					userId?: string
			  }
			| undefined

		return {
			status: task.status,
			provider: task.provider,
			queueTaskId: queueBody?.taskId === task.id ? 'created' : '',
			queueUserId: queueBody?.userId ?? '',
			findFirstCalls,
			referenceCount: task.references.length,
			uploadToR2: task.uploadToR2,
			r2UploadIsPublic: task.r2UploadIsPublic
		}
	})
})

describe('getAIImageTask', () => {
	type GivenDetail = Record<string, never>
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: string
		imageCount: number
		lastErrorMessage: string
		completedAt: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'returns stored task with result details',
			given: 'completed task row',
			when: 'getting image task',
			then: 'maps row fields into task object',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				status: 'completed',
				imageCount: 1,
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
				provider: 'gemini',
				model: 'm1',
				prompt: 'draw',
				lowCensorship: 0,
				uploadToR2: 0,
				r2UploadIsPublic: 1,
				referencesJson: '[]',
				resultJson: JSON.stringify({
					images: [{ imageBase64: 'a', mimeType: 'image/png' }]
				}),
				attemptCount: 1,
				lastErrorMessage: 'retry failed once',
				createdAt: 1,
				updatedAt: 2,
				completedAt: 123
			}
		]
		const task = await getAIImageTask(createDb(rows, () => {}), 't1')

		return {
			status: task?.status ?? '',
			imageCount: task?.result?.images.length ?? 0,
			lastErrorMessage: task?.lastErrorMessage ?? '',
			completedAt: task?.completedAt ?? 0
		}
	})
})

function createDb(rows: InsertedRow[], findFirstMock: () => void): TenantShardDb {
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
			aiImageTask: {
				findFirst: async (): Promise<InsertedRow | undefined> => {
					findFirstMock()
					return rows[0]
				}
			}
		}
	} as unknown as TenantShardDb
}
