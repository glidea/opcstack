import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Context } from 'hono'
import type { ApiEnv } from '..'
import { listUsersHandler } from './users'

const shardRouterMocks = vi.hoisted(() => ({
	openShardSession: vi.fn()
}))

vi.mock('../../db/shard-router', () => ({
	createTenantShardAccess: (): { openShardSession: typeof shardRouterMocks.openShardSession } => ({
		openShardSession: shardRouterMocks.openShardSession
	})
}))

beforeEach((): void => {
	shardRouterMocks.openShardSession.mockReset()
})

describe('listUsersHandler', () => {
	test('rejects invalid pagination', async () => {
		const response: Response = await listUsersHandler(createContext({
			body: { page: 0 },
			db: {}
		}))
		const payload: { code?: string } = await response.json()

		expect({ status: response.status, code: payload.code }).toEqual({
			status: 400,
			code: 'INVALID_REQUEST'
		})
	})

	test('returns the current credit balance from the assigned tenant shard', async () => {
		const rows: UserRow[] = [
			{
				id: 'usr_1',
				name: 'Maya Chen',
				email: 'maya@example.com',
				registrationUtmSource: 'launch',
				createdAt: new Date(1000),
				updatedAt: new Date(2000),
				inviterName: 'Robin Lee',
				inviterEmail: 'robin@example.com',
				shardId: 'apac-0000',
				shardBindingName: 'TENANT_DB_APAC_0000'
			}
		]
		shardRouterMocks.openShardSession.mockReturnValue({
			db: createBalanceDb([{ userId: 'usr_1', balance: 12_500_000 }])
		})
		const response: Response = await listUsersHandler(createContext({
			body: { search: 'maya', page: 1, page_size: 20 },
			db: createListDb(rows, 1)
		}))

		expect(await response.json()).toEqual({
			items: [
				{
					id: 'usr_1',
					name: 'Maya Chen',
					email: 'maya@example.com',
					registration_utm_source: 'launch',
					created_at: 1000,
					updated_at: 2000,
					credit_balance: '12.500000',
					inviter: {
						name: 'Robin Lee',
						email: 'robin@example.com'
					}
				}
			],
			total: 1
		})
		expect(shardRouterMocks.openShardSession).toHaveBeenCalledWith(
			{ shardId: 'apac-0000', bindingName: 'TENANT_DB_APAC_0000' },
			'first-unconstrained'
		)
	})

})

type UserRow = {
	id: string
	name: string
	email: string
	registrationUtmSource: string | null
	createdAt: Date
	updatedAt: Date
	inviterName: string | null
	inviterEmail: string | null
	shardId: string | null
	shardBindingName: string | null
}

function createBalanceDb(rows: Array<{ userId: string; balance: number }>): Record<string, unknown> {
	return {
		select: (): Record<string, unknown> => ({
			from: (): Record<string, unknown> => ({
				where: async (): Promise<Array<{ userId: string; balance: number }>> => rows
			})
		})
	}
}

function createListDb(rows: UserRow[], total: number): Record<string, unknown> {
	let selectCall: number = 0
	return {
		select: vi.fn((): Record<string, unknown> => {
			selectCall += 1
			if (selectCall === 1) {
				return createCountQuery(total)
			}
			return createRowsQuery(rows)
		})
	}
}

function createCountQuery(total: number): Record<string, unknown> {
	return {
		from: (): Record<string, unknown> => ({
			where: async (): Promise<Array<{ total: number }>> => [{ total }]
		})
	}
}

function createRowsQuery(rows: UserRow[]): Record<string, unknown> {
	const query: Record<string, unknown> = {
		leftJoin: (): Record<string, unknown> => query,
		where: (): Record<string, unknown> => query,
		orderBy: (): Record<string, unknown> => query,
		limit: (): Record<string, unknown> => query,
		offset: async (): Promise<UserRow[]> => rows
	}
	return {
		from: (): Record<string, unknown> => query
	}
}

function createContext(input: { body: unknown; db: unknown }): Context<ApiEnv> {
	return {
		req: {
			json: async <T>(): Promise<T> => input.body as T
		},
		get: (): unknown => input.db,
		json: (payload: unknown, status?: number): Response => {
			return new Response(JSON.stringify(payload), {
				status: status ?? 200,
				headers: { 'content-type': 'application/json' }
			})
		}
	} as unknown as Context<ApiEnv>
}
