import { describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import { createAITTSSourceTask, createAITTSTask, getAITTSTask } from './task'
import type { TenantShardDb } from '../../db'
import type { AITTSSourceInput, AITTSSpeechInput } from '.'

type InsertedRow = {
	id: string
	userId: string
	status: string
	providerType: string
	providerId?: string
	model?: string
	sourceJson?: string
	instruction?: string
	speakersJson: string
	linesJson: string
	uploadToR2: number
	resultJson?: string
	attemptCount?: number
	lastErrorMessage?: string
	createdAt: number
	updatedAt: number
	completedAt?: number
}

describe('createAITTSTask', () => {
	type GivenDetail = {
		input: AITTSSpeechInput
		providerType: 'tts_gemini' | 'tts_seed'
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: string
		providerType: string
		queueTaskId: string
		queueUserId: string
		speakerCount: number
		lineCount: number
		uploadToR2: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'creates processing task and sends queue message',
			given: 'async tts input with two speakers',
			when: 'creating tts task',
			then: 'stores task fields and enqueues task id',
			givenDetail: {
				providerType: 'tts_gemini',
				input: {
					instruction: 'podcast style',
					speakers: [
						{ name: 'Host', voiceName: 'Charon' },
						{ name: 'Guest', voiceName: 'Puck' }
					],
					lines: [
						{ speakerName: 'Host', text: 'Hello' },
						{ speakerName: 'Guest', text: 'World' }
					],
					uploadToR2: true
				}
			},
			whenDetail: {},
			thenExpected: {
				status: 'processing',
				providerType: 'tts_gemini',
				queueTaskId: 'created',
				queueUserId: 'u1',
				speakerCount: 2,
				lineCount: 2,
				uploadToR2: true
			}
		},
		{
			scenario: 'creates seed processing task and sends queue message',
			given: 'async seed input with one speaker',
			when: 'creating tts task',
			then: 'stores seed provider and enqueues task id',
			givenDetail: {
				providerType: 'tts_seed',
				input: {
					speakers: [{ name: 'Host', voiceName: 'zh_female_cancan_mars_bigtts' }],
					lines: [{ speakerName: 'Host', text: 'Hello' }]
				}
			},
			whenDetail: {},
			thenExpected: {
				status: 'processing',
				providerType: 'tts_seed',
				queueTaskId: 'created',
				queueUserId: 'u1',
				speakerCount: 1,
				lineCount: 1,
				uploadToR2: false
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		const rows: InsertedRow[] = []
		const sendMock: ReturnType<typeof vi.fn> = vi.fn()
		const db: TenantShardDb = createDb(rows)
		const env: Env = {
			Q_TTS_GENERATE: {
				send: sendMock
			}
		} as unknown as Env

		const task = await createAITTSTask(env, db, given.providerType, 'm1', 'u1', given.input)
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
			speakerCount: task.speakers.length,
			lineCount: task.lines.length,
			uploadToR2: task.uploadToR2
		}
	})
})

describe('createAITTSSourceTask', () => {
	type GivenDetail = {
		input: AITTSSourceInput
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: string
		providerType: string
		queueTaskId: string
		queueUserId: string
		inputUrl: string
		durationHintSeconds: number
		uploadToR2: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'creates source processing task and sends tts queue message',
			given: 'url source input',
			when: 'creating tts source task',
			then: 'stores source json and enqueues task id',
			givenDetail: {
				input: {
					inputUrl: 'https://example.com/article',
					durationHintSeconds: 300,
					uploadToR2: true
				}
			},
			whenDetail: {},
			thenExpected: {
				status: 'processing',
				providerType: 'tts_seed',
				queueTaskId: 'created',
				queueUserId: 'u1',
				inputUrl: 'https://example.com/article',
				durationHintSeconds: 300,
				uploadToR2: true
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		const rows: InsertedRow[] = []
		const sendMock: ReturnType<typeof vi.fn> = vi.fn()
		const db: TenantShardDb = createDb(rows)
		const env: Env = {
			Q_TTS_GENERATE: {
				send: sendMock
			}
		} as unknown as Env

		const task = await createAITTSSourceTask(env, db, 'tts_seed', 'm1', 'u1', given.input)
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
			inputUrl: task.source?.inputUrl ?? '',
			durationHintSeconds: task.source?.durationHintSeconds ?? 0,
			uploadToR2: task.uploadToR2
		}
	})
})

describe('getAITTSTask', () => {
	type GivenDetail = Record<string, never>
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: string
		audioBase64: string
		lastErrorMessage: string
		completedAt: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'returns stored task with result details',
			given: 'completed task row',
			when: 'getting tts task',
			then: 'maps row fields into task object',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				status: 'completed',
				audioBase64: 'audio',
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
				providerType: 'tts_gemini',
				model: 'm1',
				sourceJson: JSON.stringify({ inputUrl: 'https://example.com/article' }),
				instruction: 'podcast style',
				speakersJson: JSON.stringify([{ name: 'Host', voiceName: 'Charon' }]),
				linesJson: JSON.stringify([{ speakerName: 'Host', text: 'Hello' }]),
				uploadToR2: 1,
				resultJson: JSON.stringify({
					audio: { audioBase64: 'audio', mimeType: 'audio/wav' }
				}),
				attemptCount: 1,
				lastErrorMessage: 'retry failed once',
				createdAt: 1,
				updatedAt: 2,
				completedAt: 123
			}
		]
		const task = await getAITTSTask(createDb(rows), 't1')

		return {
			status: task?.status ?? '',
			audioBase64: task?.result?.audio.audioBase64 ?? '',
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
			aiTtsTask: {
				findFirst: async (): Promise<InsertedRow | undefined> => {
					return rows[0]
				}
			}
		}
	} as unknown as TenantShardDb
}
