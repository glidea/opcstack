import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import { tenantDbMiddleware } from './tenant-db'
import type { Context } from 'hono'
import type { ApiEnv } from '..'

vi.mock('../../db/shard-router', () => {
	return {
		resolveUserShard: vi.fn().mockResolvedValue({
			shardId: 'shard_0000',
			bindingName: 'TENANT_DB_0000'
		})
	}
})

describe('tenantDbMiddleware', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		headers: Record<string, string>
		responseBookmark: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		withSessionBookmark: string
		tenantDbSet: boolean
		tenantShardId: string
		responseShard: string
		responseBookmark: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'inject tenant db',
			given: 'tenant shard exists and no bookmark is sent',
			when: 'running tenant db middleware',
			then: 'sets tenant db and writes tenant bookmark',
			givenDetail: {
				headers: {},
				responseBookmark: 'next-tenant'
			},
			whenDetail: {},
			thenExpected: {
				withSessionBookmark: 'first-primary',
				tenantDbSet: true,
				tenantShardId: 'shard_0000',
				responseShard: 'shard_0000',
				responseBookmark: 'next-tenant'
			}
		}
	]

	runCases(cases, async (given) => {
		const withSession = vi.fn((bookmark: string) => {
			return {
				prepare: vi.fn(),
				batch: vi.fn(),
				getBookmark: vi.fn(() => {
					return given.responseBookmark
				})
			}
		})
		const state = createContextState(given.headers, withSession)
		const ctx = createContext(state)

		await tenantDbMiddleware(ctx, state.next)

		return {
			withSessionBookmark: String(withSession.mock.calls[0]?.[0] ?? ''),
			tenantDbSet: state.values['tenantDb'] !== undefined,
			tenantShardId: String(state.values['tenantShardId'] ?? ''),
			responseShard: state.response.headers.get('x-d1-tenant-shard') ?? '',
			responseBookmark: state.response.headers.get('x-d1-tenant-bookmark') ?? ''
		}
	})
})

type ContextState = {
	headers: Headers
	env: {
		APP_BASE_URL: string
		TENANT_DB_0000: {
			withSession: (bookmark: string) => {
				prepare: ReturnType<typeof vi.fn>
				batch: ReturnType<typeof vi.fn>
				getBookmark: ReturnType<typeof vi.fn>
			}
		}
	}
	values: Record<string, unknown>
	response: Response
	next: () => Promise<void>
}

function createContextState(
	headers: Record<string, string>,
	withSession: ContextState['env']['TENANT_DB_0000']['withSession']
): ContextState {
	return {
		headers: new Headers(headers),
		env: {
			APP_BASE_URL: 'http://localhost:5173',
			TENANT_DB_0000: {
				withSession
			}
		},
		values: {
			userId: 'user-1',
			metaDb: {}
		},
		response: new Response(JSON.stringify({ ok: true })),
		next: async (): Promise<void> => {
			return
		}
	}
}

function createContext(state: ContextState): Context<ApiEnv> {
	state.next = async (): Promise<void> => {
		return
	}

	const ctx = {
		env: state.env,
		req: {
			header: (name: string): string | undefined => {
				return state.headers.get(name) ?? undefined
			}
		},
		res: state.response,
		get: (key: string): unknown => {
			return state.values[key]
		},
		set: (key: string, value: unknown): void => {
			state.values[key] = value
		}
	}

	return ctx as unknown as Context<ApiEnv>
}
