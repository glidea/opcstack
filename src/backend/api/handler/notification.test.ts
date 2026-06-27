import { beforeEach, describe, vi } from 'vitest'
import type { Context } from 'hono'
import type { ApiEnv } from '..'
import { runCases, type TestCase } from '../../testing/bdd'
import {
	createNotificationHandler,
	listNotificationsHandler,
	readNotificationHandler
} from './notification'
import type { ListNotificationsResponse } from '../../../api-contract/notifications'

type MockDb = {
	insert: ReturnType<typeof vi.fn>
	select: ReturnType<typeof vi.fn>
	query: {
		notification?: {
			findMany: ReturnType<typeof vi.fn>
		}
		notificationRead?: {
			findMany: ReturnType<typeof vi.fn>
		}
	}
}

describe('createNotificationHandler', () => {
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
			scenario: 'reject invalid notification request',
			given: 'title is empty',
			when: 'creating notification',
			then: 'returns invalid request',
			givenDetail: {
				body: { title: '', content: 'content' }
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'INVALID_REQUEST',
				insertCalled: false
			}
		},
		{
			scenario: 'create system notification successfully',
			given: 'title and content are valid',
			when: 'creating notification',
			then: 'stores system notification',
			givenDetail: {
				body: { title: 'Upgrade', content: 'new version' }
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
		const metaDb = createMockMetaDb()
		metaDb.insert.mockReturnValue({
			values: async () => {
				return
			}
		})

		const ctx = createJsonContext({
			userId: 'admin',
			metaDb,
			tenantDb: createMockTenantDb(),
			body: given.body
		})

		const res = await createNotificationHandler(ctx)
		const payload = (await res.json()) as { code?: string }
		return {
			status: res.status,
			code: payload.code ?? '',
			insertCalled: metaDb.insert.mock.calls.length === 1
		}
	})
})

describe('listNotificationsHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		body: unknown
		readRows: Array<{ notificationId: string }>
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		items: ListNotificationsResponse['items']
		total: number
		metaReadQueryCalled: boolean
		tenantReadQueryCalled: boolean
		metaLimit: number
		metaOffset: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'reject invalid notification list request',
			given: 'limit is zero',
			when: 'listing notifications',
			then: 'returns invalid request',
			givenDetail: {
				body: { page_size: 0 },
				readRows: []
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'INVALID_REQUEST',
				items: [],
				total: 0,
				metaReadQueryCalled: false,
				tenantReadQueryCalled: false,
				metaLimit: 0,
				metaOffset: 0
			}
		},
		{
			scenario: 'list notifications with read state',
			given: 'one notification is already read',
			when: 'listing notifications',
			then: 'returns notification rows with read flag',
			givenDetail: {
				body: {},
				readRows: [{ notificationId: 'n1' }]
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				items: [
					{
						id: 'n1',
						type: 'system',
						title: 'Upgrade',
						content: 'new version',
						read: true,
						created_at: 123
					}
				],
				total: 1,
				metaReadQueryCalled: false,
				tenantReadQueryCalled: true,
				metaLimit: 20,
				metaOffset: 0
			}
		},
		{
			scenario: 'filter unread notifications with tenant read state',
			given: 'one notification is read',
			when: 'listing unread notifications',
			then: 'returns no read notifications',
			givenDetail: {
				body: { read: false },
				readRows: [{ notificationId: 'n1' }]
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				items: [],
				total: 0,
				metaReadQueryCalled: false,
				tenantReadQueryCalled: true,
				metaLimit: 0,
				metaOffset: 0
			}
		}
	]

	runCases(cases, async (given) => {
		const metaDb = createMockMetaDb()
		const tenantDb = createMockTenantDb()
		metaDb.query.notification?.findMany.mockResolvedValue([
			{
				id: 'n1',
				type: 'system',
				title: 'Upgrade',
				content: 'new version',
				targetUserId: null,
				createdAt: 123
			}
		])
		tenantDb.query.notificationRead?.findMany.mockResolvedValue(given.readRows)

		const ctx = createJsonContext({
			userId: 'u1',
			metaDb,
			tenantDb,
			body: given.body
		})

		const res = await listNotificationsHandler(ctx)
		const payload = (await res.json()) as { code?: string } & Partial<ListNotificationsResponse>
		const findManyInput = metaDb.query.notification?.findMany.mock.calls[0]?.[0] as
			| { limit?: number; offset?: number }
			| undefined
		return {
			status: res.status,
			code: payload.code ?? '',
			items: payload.items ?? [],
			total: payload.total ?? 0,
			metaReadQueryCalled: Boolean(metaDb.query.notificationRead?.findMany.mock.calls.length),
			tenantReadQueryCalled: Boolean(tenantDb.query.notificationRead?.findMany.mock.calls.length),
			metaLimit: findManyInput?.limit ?? 0,
			metaOffset: findManyInput?.offset ?? 0
		}
	})
})

describe('readNotificationHandler', () => {
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
			scenario: 'reject invalid read request',
			given: 'notification id is empty',
			when: 'marking notification read',
			then: 'returns invalid request',
			givenDetail: {
				body: { id: '' }
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
			scenario: 'mark notification read successfully',
			given: 'notification id is valid',
			when: 'marking notification read',
			then: 'stores read row',
			givenDetail: {
				body: { id: 'n1' }
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
		const metaDb = createMockMetaDb()
		const tenantDb = createMockTenantDb()
		tenantDb.insert.mockReturnValue({
			values: () => ({
				onConflictDoNothing: async () => {
					return
				}
			})
		})

		const ctx = createJsonContext({
			userId: 'u1',
			metaDb,
			tenantDb,
			body: given.body
		})

		const res = await readNotificationHandler(ctx)
		const payload = (await res.json()) as { code?: string }
		return {
			status: res.status,
			code: payload.code ?? '',
			metaInsertCalled: metaDb.insert.mock.calls.length === 1,
			tenantInsertCalled: tenantDb.insert.mock.calls.length === 1
		}
	})
})

function createMockMetaDb(): MockDb {
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
			notification: {
				findMany: vi.fn()
			}
		}
	}
}

function createMockTenantDb(): MockDb {
	return {
		insert: vi.fn(),
		select: vi.fn(),
		query: {
			notificationRead: {
				findMany: vi.fn()
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
