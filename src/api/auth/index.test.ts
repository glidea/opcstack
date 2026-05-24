import { beforeEach, describe, expect, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import { authCore } from './index'
import { betterAuth } from 'better-auth'
import { bearer, captcha, emailOTP } from 'better-auth/plugins'
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

vi.mock('better-auth/plugins', () => {
	return {
		bearer: vi.fn(() => {
			return { id: 'bearer' }
		}),
		emailOTP: vi.fn((options) => {
			return { id: 'email-otp', options }
		}),
		captcha: vi.fn((options) => {
			return { id: 'captcha', options }
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
		hasEmailOtpPlugin: boolean
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
				hasEmailOtpPlugin: false,
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
				hasEmailOtpPlugin: true,
				hasSendResetPassword: false
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
				hasEmailOtpPlugin: false,
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
				hasEmailOtpPlugin: true,
				hasSendResetPassword: false
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
				hasEmailOtpPlugin: true,
				hasSendResetPassword: false
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
				hasEmailOtpPlugin: false,
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
			plugins?: Array<{ id?: string }>
		}

		return {
			error: '',
			emailAndPasswordEnabled: Boolean(options?.emailAndPassword?.enabled),
			disableSignUp: Boolean(options?.emailAndPassword?.disableSignUp),
			requireEmailVerification: Boolean(options?.emailAndPassword?.requireEmailVerification),
			hasEmailOtpPlugin:
				options?.plugins?.some((plugin: { id?: string }) => plugin.id === 'email-otp') ?? false,
			hasSendResetPassword: typeof options?.emailAndPassword?.sendResetPassword === 'function'
		}
	})
})

describe('authCore turnstile config mapping', () => {
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
		turnstileEnabled: string
		turnstileSiteKey: string
		turnstileSecretKey: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		hasCaptchaPlugin: boolean
		provider: string
		secretKey: string
		endpoints: string[]
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'skip captcha when turnstile is disabled',
			given: 'turnstile switch disabled',
			when: 'building auth core',
			then: 'captcha plugin is not registered',
			givenDetail: {
				turnstileEnabled: 'false',
				turnstileSiteKey: '',
				turnstileSecretKey: ''
			},
			whenDetail: {},
			thenExpected: {
				hasCaptchaPlugin: false,
				provider: '',
				secretKey: '',
				endpoints: []
			}
		},
		{
			scenario: 'register turnstile captcha for auth endpoints',
			given: 'turnstile switch enabled and keys configured',
			when: 'building auth core',
			then: 'captcha plugin protects email auth endpoints',
			givenDetail: {
				turnstileEnabled: 'true',
				turnstileSiteKey: 'site-key',
				turnstileSecretKey: 'secret-key'
			},
			whenDetail: {},
			thenExpected: {
				hasCaptchaPlugin: true,
				provider: 'cloudflare-turnstile',
				secretKey: 'secret-key',
				endpoints: ['/sign-up/email', '/sign-in/email', '/email-otp/request-password-reset']
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		const env: Env = createEnv({
			emailEnabled: 'true',
			emailSignupEnabled: 'true',
			emailRequireVerification: 'true',
			cooldownSeconds: '50',
			emailResendApiKey: 'resend-api-key',
			emailFrom: 'Auth <auth@mg.example.com>'
		})
		type TurnstileTestEnv = Omit<
			Env,
			'TURNSTILE_ENABLED' | 'TURNSTILE_SITE_KEY' | 'TURNSTILE_SECRET_KEY'
		> & {
			TURNSTILE_ENABLED: string
			TURNSTILE_SITE_KEY: string
			TURNSTILE_SECRET_KEY: string
		}
		const testEnv = env as TurnstileTestEnv
		testEnv.TURNSTILE_ENABLED = given.turnstileEnabled
		testEnv.TURNSTILE_SITE_KEY = given.turnstileSiteKey
		testEnv.TURNSTILE_SECRET_KEY = given.turnstileSecretKey

		authCore(testEnv as unknown as Env, {} as never)
		const options = vi.mocked(captcha).mock.calls[0]?.[0] as
			| {
					provider: string
					secretKey: string
					endpoints: string[]
			  }
			| undefined

		const authOptions = vi.mocked(betterAuth).mock.calls[0]?.[0] as {
			plugins?: Array<{ id?: string }>
		}

		return {
			hasCaptchaPlugin:
				authOptions.plugins?.some((plugin: { id?: string }) => plugin.id === 'captcha') ?? false,
			provider: options?.provider ?? '',
			secretKey: options?.secretKey ?? '',
			endpoints: options?.endpoints ?? []
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
		firstHtmlIncludesOtp: boolean
		firstHtmlIncludesUrl: boolean
		otpLength: number
		otpExpiresIn: number
		otpAllowedAttempts: number
		otpStore: string
		otpDisableSignUp: boolean
		otpSendVerificationOnSignUp: boolean
		otpOverrideDefaultEmailVerification: boolean
		emailVerificationSendOnSignUp: boolean
		emailAutoSignInAfterVerification: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'send verification and reset emails through email otp callbacks',
			given: 'email auth enabled with resend provider config',
			when: 'calling sendVerificationOTP callbacks',
			then: 'email client send is called with otp email subjects',
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
				secondSubject: 'Reset your password',
				firstHtmlIncludesOtp: true,
				firstHtmlIncludesUrl: false,
				otpLength: 6,
				otpExpiresIn: 300,
				otpAllowedAttempts: 3,
				otpStore: 'hashed',
				otpDisableSignUp: true,
				otpSendVerificationOnSignUp: false,
				otpOverrideDefaultEmailVerification: true,
				emailVerificationSendOnSignUp: false,
				emailAutoSignInAfterVerification: true
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
			plugins: Array<{ id: string }>
		}

		expect(auth.plugins).toContainEqual({ id: 'bearer' })
		expect(vi.mocked(bearer)).toHaveBeenCalledTimes(1)

		const emailOtpOptions = vi.mocked(emailOTP).mock.calls[0]?.[0] as
			| {
					otpLength: number
					expiresIn: number
					allowedAttempts: number
					storeOTP: string
					disableSignUp: boolean
					sendVerificationOnSignUp: boolean
					overrideDefaultEmailVerification: boolean
					sendVerificationOTP: (data: {
						email: string
						otp: string
						type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email'
					}) => Promise<void>
			  }
			| undefined

		await emailOtpOptions?.sendVerificationOTP({
			email: 'u1@example.com',
			otp: '123456',
			type: 'email-verification'
		})
		await emailOtpOptions?.sendVerificationOTP({
			email: 'u1@example.com',
			otp: '654321',
			type: 'forget-password'
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

		const firstCall = send.mock.calls[0]?.[0] as
			| { subject: string; html: string }
			| undefined
		const secondCall = send.mock.calls[1]?.[0] as { subject: string } | undefined
		return {
			sendCallCount: send.mock.calls.length,
			firstSubject: firstCall?.subject ?? '',
			secondSubject: secondCall?.subject ?? '',
			firstHtmlIncludesOtp: firstCall?.html.includes('123456') ?? false,
			firstHtmlIncludesUrl: firstCall?.html.includes('verify-email?token=') ?? false,
			otpLength: emailOtpOptions?.otpLength ?? 0,
			otpExpiresIn: emailOtpOptions?.expiresIn ?? 0,
			otpAllowedAttempts: emailOtpOptions?.allowedAttempts ?? 0,
			otpStore: emailOtpOptions?.storeOTP ?? '',
			otpDisableSignUp: emailOtpOptions?.disableSignUp ?? false,
			otpSendVerificationOnSignUp: emailOtpOptions?.sendVerificationOnSignUp ?? true,
			otpOverrideDefaultEmailVerification: emailOtpOptions?.overrideDefaultEmailVerification ?? false,
			emailVerificationSendOnSignUp: readEmailVerificationSendOnSignUp(),
			emailAutoSignInAfterVerification: readEmailAutoSignInAfterVerification()
		}
	})
})

function readEmailVerificationSendOnSignUp(): boolean {
	const options = vi.mocked(betterAuth).mock.calls[0]?.[0] as {
		emailVerification?: {
			sendOnSignUp?: boolean
		}
	}
	return options.emailVerification?.sendOnSignUp ?? true
}

function readEmailAutoSignInAfterVerification(): boolean {
	const options = vi.mocked(betterAuth).mock.calls[0]?.[0] as {
		emailVerification?: {
			autoSignInAfterVerification?: boolean
		}
	}
	return options.emailVerification?.autoSignInAfterVerification ?? false
}

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
