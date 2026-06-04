import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import { adminUserMiddleware, authMiddleware } from './auth'
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
		cookie?: string
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
			scenario: 'reject request without session',
			given: 'a protected path and no session',
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
			scenario: 'accept cookie session when authorization header is missing',
			given: 'a protected path and session cookie',
			when: 'session lookup returns user id',
			then: 'sets user id and calls next',
			givenDetail: {
				path: '/api/r2/private/u1/a.txt',
				cookie: 'better-auth.session_token=signed-token',
				sessionUserId: 'u1'
			},
			whenDetail: {},
			thenExpected: {
				status: 0,
				code: '',
				nextCalled: true,
				setUserId: 'u1'
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

		const state = createContextState(given.path, given.authorization, given.cookie)
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

describe('adminUserMiddleware', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		authorization?: string
		adminUserId?: string
		sessionUserId?: string
		sessionUserEmail?: string
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
			scenario: 'accept admin api token',
			given: 'a matching admin api token and configured admin user',
			when: 'running admin user middleware',
			then: 'sets configured admin user id',
			givenDetail: {
				authorization: 'Bearer admin-token',
				adminUserId: 'admin-user'
			},
			whenDetail: {},
			thenExpected: {
				status: 0,
				code: '',
				nextCalled: true,
				setUserId: 'admin-user'
			}
		},
		{
			scenario: 'reject admin api token without configured user',
			given: 'a matching admin api token and missing configured admin user',
			when: 'running admin user middleware',
			then: 'returns unauthorized',
			givenDetail: {
				authorization: 'Bearer admin-token'
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
			scenario: 'accept super admin session',
			given: 'a session for configured super admin email',
			when: 'running admin user middleware',
			then: 'sets session user id',
			givenDetail: {
				sessionUserId: 'admin-user',
				sessionUserEmail: 'admin@example.com'
			},
			whenDetail: {},
			thenExpected: {
				status: 0,
				code: '',
				nextCalled: true,
				setUserId: 'admin-user'
			}
		},
		{
			scenario: 'reject non admin session',
			given: 'a session for another email',
			when: 'running admin user middleware',
			then: 'returns unauthorized',
			givenDetail: {
				authorization: 'Bearer wrong',
				sessionUserId: 'user-1',
				sessionUserEmail: 'user@example.com'
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
			scenario: 'reject missing admin identity',
			given: 'no admin token and no session',
			when: 'running admin user middleware',
			then: 'returns unauthorized',
			givenDetail: {
				authorization: 'Bearer wrong'
			},
			whenDetail: {},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED',
				nextCalled: false,
				setUserId: ''
			}
		}
	]

	runCases(cases, async (given) => {
		const getSession = vi.fn(async () => {
			if (!given.sessionUserId || !given.sessionUserEmail) {
				return null
			}
			return {
				user: {
					id: given.sessionUserId,
					email: given.sessionUserEmail
				}
			}
		})
		vi.mocked(authCore).mockReturnValue({
			api: {
				getSession
			}
		} as never)

		const state = createContextState('/api/admin/generate_beta_codes', given.authorization)
		state.values['metaDb'] = {
			query: {
				user: {
					findFirst: vi.fn(async () => {
						if (!given.adminUserId) {
							return null
						}
						return {
							id: given.adminUserId,
							email: 'admin@example.com'
						}
					})
				}
			}
		}
		const ctx = createContext(state)
		const res = await adminUserMiddleware(ctx, state.next)

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

	type IdentityGivenDetail = {
		adminUserId: string
		adminEmail: string
	}
	type IdentityWhenDetail = Record<string, never>
	type IdentityThenExpected = {
		tokenUserId: string
		sessionUserId: string
	}

	const identityCases: TestCase<
		IdentityGivenDetail,
		IdentityWhenDetail,
		IdentityThenExpected
	>[] = [
		{
			scenario: 'resolve one admin identity',
			given: 'the configured admin user exists and has a session',
			when: 'admin api token and admin session are both accepted',
			then: 'both paths set the same user id',
			givenDetail: {
				adminUserId: 'admin-user',
				adminEmail: 'admin@example.com'
			},
			whenDetail: {},
			thenExpected: {
				tokenUserId: 'admin-user',
				sessionUserId: 'admin-user'
			}
		}
	]

	runCases(identityCases, async (given) => {
		vi.mocked(authCore).mockReturnValue({
			api: {
				getSession: vi.fn(async () => {
					return {
						user: {
							id: given.adminUserId,
							email: given.adminEmail
						}
					}
				})
			}
		} as never)

		const tokenState = createContextState(
			'/api/admin/list_payment_transactions',
			'Bearer admin-token'
		)
		tokenState.values['metaDb'] = {
			query: {
				user: {
					findFirst: vi.fn(async () => {
						return {
							id: given.adminUserId
						}
					})
				}
			}
		}
		await adminUserMiddleware(createContext(tokenState), tokenState.next)

		const sessionState = createContextState('/api/admin/list_payment_transactions')
		await adminUserMiddleware(createContext(sessionState), sessionState.next)

		return {
			tokenUserId: String(tokenState.values['userId'] ?? ''),
			sessionUserId: String(sessionState.values['userId'] ?? '')
		}
	})
})

type ContextState = {
	path: string
	authorization?: string
	cookie?: string
	env: Record<string, string>
	values: Record<string, unknown>
	nextCalled: boolean
	next: () => Promise<void>
}

function createContextState(
	path: string,
	authorization?: string,
	cookie?: string
): ContextState {
	return {
		path,
		...(authorization !== undefined ? { authorization } : {}),
		...(cookie !== undefined ? { cookie } : {}),
		env: {
			SUPER_ADMIN_EMAIL: 'admin@example.com',
			ADMIN_API_TOKEN: 'admin-token',
			BETA_CODE_ENABLED: 'true',
			BETTER_AUTH_SECRET: 'secret',
			APP_BASE_URL: 'http://localhost:5173'
		},
		values: {
			metaDb: {}
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
	if (state.cookie) {
		reqHeaders.set('cookie', state.cookie)
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
