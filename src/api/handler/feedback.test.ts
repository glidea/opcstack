import { beforeEach, describe, vi } from 'vitest'
import type { Context } from 'hono'
import type { ApiEnv } from '..'
import { runCases, type TestCase } from '../../testing/bdd'
import {
	listFeedbacksHandler,
	submitFeedbackHandler
} from './feedback'

type MockDb = {
	insert: ReturnType<typeof vi.fn>
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
		metaInsertCalled: boolean
		tenantInsertCalled: boolean
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
				metaInsertCalled: false,
				tenantInsertCalled: false
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
				metaInsertCalled: false,
				tenantInsertCalled: true
			}
		}
	]

	runCases(cases, async (given) => {
		const metaDb = createMockDb()
		const tenantDb = createMockDb()
		tenantDb.insert.mockReturnValue({
			values: async () => {
				return
			}
		})

		const ctx = createJsonContext({
			userId: 'u1',
			metaDb,
			tenantDb,
			body: given.body
		})

		const res = await submitFeedbackHandler(ctx)
		const payload = (await res.json()) as { code?: string }
		return {
			status: res.status,
			code: payload.code ?? '',
			metaInsertCalled: metaDb.insert.mock.calls.length === 1,
			tenantInsertCalled: tenantDb.insert.mock.calls.length === 1
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
				code: 'INVALID_REQUEST'
			}
		},
		{
			scenario: 'reject global feedback list',
			given: 'request is valid',
			when: 'listing feedbacks',
			then: 'returns fanout not implemented',
			givenDetail: {
				body: {}
			},
			whenDetail: {},
			thenExpected: {
				status: 501,
				code: 'FEEDBACK_FANOUT_NOT_IMPLEMENTED'
			}
		}
	]

	runCases(cases, async (given) => {
		const ctx = createJsonContext({
			userId: 'admin',
			metaDb: createMockDb(),
			tenantDb: createMockDb(),
			body: given.body
		})

		const res = await listFeedbacksHandler(ctx)
		const payload = (await res.json()) as { code?: string }
		return {
			status: res.status,
			code: payload.code ?? ''
		}
	})
})

function createMockDb(): MockDb {
	return {
		insert: vi.fn()
	}
}

function createJsonContext(input: {
	userId: string
	metaDb: unknown
	tenantDb: unknown
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
			if (key === 'tenantDb') {
				return input.tenantDb
			}
			return input.metaDb
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
