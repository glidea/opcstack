import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Context } from 'hono'
import type { ApiEnv } from '..'
import { listAdminUsersHandler, updateAdministratorEmailHandler } from './admin-users'

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

describe('listAdminUsersHandler', () => {
	test('rejects invalid pagination', async () => {
		const response: Response = await listAdminUsersHandler(createContext({
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
		const rows: AdminUserRow[] = [
			{
				id: 'usr_1',
				name: 'Maya Chen',
				email: 'maya@example.com',
				emailVerified: true,
				image: 'https://example.com/maya.png',
				registrationUtmSource: 'launch',
				createdAt: new Date(1000),
				updatedAt: new Date(2000),
				betaCodeId: 'beta-1',
				inviterName: 'Robin Lee',
				inviterEmail: 'robin@example.com',
				shardId: 'apac-0000',
				shardRegion: 'apac',
				shardDatabaseName: 'tenant-apac-0000',
				shardDatabaseId: 'db-1',
				shardBindingName: 'TENANT_DB_APAC_0000'
			}
		]
		shardRouterMocks.openShardSession.mockReturnValue({
			db: createBalanceDb([{ userId: 'usr_1', balance: 12_500_000 }])
		})
		const response: Response = await listAdminUsersHandler(createContext({
			body: { search: 'maya', page: 1, page_size: 20 },
			db: createListDb(rows, 1)
		}))

		expect(await response.json()).toEqual({
			items: [
				{
					id: 'usr_1',
				name: 'Maya Chen',
				email: 'maya@example.com',
				email_verified: true,
				registration_utm_source: 'launch',
					created_at: 1000,
					updated_at: 2000,
					credit_balance: '12.500000',
					beta_access: true,
					inviter: {
						name: 'Robin Lee',
						email: 'robin@example.com'
					},
					shard: {
						id: 'apac-0000',
						region: 'apac',
						database_name: 'tenant-apac-0000',
						database_id: 'db-1'
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

	test('updates the administrator email', async (): Promise<void> => {
		const response: Response = await updateAdministratorEmailHandler(createContext({
			body: { email: 'owner@example.com' },
			db: createUpdateEmailDb(undefined, [{ email: 'owner@example.com' }]),
			userId: 'admin-1'
		}))

		expect({ status: response.status, body: await response.json() }).toEqual({
			status: 200,
			body: { email: 'owner@example.com' }
		})
	})

	test('rejects an administrator email used by another account', async (): Promise<void> => {
		const response: Response = await updateAdministratorEmailHandler(createContext({
			body: { email: 'user@example.com' },
			db: createUpdateEmailDb({ id: 'user-1' }, []),
			userId: 'admin-1'
		}))

		expect({ status: response.status, body: await response.json() }).toEqual({
			status: 409,
			body: { code: 'EMAIL_ALREADY_EXISTS', message: 'Email is already in use' }
		})
	})
})

type AdminUserRow = {
	id: string
	name: string
	email: string
	emailVerified: boolean
	image: string | null
	registrationUtmSource: string | null
	createdAt: Date
	updatedAt: Date
	betaCodeId: string | null
	inviterName: string | null
	inviterEmail: string | null
	shardId: string | null
	shardRegion: string | null
	shardDatabaseName: string | null
	shardDatabaseId: string | null
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

function createListDb(rows: AdminUserRow[], total: number): Record<string, unknown> {
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

function createRowsQuery(rows: AdminUserRow[]): Record<string, unknown> {
	const query: Record<string, unknown> = {
		leftJoin: (): Record<string, unknown> => query,
		where: (): Record<string, unknown> => query,
		orderBy: (): Record<string, unknown> => query,
		limit: (): Record<string, unknown> => query,
		offset: async (): Promise<AdminUserRow[]> => rows
	}
	return {
		from: (): Record<string, unknown> => query
	}
}

function createUpdateEmailDb(
	existing: { id: string } | undefined,
	updated: Array<{ email: string }>
): Record<string, unknown> {
	return {
		query: {
			user: {
				findFirst: async (): Promise<{ id: string } | undefined> => existing
			}
		},
		update: (): Record<string, unknown> => ({
			set: (): Record<string, unknown> => ({
				where: (): Record<string, unknown> => ({
					returning: async (): Promise<Array<{ email: string }>> => updated
				})
			})
		})
	}
}

function createContext(input: { body: unknown; db: unknown; userId?: string }): Context<ApiEnv> {
	return {
		req: {
			json: async <T>(): Promise<T> => input.body as T
		},
		get: (key: string): unknown => key === 'userId' ? input.userId : input.db,
		json: (payload: unknown, status?: number): Response => {
			return new Response(JSON.stringify(payload), {
				status: status ?? 200,
				headers: { 'content-type': 'application/json' }
			})
		}
	} as unknown as Context<ApiEnv>
}
