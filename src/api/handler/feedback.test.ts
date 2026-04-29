import { beforeEach, describe, vi } from 'vitest'
import type { Context } from 'hono'
import type { ApiEnv } from '..'
import { runCases, type TestCase } from '../../testing/bdd'
import {
	listFeedbacksHandler,
	submitFeedbackHandler,
	type ListFeedbacksResponse
} from './feedback'

type MockDb = {
	insert: ReturnType<typeof vi.fn>
	select: ReturnType<typeof vi.fn>
	query: {
		feedback: {
			findMany: ReturnType<typeof vi.fn>
		}
	}
}

describe('submitFeedbackHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		body: unknown
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		insertCalled: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'reject invalid feedback request',
			given: 'content is empty',
			when: 'submitting feedback',
			then: 'returns invalid request',
			givenDetail: {
				body: { type: 'bug', content: '' }
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'INVALID_REQUEST',
				insertCalled: false
			}
		},
		{
			scenario: 'create feedback successfully',
			given: 'type and content are valid',
			when: 'submitting feedback',
			then: 'stores feedback for current user',
			givenDetail: {
				body: { type: 'feature', content: 'please add export' }
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				insertCalled: true
			}
		}
	]

	runCases(cases, async (given) => {
		const db = createMockDb()
		db.insert.mockReturnValue({
			values: async () => {
				return
			}
		})

		const ctx = createJsonContext({
			userId: 'u1',
			db,
			body: given.body
		})

		const res = await submitFeedbackHandler(ctx)
		const payload = (await res.json()) as { code?: string }
		return {
			status: res.status,
			code: payload.code ?? '',
			insertCalled: db.insert.mock.calls.length === 1
		}
	})
})

describe('listFeedbacksHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		body: unknown
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		items: ListFeedbacksResponse['items']
		total: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'reject invalid list request',
			given: 'limit is zero',
			when: 'listing feedbacks',
			then: 'returns invalid request',
			givenDetail: {
				body: { page_size: 0 }
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'INVALID_REQUEST',
				items: [],
				total: 0
			}
		},
		{
			scenario: 'list feedback rows successfully',
			given: 'one feedback row exists',
			when: 'listing feedbacks',
			then: 'returns snake case fields',
			givenDetail: {
				body: {}
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				items: [
					{
						id: 'f1',
						user_id: 'u1',
						type: 'bug',
						content: 'broken',
						created_at: 123
					}
				],
				total: 1
			}
		}
	]

	runCases(cases, async (given) => {
		const db = createMockDb()
		db.query.feedback.findMany.mockResolvedValue([
			{
				id: 'f1',
				userId: 'u1',
				type: 'bug',
				content: 'broken',
				createdAt: 123
			}
		])

		const ctx = createJsonContext({
			userId: 'admin',
			db,
			body: given.body
		})

		const res = await listFeedbacksHandler(ctx)
		const payload = (await res.json()) as { code?: string } & Partial<ListFeedbacksResponse>
		return {
			status: res.status,
			code: payload.code ?? '',
			items: payload.items ?? [],
			total: payload.total ?? 0
		}
	})
})

function createMockDb(): MockDb {
	return {
		insert: vi.fn(),
		select: vi.fn(() => {
			return {
				from: () => {
					return {
						where: async () => {
							return [{ total: 1 }]
						}
					}
				}
			}
		}),
		query: {
			feedback: {
				findMany: vi.fn()
			}
		}
	}
}

function createJsonContext(input: {
	userId: string
	db: unknown
	body: unknown
}): Context<ApiEnv> {
	const req = {
		json: async <U>(): Promise<U> => {
			if (input.body === null) {
				throw new Error('invalid json')
			}
			return input.body as U
		}
	}

	const ctx = {
		req,
		get: (key: string): unknown => {
			if (key === 'userId') {
				return input.userId
			}
			return input.db
		},
		json: (payload: unknown, status?: number): Response => {
			return new Response(JSON.stringify(payload), {
				status: status ?? 200,
				headers: {
					'content-type': 'application/json'
				}
			})
		}
	}

	return ctx as unknown as Context<ApiEnv>
}
