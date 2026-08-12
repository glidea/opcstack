import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import {
	administratorMiddleware,
	authMiddleware,
	browserSessionOnlyMiddleware,
	requireApiScope
} from './auth'
import { authCore } from '../auth'
import type { Context } from 'hono'
import type { ApiEnv } from '..'
import type { AuthRuntimeConfig } from '../../config'
import { isAdministrator } from '../../auth/administrator'

vi.mock('../auth', () => {
	return {
		authCore: vi.fn()
	}
})

vi.mock('../../auth/administrator', () => {
	return {
		isAdministrator: vi.fn()
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

describe('administratorMiddleware', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		authorization?: string
		sessionUserId?: string
		sessionUserEmail?: string
		administrator?: boolean
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
			scenario: 'accept administrator identity',
			given: 'an authenticated administrator identity',
			when: 'running administrator middleware',
			then: 'calls next',
			givenDetail: {
				sessionUserId: 'admin-user',
				sessionUserEmail: 'owner@example.com',
				administrator: true
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
			scenario: 'reject non administrator identity',
			given: 'an authenticated regular user identity',
			when: 'running administrator middleware',
			then: 'returns forbidden',
			givenDetail: {
				authorization: 'Bearer wrong',
				sessionUserId: 'user-1',
				sessionUserEmail: 'user@example.com'
			},
			whenDetail: {},
			thenExpected: {
				status: 403,
				code: 'FORBIDDEN',
				nextCalled: false,
				setUserId: 'user-1'
			}
		}
	]

	runCases(cases, async (given) => {
		const state = createContextState(
			'/api/admin/generate_beta_codes',
			given.authorization,
			given.sessionUserId ? 'better-auth.session_token=test' : undefined
		)
		state.values['userId'] = given.sessionUserId
		const ctx = createContext(state)
		vi.mocked(isAdministrator).mockResolvedValue(given.administrator ?? false)
		const res = await administratorMiddleware(ctx, state.next)

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

describe('OAuth API authorization', () => {
	it('rejects an OAuth request without the required scope', async () => {
		const state = createContextState('/api/get_credit_summary')
		state.values['oauthAuthorization'] = {
			userId: 'user-1',
			clientId: 'opc-cli',
			grantId: 'grant-1',
			scopes: ['credits:read']
		}
		const response = await requireApiScope('credits:write')(createContext(state), state.next)
		expect(response?.status).toBe(403)
		expect(state.nextCalled).toBe(false)
	})

	it('allows a browser session through API scope middleware', async () => {
		const state = createContextState('/api/get_credit_summary')
		const response = await requireApiScope('credits:read')(createContext(state), state.next)
		expect(response).toBeUndefined()
		expect(state.nextCalled).toBe(true)
	})

	it('rejects OAuth tokens from browser-only routes', async () => {
		const state = createContextState('/api/settings')
		state.values['oauthAuthorization'] = {
			userId: 'user-1',
			clientId: 'opc-cli',
			grantId: 'grant-1',
			scopes: ['credits:read']
		}
		const response = await browserSessionOnlyMiddleware(createContext(state), state.next)
		expect(response?.status).toBe(403)
		expect(state.nextCalled).toBe(false)
	})

	it('accepts a verified OAuth token and exposes its grant scopes', async () => {
		const verifyJWT = vi.fn(async () => ({
			payload: {
				sub: 'user-1',
				azp: 'opc-cli',
				scope: 'api_access offline_access',
				grant_id: 'grant-1',
				api_scopes: ['credits:read']
			}
		}))
		vi.mocked(authCore).mockReturnValue({
			api: {
				getSession: vi.fn(async () => null),
				verifyJWT
			}
		} as never)

		const state = createContextState('/api/get_credit_summary', 'Bearer access-token')
		state.values['metaDb'] = {
			query: {
				oauthGrant: {
					findFirst: vi.fn(async () => ({
						id: 'grant-1',
						userId: 'user-1',
						clientId: 'opc-cli',
						scopes: ['credits:read'],
						status: 'active',
						createdAt: 1,
						approvedAt: 1,
						revokedAt: null
					}))
				}
			}
		}

		const ctx = createContext(state)
		const result = await authMiddleware(ctx, state.next)

		expect(result).toBeUndefined()
		expect(state.nextCalled).toBe(true)
		expect(state.values['userId']).toBe('user-1')
		expect(state.values['oauthAuthorization']).toEqual({
			userId: 'user-1',
			clientId: 'opc-cli',
			grantId: 'grant-1',
			scopes: ['credits:read']
		})
		expect(verifyJWT).toHaveBeenCalledWith({
			body: {
				token: 'access-token',
				issuer: 'http://localhost:5173/api/auth'
			}
		})
	})

	it('rejects an OAuth token after its grant is revoked', async () => {
		vi.mocked(authCore).mockReturnValue({
			api: {
				getSession: vi.fn(async () => null),
				verifyJWT: vi.fn(async () => ({
					payload: {
					sub: 'user-1',
					azp: 'opc-cli',
					scope: 'api_access offline_access',
					grant_id: 'grant-1',
					api_scopes: ['credits:read']
					}
				}))
			}
		} as never)
		const state = createContextState('/api/get_credit_summary', 'Bearer access-token')
		state.values['metaDb'] = {
			query: {
				oauthGrant: {
					findFirst: vi.fn(async () => ({
						id: 'grant-1',
						userId: 'user-1',
						clientId: 'opc-cli',
						scopes: ['credits:read'],
						status: 'revoked',
						createdAt: 1,
						approvedAt: 1,
						revokedAt: 2
					}))
				}
			}
		}

		const response = await authMiddleware(createContext(state), state.next)
		expect(response?.status).toBe(401)
		expect(state.nextCalled).toBe(false)
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
			BETTER_AUTH_SECRET: 'secret',
			APP_BASE_URL: 'http://localhost:5173'
		},
		values: {
			metaDb: {},
			authRuntimeConfig: createAuthRuntimeConfig()
		},
		nextCalled: false,
		next: async (): Promise<void> => {
			return
		}
	}
}

function createAuthRuntimeConfig(): AuthRuntimeConfig {
	return {
		systemEmail: 'admin@opcstack.local',
		authentication: {
			betaCodeEnabled: true,
			emailSignupEnabled: false,
			emailSignupDomainAllowlist: [],
			emailRequireVerification: false,
			emailUserActionCooldownSeconds: 50,
			turnstile: { enabled: false, siteKey: null, secretKey: null },
			providers: {
				google: { enabled: false, clientId: null, clientSecret: null },
				github: { enabled: false, clientId: null, clientSecret: null },
				linuxdo: { enabled: false, clientId: null, clientSecret: null }
			}
		},
		email: { enabled: false, provider: null, resendApiKey: null }
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
