import { describe, expect, test, vi } from 'vitest'
import type { Context } from 'hono'
import type { ApiEnv } from '..'
import { listAdminUsersHandler } from './admin-users'

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

	test('returns user access and shard context', async () => {
		const rows: AdminUserRow[] = [
			{
				id: 'usr_1',
				name: 'Maya Chen',
				email: 'maya@example.com',
				emailVerified: true,
				image: 'https://example.com/maya.png',
				affCode: 'MAYA1234',
				registrationUtmSource: 'launch',
				createdAt: new Date(1000),
				updatedAt: new Date(2000),
				betaCode: 'BETA1234',
				betaUsedAt: 1500,
				shardId: 'apac-0000',
				shardRegion: 'apac',
				shardDatabaseName: 'tenant-apac-0000',
				shardDatabaseId: 'db-1'
			}
		]
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
					image: 'https://example.com/maya.png',
					aff_code: 'MAYA1234',
					registration_utm_source: 'launch',
					created_at: 1000,
					updated_at: 2000,
					beta_access: {
						code: 'BETA1234',
						used_at: 1500
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
	})
})

type AdminUserRow = {
	id: string
	name: string
	email: string
	emailVerified: boolean
	image: string | null
	affCode: string | null
	registrationUtmSource: string | null
	createdAt: Date
	updatedAt: Date
	betaCode: string | null
	betaUsedAt: number | null
	shardId: string | null
	shardRegion: string | null
	shardDatabaseName: string | null
	shardDatabaseId: string | null
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
