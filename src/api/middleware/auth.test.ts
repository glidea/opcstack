import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import { adminSecretMiddleware, authMiddleware } from './auth'
import { authCore } from '../auth'
import type { Context } from 'hono'
import type { ApiEnv } from '..'

vi.mock('../auth', () => {
	return {
		authCore: vi.fn()
	}
})

describe('authMiddleware', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		path: string
		authorization?: string
		sessionUserId?: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		nextCalled: boolean
		setUserId: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'skip auth for public path',
			given: 'a public api path',
			when: 'running auth middleware',
			then: 'calls next directly',
			givenDetail: {
				path: '/api/health'
			},
			whenDetail: {},
			thenExpected: {
				status: 0,
				code: '',
				nextCalled: true,
				setUserId: ''
			}
		},
		{
			scenario: 'skip auth for credit admin public path',
			given: 'credit admin endpoint with admin secret middleware',
			when: 'running auth middleware',
			then: 'calls next directly',
			givenDetail: {
				path: '/api/admin/generate_credit_codes'
			},
			whenDetail: {},
			thenExpected: {
				status: 0,
				code: '',
				nextCalled: true,
				setUserId: ''
			}
		},
		{
			scenario: 'skip auth for admin grant credits path',
			given: 'admin grant credits endpoint',
			when: 'running auth middleware',
			then: 'calls next directly',
			givenDetail: {
				path: '/api/admin/grant_credits'
			},
			whenDetail: {},
			thenExpected: {
				status: 0,
				code: '',
				nextCalled: true,
				setUserId: ''
			}
		},
		{
			scenario: 'skip auth for admin notification path',
			given: 'admin notification endpoint with admin secret middleware',
			when: 'running auth middleware',
			then: 'calls next directly',
			givenDetail: {
				path: '/api/admin/create_notification'
			},
			whenDetail: {},
			thenExpected: {
				status: 0,
				code: '',
				nextCalled: true,
				setUserId: ''
			}
		},
		{
			scenario: 'reject request without authorization header',
			given: 'a protected path and no authorization header',
			when: 'running auth middleware',
			then: 'returns unauthorized',
			givenDetail: {
				path: '/api/r2/private/u1/a.txt'
			},
			whenDetail: {},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED',
				nextCalled: false,
				setUserId: ''
			}
		},
		{
			scenario: 'reject request with non bearer authorization',
			given: 'a protected path and basic authorization header',
			when: 'running auth middleware',
			then: 'returns unauthorized',
			givenDetail: {
				path: '/api/r2/private/u1/a.txt',
				authorization: 'Basic token'
			},
			whenDetail: {},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED',
				nextCalled: false,
				setUserId: ''
			}
		},
		{
			scenario: 'reject bearer token when session is missing',
			given: 'a protected path and bearer authorization header',
			when: 'session lookup returns null',
			then: 'returns unauthorized',
			givenDetail: {
				path: '/api/r2/private/u1/a.txt',
				authorization: 'Bearer token'
			},
			whenDetail: {},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED',
				nextCalled: false,
				setUserId: ''
			}
		},
		{
			scenario: 'accept bearer token when session exists',
			given: 'a protected path and bearer authorization header',
			when: 'session lookup returns user id',
			then: 'sets user id and calls next',
			givenDetail: {
				path: '/api/r2/private/u1/a.txt',
				authorization: 'Bearer token',
				sessionUserId: 'u1'
			},
			whenDetail: {},
			thenExpected: {
				status: 0,
				code: '',
				nextCalled: true,
				setUserId: 'u1'
			}
		}
	]

	runCases(cases, async (given) => {
		const getSession = vi.fn(async () => {
			if (!given.sessionUserId) {
				return null
			}
			return {
				user: {
					id: given.sessionUserId
				}
			}
		})
		vi.mocked(authCore).mockReturnValue({
			api: {
				getSession
			}
		} as never)

		const state = createContextState(given.path, given.authorization)
		const ctx = createContext(state)
		const res = await authMiddleware(ctx, state.next)

		if (!res) {
			return {
				status: 0,
				code: '',
				nextCalled: state.nextCalled,
				setUserId: String(state.values['userId'] ?? '')
			}
		}

		const payload = (await res.json()) as { code?: string }
		return {
			status: res.status,
			code: payload.code ?? '',
			nextCalled: state.nextCalled,
			setUserId: String(state.values['userId'] ?? '')
		}
	})
})

describe('adminSecretMiddleware', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		authorization?: string
		adminSecret: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		nextCalled: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'reject when authorization header mismatches admin secret',
			given: 'an invalid authorization header',
			when: 'running admin secret middleware',
			then: 'returns unauthorized',
			givenDetail: {
				authorization: 'Bearer wrong',
				adminSecret: 'secret'
			},
			whenDetail: {},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED',
				nextCalled: false
			}
		},
		{
			scenario: 'accept when authorization header matches admin secret',
			given: 'a valid admin authorization header',
			when: 'running admin secret middleware',
			then: 'calls next',
			givenDetail: {
				authorization: 'Bearer secret',
				adminSecret: 'secret'
			},
			whenDetail: {},
			thenExpected: {
				status: 0,
				code: '',
				nextCalled: true
			}
		}
	]

	runCases(cases, async (given) => {
		const state = createContextState('/api/admin/generate_beta_codes', given.authorization)
		state.env['ADMIN_SECRET'] = given.adminSecret
		const ctx = createContext(state)
		const res = await adminSecretMiddleware(ctx, state.next)

		if (!res) {
			return {
				status: 0,
				code: '',
				nextCalled: state.nextCalled
			}
		}
		const payload = (await res.json()) as { code?: string }
		return {
			status: res.status,
			code: payload.code ?? '',
			nextCalled: state.nextCalled
		}
	})
})

type ContextState = {
	path: string
	authorization?: string
	env: Record<string, string>
	values: Record<string, unknown>
	nextCalled: boolean
	next: () => Promise<void>
}

function createContextState(path: string, authorization?: string): ContextState {
	return {
		path,
		...(authorization !== undefined ? { authorization } : {}),
		env: {
			ADMIN_SECRET: 'admin-secret',
			BETA_CODE_ENABLED: 'true',
			BETTER_AUTH_SECRET: 'secret',
			APP_BASE_URL: 'http://localhost:5173'
		},
		values: {
			db: {}
		},
		nextCalled: false,
		next: async (): Promise<void> => {
			return
		}
	}
}

function createContext(state: ContextState): Context<ApiEnv> {
	state.next = async (): Promise<void> => {
		state.nextCalled = true
	}

	const reqHeaders = new Headers()
	if (state.authorization) {
		reqHeaders.set('authorization', state.authorization)
	}

	const ctx = {
		env: state.env,
		req: {
			path: state.path,
			raw: {
				headers: reqHeaders
			},
			header: (name: string): string | undefined => {
				return reqHeaders.get(name) ?? undefined
			}
		},
		set: (key: string, value: unknown): void => {
			state.values[key] = value
		},
		get: (key: string): unknown => {
			return state.values[key]
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
