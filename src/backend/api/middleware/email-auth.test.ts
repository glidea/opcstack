import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import { emailAuthMiddleware } from './email-auth'
import type { Context } from 'hono'
import type { ApiEnv } from '..'

describe('emailAuthMiddleware', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		path: string
		body: {
			email?: string
			type?: string
		}
		emailEnabled: string
		emailSignupEnabled: string
		emailSignupDomainAllowlist: string
		cooldownSeconds: string
		kvGetValue: string | null
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		nextCalled: boolean
		kvGetCalled: boolean
		kvPutCalled: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'skip non target auth path',
			given: 'auth endpoint not in email constraint list',
			when: 'running middleware',
			then: 'calls next without kv access',
			givenDetail: {
				path: '/api/auth/sign-in/email',
				body: { email: 'u1@example.com' },
				emailEnabled: 'true',
				emailSignupEnabled: 'true',
				emailSignupDomainAllowlist: '',
				cooldownSeconds: '50',
				kvGetValue: null
			},
			whenDetail: {},
			thenExpected: {
				status: 0,
				code: '',
				nextCalled: true,
				kvGetCalled: false,
				kvPutCalled: false
			}
		},
		{
			scenario: 'reject otp sign in endpoint',
			given: 'email otp sign in endpoint',
			when: 'running middleware',
			then: 'returns otp sign in disabled',
			givenDetail: {
				path: '/api/auth/sign-in/email-otp',
				body: { email: 'u-login@example.com', type: 'sign-in' },
				emailEnabled: 'true',
				emailSignupEnabled: 'true',
				emailSignupDomainAllowlist: '',
				cooldownSeconds: '50',
				kvGetValue: null
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'EMAIL_OTP_SIGN_IN_DISABLED',
				nextCalled: false,
				kvGetCalled: false,
				kvPutCalled: false
			}
		},
		{
			scenario: 'reject sign in otp code request',
			given: 'verification otp endpoint with sign in type',
			when: 'running middleware',
			then: 'returns otp sign in disabled',
			givenDetail: {
				path: '/api/auth/email-otp/send-verification-otp',
				body: { email: 'u-login@example.com', type: 'sign-in' },
				emailEnabled: 'true',
				emailSignupEnabled: 'true',
				emailSignupDomainAllowlist: '',
				cooldownSeconds: '50',
				kvGetValue: null
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'EMAIL_OTP_SIGN_IN_DISABLED',
				nextCalled: false,
				kvGetCalled: false,
				kvPutCalled: false
			}
		},
		{
			scenario: 'reject signup when signup switch is disabled',
			given: 'signup endpoint and signup switch off',
			when: 'running middleware',
			then: 'returns signup disabled',
			givenDetail: {
				path: '/api/auth/sign-up/email',
				body: { email: 'u-signup-disabled@example.com' },
				emailEnabled: 'true',
				emailSignupEnabled: 'false',
				emailSignupDomainAllowlist: '',
				cooldownSeconds: '50',
				kvGetValue: null
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'EMAIL_SIGNUP_DISABLED',
				nextCalled: false,
				kvGetCalled: false,
				kvPutCalled: false
			}
		},
		{
			scenario: 'reject signup email domain outside allowlist',
			given: 'signup endpoint and email domain not in allowlist',
			when: 'running middleware',
			then: 'returns domain not allowed',
			givenDetail: {
				path: '/api/auth/sign-up/email',
				body: { email: 'u1@gmail.com' },
				emailEnabled: 'true',
				emailSignupEnabled: 'true',
				emailSignupDomainAllowlist: 'example.com;corp.com',
				cooldownSeconds: '50',
				kvGetValue: null
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'EMAIL_DOMAIN_NOT_ALLOWED',
				nextCalled: false,
				kvGetCalled: false,
				kvPutCalled: false
			}
		},
		{
			scenario: 'rate limit repeated otp password reset request',
			given: 'otp password reset endpoint and cooldown key exists',
			when: 'running middleware',
			then: 'returns action rate limited',
			givenDetail: {
				path: '/api/auth/email-otp/request-password-reset',
				body: { email: 'u-rate@example.com' },
				emailEnabled: 'true',
				emailSignupEnabled: 'true',
				emailSignupDomainAllowlist: '',
				cooldownSeconds: '50',
				kvGetValue: '9999999999999'
			},
			whenDetail: {},
			thenExpected: {
				status: 429,
				code: 'EMAIL_ACTION_RATE_LIMITED',
				nextCalled: false,
				kvGetCalled: true,
				kvPutCalled: false
			}
		},
		{
			scenario: 'allow first otp password reset request and write cooldown key',
			given: 'otp password reset endpoint and cooldown key missing',
			when: 'running middleware',
			then: 'calls next and writes cooldown key',
			givenDetail: {
				path: '/api/auth/email-otp/request-password-reset',
				body: { email: 'u-allow@example.com' },
				emailEnabled: 'true',
				emailSignupEnabled: 'true',
				emailSignupDomainAllowlist: '',
				cooldownSeconds: '50',
				kvGetValue: null
			},
			whenDetail: {},
			thenExpected: {
				status: 0,
				code: '',
				nextCalled: true,
				kvGetCalled: true,
				kvPutCalled: true
			}
		},
		{
			scenario: 'allow first verification otp request and write cooldown key',
			given: 'verification otp endpoint and cooldown key missing',
			when: 'running middleware',
			then: 'calls next and writes cooldown key',
			givenDetail: {
				path: '/api/auth/email-otp/send-verification-otp',
				body: { email: 'u-otp@example.com' },
				emailEnabled: 'true',
				emailSignupEnabled: 'true',
				emailSignupDomainAllowlist: '',
				cooldownSeconds: '50',
				kvGetValue: null
			},
			whenDetail: {},
			thenExpected: {
				status: 0,
				code: '',
				nextCalled: true,
				kvGetCalled: true,
				kvPutCalled: true
			}
		}
	]

	runCases(cases, async (given) => {
		const state = createContextState(given)
		const ctx = createContext(state)
		const res = await emailAuthMiddleware(ctx, state.next)

		if (!res) {
			return {
				status: 0,
				code: '',
				nextCalled: state.nextCalled,
				kvGetCalled: state.kvGetCalled,
				kvPutCalled: state.kvPutCalled
			}
		}

		const payload = (await res.json()) as { code?: string }
		return {
			status: res.status,
			code: payload.code ?? '',
			nextCalled: state.nextCalled,
			kvGetCalled: state.kvGetCalled,
			kvPutCalled: state.kvPutCalled
		}
	})
})

type ContextState = {
	path: string
	body: {
		email?: string
		type?: string
	}
	env: Record<string, unknown>
	nextCalled: boolean
	kvGetCalled: boolean
	kvPutCalled: boolean
	next: () => Promise<void>
}

function createContextState(given: {
	path: string
	body: {
		email?: string
		type?: string
	}
	emailEnabled: string
	emailSignupEnabled: string
	emailSignupDomainAllowlist: string
	cooldownSeconds: string
	kvGetValue: string | null
}): ContextState {
	const kv = {
		get: async (): Promise<string | null> => {
			return given.kvGetValue
		},
		put: async (): Promise<void> => {
			return
		}
	}

	return {
		path: given.path,
		body: given.body,
		env: {
			EMAIL_ENABLED: given.emailEnabled,
			EMAIL_SIGNUP_ENABLED: given.emailSignupEnabled,
			EMAIL_REQUIRE_VERIFICATION: 'true',
			EMAIL_SIGNUP_DOMAIN_ALLOWLIST: given.emailSignupDomainAllowlist,
			EMAIL_USER_ACTION_COOLDOWN_SECONDS: given.cooldownSeconds,
			EMAIL_RESEND_API_KEY: 'resend-api-key',
			EMAIL_FROM: 'Auth <auth@mg.example.com>',
			KV: kv
		},
		nextCalled: false,
		kvGetCalled: false,
		kvPutCalled: false,
		next: async (): Promise<void> => {
			return
		}
	}
}

function createContext(state: ContextState): Context<ApiEnv> {
	state.next = async (): Promise<void> => {
		state.nextCalled = true
	}

	const req = new Request(`http://localhost:5173${state.path}`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify(state.body)
	})

	const kvObject = state.env['KV'] as
		| {
				get: (key: string) => Promise<string | null>
				put: (
					key: string,
					value: string,
					options: {
						expirationTtl: number
					}
				) => Promise<void>
		  }
		| undefined

	if (kvObject && typeof kvObject.get === 'function' && typeof kvObject.put === 'function') {
		state.env['KV'] = {
			get: async (key: string): Promise<string | null> => {
				state.kvGetCalled = true
				return kvObject.get(key)
			},
			put: async (
				key: string,
				value: string,
				options: {
					expirationTtl: number
				}
			): Promise<void> => {
				state.kvPutCalled = true
				return kvObject.put(key, value, options)
			}
		}
	}

	const ctx = {
		env: state.env,
		req: {
			path: state.path,
			raw: req
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
