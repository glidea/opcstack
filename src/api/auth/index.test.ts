import { beforeEach, describe, expect, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import { authCore } from './index'
import { betterAuth } from 'better-auth'
import { newEmailClients, type EmailSimpleSendInput } from '../../email'
import type { Resend } from 'resend'

vi.mock('better-auth', () => {
	return {
		betterAuth: vi.fn()
	}
})

vi.mock('better-auth/adapters/drizzle', () => {
	return {
		drizzleAdapter: vi.fn(() => {
			return {}
		})
	}
})

vi.mock('../../email', () => {
	return {
		newEmailClients: vi.fn()
	}
})

describe('authCore email config mapping', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(betterAuth).mockReturnValue({} as never)
		vi.mocked(newEmailClients).mockReturnValue({
			simple: {
				send: createSendMock()
			},
			resend: {} as Resend
		})
	})

	type GivenDetail = {
		emailEnabled: string
		emailSignupEnabled: string
		emailRequireVerification: string
		cooldownSeconds: string
		emailResendApiKey: string
		emailFrom: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		error: string
		emailAndPasswordEnabled: boolean
		disableSignUp: boolean
		requireEmailVerification: boolean
		hasSendVerificationEmail: boolean
		hasSendResetPassword: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'disable email and password when email feature is off',
			given: 'email feature disabled',
			when: 'building auth core',
			then: 'email and password auth is disabled',
			givenDetail: {
				emailEnabled: 'false',
				emailSignupEnabled: 'false',
				emailRequireVerification: 'true',
				cooldownSeconds: '50',
				emailResendApiKey: '',
				emailFrom: ''
			},
			whenDetail: {},
			thenExpected: {
				error: '',
				emailAndPasswordEnabled: false,
				disableSignUp: true,
				requireEmailVerification: true,
				hasSendVerificationEmail: false,
				hasSendResetPassword: false
			}
		},
		{
			scenario: 'enable email and password with signup and verification switches',
			given: 'email feature enabled and signup enabled',
			when: 'building auth core',
			then: 'email config is mapped to better auth options',
			givenDetail: {
				emailEnabled: 'true',
				emailSignupEnabled: 'true',
				emailRequireVerification: 'true',
				cooldownSeconds: '50',
				emailResendApiKey: 'resend-api-key',
				emailFrom: 'Auth <auth@mg.example.com>'
			},
			whenDetail: {},
			thenExpected: {
				error: '',
				emailAndPasswordEnabled: true,
				disableSignUp: false,
				requireEmailVerification: true,
				hasSendVerificationEmail: true,
				hasSendResetPassword: true
			}
		},
		{
			scenario: 'disable email auth when signup enabled but email feature disabled',
			given: 'signup enabled but email feature disabled',
			when: 'building auth core',
			then: 'email auth remains disabled',
			givenDetail: {
				emailEnabled: 'false',
				emailSignupEnabled: 'true',
				emailRequireVerification: 'true',
				cooldownSeconds: '50',
				emailResendApiKey: '',
				emailFrom: ''
			},
			whenDetail: {},
			thenExpected: {
				error: '',
				emailAndPasswordEnabled: false,
				disableSignUp: true,
				requireEmailVerification: true,
				hasSendVerificationEmail: false,
				hasSendResetPassword: false
			}
		},
		{
			scenario: 'allow email auth even when provider config is missing',
			given: 'email feature enabled but provider config missing',
			when: 'building auth core',
			then: 'email auth config is still built',
			givenDetail: {
				emailEnabled: 'true',
				emailSignupEnabled: 'false',
				emailRequireVerification: 'true',
				cooldownSeconds: '50',
				emailResendApiKey: '',
				emailFrom: ''
			},
			whenDetail: {},
			thenExpected: {
				error: '',
				emailAndPasswordEnabled: true,
				disableSignUp: true,
				requireEmailVerification: true,
				hasSendVerificationEmail: true,
				hasSendResetPassword: true
			}
		},
		{
			scenario: 'ignore cooldown config in auth core',
			given: 'cooldown is not a positive integer',
			when: 'building auth core',
			then: 'auth core still builds email auth options',
			givenDetail: {
				emailEnabled: 'true',
				emailSignupEnabled: 'false',
				emailRequireVerification: 'true',
				cooldownSeconds: '0',
				emailResendApiKey: 'resend-api-key',
				emailFrom: 'Auth <auth@mg.example.com>'
			},
			whenDetail: {},
			thenExpected: {
				error: '',
				emailAndPasswordEnabled: true,
				disableSignUp: true,
				requireEmailVerification: true,
				hasSendVerificationEmail: true,
				hasSendResetPassword: true
			}
		}
	]

	runCases(cases, async (given) => {
		const env = createEnv(given)

		if (given.emailEnabled === 'true') {
			vi.mocked(newEmailClients).mockReturnValue({
				simple: {
					send: createSendMock()
				},
				resend: {} as Resend
			})
		}

		try {
			authCore(env, {} as never)
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : '',
				emailAndPasswordEnabled: false,
				disableSignUp: true,
				requireEmailVerification: true,
				hasSendVerificationEmail: false,
				hasSendResetPassword: false
			}
		}

		const options = vi.mocked(betterAuth).mock.calls[0]?.[0] as {
			emailAndPassword?: {
				enabled?: boolean
				disableSignUp?: boolean
				requireEmailVerification?: boolean
				sendResetPassword?: unknown
			}
			emailVerification?: {
				sendVerificationEmail?: unknown
			}
		}

		return {
			error: '',
			emailAndPasswordEnabled: Boolean(options?.emailAndPassword?.enabled),
			disableSignUp: Boolean(options?.emailAndPassword?.disableSignUp),
			requireEmailVerification: Boolean(options?.emailAndPassword?.requireEmailVerification),
			hasSendVerificationEmail:
				typeof options?.emailVerification?.sendVerificationEmail === 'function',
			hasSendResetPassword: typeof options?.emailAndPassword?.sendResetPassword === 'function'
		}
	})
})

describe('authCore email callbacks', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		emailEnabled: string
		emailSignupEnabled: string
		emailRequireVerification: string
		cooldownSeconds: string
		emailResendApiKey: string
		emailFrom: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		sendCallCount: number
		firstSubject: string
		secondSubject: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'send verification and reset emails through email client callbacks',
			given: 'email auth enabled with resend provider config',
			when: 'calling sendVerificationEmail and sendResetPassword callbacks',
			then: 'email client send is called with expected subjects',
			givenDetail: {
				emailEnabled: 'true',
				emailSignupEnabled: 'true',
				emailRequireVerification: 'true',
				cooldownSeconds: '50',
				emailResendApiKey: 'resend-api-key',
				emailFrom: 'Auth <auth@mg.example.com>'
			},
			whenDetail: {},
			thenExpected: {
				sendCallCount: 2,
				firstSubject: 'Verify your email',
				secondSubject: 'Reset your password'
			}
		}
	]

	runCases(cases, async (given) => {
		const send = createSendMock()
		vi.mocked(newEmailClients).mockReturnValue({
			simple: { send },
			resend: {} as Resend
		})
		vi.mocked(betterAuth).mockImplementation((options) => {
			return options as never
		})

		const auth = authCore(createEnv(given), {} as never) as unknown as {
			emailVerification: {
				sendVerificationEmail: (data: {
					user: { email: string }
					url: string
				}) => Promise<void>
			}
			emailAndPassword: {
				sendResetPassword: (data: {
					user: { email: string }
					url: string
				}) => Promise<void>
			}
		}

		await auth.emailVerification.sendVerificationEmail({
			user: {
				email: 'u1@example.com'
			},
			url: 'https://app.example.com/verify-email?token=t1'
		})
		await auth.emailAndPassword.sendResetPassword({
			user: {
				email: 'u1@example.com'
			},
			url: 'https://app.example.com/reset-password?token=t2'
		})

		expect(send).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				to: 'u1@example.com',
				subject: 'Verify your email'
			})
		)
		expect(send).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				to: 'u1@example.com',
				subject: 'Reset your password'
			})
		)

		const firstCall = send.mock.calls[0]?.[0] as { subject: string } | undefined
		const secondCall = send.mock.calls[1]?.[0] as { subject: string } | undefined
		return {
			sendCallCount: send.mock.calls.length,
			firstSubject: firstCall?.subject ?? '',
			secondSubject: secondCall?.subject ?? ''
		}
	})
})

function createEnv(input: {
	emailEnabled: string
	emailSignupEnabled: string
	emailRequireVerification: string
	cooldownSeconds: string
	emailResendApiKey: string
	emailFrom: string
}): Env {
	const env = {
		APP_BASE_URL: 'http://localhost:5173',
		BETTER_AUTH_SECRET: 'secret',
		GOOGLE_AUTH_ENABLED: 'false',
		GOOGLE_CLIENT_ID: '',
		GOOGLE_CLIENT_SECRET: '',
		EMAIL_ENABLED: input.emailEnabled,
		EMAIL_SIGNUP_ENABLED: input.emailSignupEnabled,
		EMAIL_REQUIRE_VERIFICATION: input.emailRequireVerification,
		EMAIL_USER_ACTION_COOLDOWN_SECONDS: input.cooldownSeconds,
		EMAIL_RESEND_API_KEY: input.emailResendApiKey,
		EMAIL_FROM: input.emailFrom,
		EMAIL_SIGNUP_DOMAIN_ALLOWLIST: '',
		BETA_CODE_ENABLED: 'false',
		ADMIN_SECRET: 'admin-secret'
	}
	return env as unknown as Env
}

function createSendMock() {
	return vi.fn(async (_input: EmailSimpleSendInput): Promise<void> => {
		return
	})
}
