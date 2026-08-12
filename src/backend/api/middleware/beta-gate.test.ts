import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import { betaGateMiddleware } from './beta-gate'
import type { Context } from 'hono'
import type { ApiEnv } from '..'
import type { AuthRuntimeConfig } from '../../config'

describe('betaGateMiddleware', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		path: string
		betaCodeEnabled: string
		userId: string
		hasBeta: boolean
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		nextCalled: boolean
		dbCalled: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'skip beta code gate when beta code feature is disabled',
			given: 'a protected path and beta code feature disabled',
			when: 'running beta code gate middleware',
			then: 'calls next without querying database',
			givenDetail: {
				path: '/api/r2/private/u1/a.txt',
				betaCodeEnabled: 'false',
				userId: 'u1',
				hasBeta: false
			},
			whenDetail: {},
			thenExpected: {
				status: 0,
				code: '',
				nextCalled: true,
				dbCalled: false
			}
		},
		{
			scenario: 'reject protected path when user has no beta code',
			given: 'a protected path and beta code feature enabled',
			when: 'database has no beta code binding for user',
			then: 'returns beta code required',
			givenDetail: {
				path: '/api/r2/private/u1/a.txt',
				betaCodeEnabled: 'true',
				userId: 'u1',
				hasBeta: false
			},
			whenDetail: {},
			thenExpected: {
				status: 403,
				code: 'BETA_CODE_REQUIRED',
				nextCalled: false,
				dbCalled: true
			}
		},
		{
			scenario: 'accept protected path when user already has beta code',
			given: 'a protected path and beta code feature enabled',
			when: 'database has beta code binding for user',
			then: 'calls next',
			givenDetail: {
				path: '/api/r2/private/u1/a.txt',
				betaCodeEnabled: 'true',
				userId: 'u1',
				hasBeta: true
			},
			whenDetail: {},
			thenExpected: {
				status: 0,
				code: '',
				nextCalled: true,
				dbCalled: true
			}
		}
	]

	runCases(cases, async (given) => {
		const findFirst = vi.fn(async () => {
			if (!given.hasBeta) {
				return null
			}
			return {
				id: 'beta-id'
			}
		})
		const db = {
			query: {
				betaCode: {
					findFirst
				}
			}
		}

		const state = createContextState(given.path, given.betaCodeEnabled, given.userId, db)
		const ctx = createContext(state)
		const res = await betaGateMiddleware(ctx, state.next)

		if (!res) {
			return {
				status: 0,
				code: '',
				nextCalled: state.nextCalled,
				dbCalled: findFirst.mock.calls.length > 0
			}
		}

		const payload = (await res.json()) as { code?: string }
		return {
			status: res.status,
			code: payload.code ?? '',
			nextCalled: state.nextCalled,
			dbCalled: findFirst.mock.calls.length > 0
		}
	})
})

type ContextState = {
	path: string
	env: Record<string, string>
	values: Record<string, unknown>
	nextCalled: boolean
	next: () => Promise<void>
}

function createContextState(
	path: string,
	betaCodeEnabled: string,
	userId: string,
	db: unknown
): ContextState {
	return {
		path,
		env: {
		},
		values: {
			userId,
			metaDb: db,
			authRuntimeConfig: createAuthRuntimeConfig(betaCodeEnabled === 'true')
		},
		nextCalled: false,
		next: async (): Promise<void> => {
			return
		}
	}
}

function createAuthRuntimeConfig(betaCodeEnabled: boolean): AuthRuntimeConfig {
	return {
		systemEmail: 'admin@opcstack.local',
		authentication: {
			betaCodeEnabled,
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

	const ctx = {
		env: state.env,
		req: {
			path: state.path
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
