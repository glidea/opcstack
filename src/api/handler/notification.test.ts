import { beforeEach, describe, vi } from 'vitest'
import type { Context } from 'hono'
import type { ApiEnv } from '..'
import { runCases, type TestCase } from '../../testing/bdd'
import {
	createNotificationHandler,
	listNotificationsHandler,
	readNotificationHandler,
	type ListNotificationsResponse
} from './notification'

type MockDb = {
	insert: ReturnType<typeof vi.fn>
	query: {
		notification: {
			findMany: ReturnType<typeof vi.fn>
		}
		notificationRead: {
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
		const db = createMockDb()
		db.insert.mockReturnValue({
			values: async () => {
				return
			}
		})

		const ctx = createJsonContext({
			userId: 'admin',
			db,
			body: given.body
		})

		const res = await createNotificationHandler(ctx)
		const payload = (await res.json()) as { code?: string }
		return {
			status: res.status,
			code: payload.code ?? '',
			insertCalled: db.insert.mock.calls.length === 1
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
		notifications: ListNotificationsResponse['notifications']
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'reject invalid notification list request',
			given: 'limit is zero',
			when: 'listing notifications',
			then: 'returns invalid request',
			givenDetail: {
				body: { limit: 0 },
				readRows: []
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'INVALID_REQUEST',
				notifications: []
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
				notifications: [
					{
						id: 'n1',
						type: 'system',
						title: 'Upgrade',
						content: 'new version',
						read: true,
						created_at: 123
					}
				]
			}
		}
	]

	runCases(cases, async (given) => {
		const db = createMockDb()
		db.query.notification.findMany.mockResolvedValue([
			{
				id: 'n1',
				type: 'system',
				title: 'Upgrade',
				content: 'new version',
				targetUserId: null,
				createdAt: 123
			}
		])
		db.query.notificationRead.findMany.mockResolvedValue(given.readRows)

		const ctx = createJsonContext({
			userId: 'u1',
			db,
			body: given.body
		})

		const res = await listNotificationsHandler(ctx)
		const payload = (await res.json()) as { code?: string } & ListNotificationsResponse
		return {
			status: res.status,
			code: payload.code ?? '',
			notifications: payload.notifications ?? []
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
		insertCalled: boolean
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
				insertCalled: false
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
				insertCalled: true
			}
		}
	]

	runCases(cases, async (given) => {
		const db = createMockDb()
		db.insert.mockReturnValue({
			values: () => ({
				onConflictDoNothing: async () => {
					return
				}
			})
		})

		const ctx = createJsonContext({
			userId: 'u1',
			db,
			body: given.body
		})

		const res = await readNotificationHandler(ctx)
		const payload = (await res.json()) as { code?: string }
		return {
			status: res.status,
			code: payload.code ?? '',
			insertCalled: db.insert.mock.calls.length === 1
		}
	})
})

function createMockDb(): MockDb {
	return {
		insert: vi.fn(),
		query: {
			notification: {
				findMany: vi.fn()
			},
			notificationRead: {
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
