import { beforeEach, describe, vi } from 'vitest'
import type { Context } from 'hono'
import type { ApiEnv } from '..'
import { runCases, type TestCase } from '../../testing/bdd'
import {
	listFeedbacksHandler,
	submitFeedbackHandler
} from './feedback'
import { createTenantShardAccess } from '../../db/shard-router'

vi.mock('../../db/shard-router', () => {
	return {
		createTenantShardAccess: vi.fn()
	}
})

type MockDb = {
	insert: ReturnType<typeof vi.fn>
	query?: {
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
		shardRows?: MockFeedbackRow[][]
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		items: ListFeedbackItem[]
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
			scenario: 'list feedbacks from tenant shards',
			given: 'feedbacks exist in multiple shards',
			when: 'listing feedbacks',
			then: 'returns merged feedbacks ordered by created time',
			givenDetail: {
				body: { page: 1, page_size: 2 },
				shardRows: [
					[
						{
							id: 'f1',
							userId: 'u1',
							type: 'bug',
							content: 'old',
							createdAt: 100
						}
					],
					[
						{
							id: 'f2',
							userId: 'u2',
							type: 'idea',
							content: 'new',
							createdAt: 300
						},
						{
							id: 'f3',
							userId: 'u3',
							type: 'bug',
							content: 'middle',
							createdAt: 200
						}
					]
				]
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				items: [
					{
						id: 'f2',
						user_id: 'u2',
						type: 'idea',
						content: 'new',
						created_at: 300
					},
					{
						id: 'f3',
						user_id: 'u3',
						type: 'bug',
						content: 'middle',
						created_at: 200
					}
				],
				total: 3
			}
		},
		{
			scenario: 'filter feedbacks across tenant shards',
			given: 'feedbacks match requested filters',
			when: 'listing feedbacks with filters',
			then: 'returns filtered feedbacks',
			givenDetail: {
				body: {
					user_id: 'u1',
					type: 'bug',
					created_at_start: 100,
					created_at_end: 300
				},
				shardRows: [
					[
						{
							id: 'f1',
							userId: 'u1',
							type: 'bug',
							content: 'matched',
							createdAt: 200
						}
					],
					[]
				]
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
						content: 'matched',
						created_at: 200
					}
				],
				total: 1
			}
		}
	]

	runCases(cases, async (given) => {
		const shardRows: MockFeedbackRow[][] = given.shardRows ?? []
		const shardAccessMock = {
			listShardDbs: async () => {
				return shardRows.map((rows: MockFeedbackRow[]) => {
					return {
						shardId: 'shard',
						bindingName: 'TENANT_DB',
						db: createFeedbackListDb(rows)
					}
				})
			}
		}
		vi.mocked(createTenantShardAccess).mockReturnValue(
			shardAccessMock as unknown as ReturnType<typeof createTenantShardAccess>
		)

		const ctx = createJsonContext({
			userId: 'admin',
			metaDb: createMockDb(),
			tenantDb: createMockDb(),
			body: given.body
		})

		const res = await listFeedbacksHandler(ctx)
		const payload = (await res.json()) as { code?: string; items?: ListFeedbackItem[]; total?: number }
		return {
			status: res.status,
			code: payload.code ?? '',
			items: payload.items ?? [],
			total: payload.total ?? 0
		}
	})
})

type MockFeedbackRow = {
	id: string
	userId: string
	type: string
	content: string
	createdAt: number
}

type ListFeedbackItem = {
	id: string
	user_id: string
	type: string
	content: string
	created_at: number
}

function createMockDb(): MockDb {
	return {
		insert: vi.fn()
	}
}

function createFeedbackListDb(rows: MockFeedbackRow[]): MockDb {
	return {
		insert: vi.fn(),
		query: {
			feedback: {
				findMany: vi.fn().mockResolvedValue(rows)
			}
		}
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
