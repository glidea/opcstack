import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import { authCore } from './index'
import { betterAuth } from 'better-auth'
import { bearer, captcha, emailOTP, genericOAuth, jwt } from 'better-auth/plugins'
import { oauthProvider } from '@better-auth/oauth-provider'
import { createEmailClients, type EmailSimpleSendInput } from '../../email'
import type { Resend } from 'resend'
import type { AuthRuntimeConfig } from '../../config'

const creditServiceMocks = vi.hoisted(() => {
	return {
		constructorArgs: [] as unknown[][],
		createBalance: vi.fn(),
		grant: vi.fn()
	}
})

const shardRouterMocks = vi.hoisted(() => {
	return {
		openUserDb: vi.fn()
	}
})

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
		jwt: vi.fn(() => {
			return { id: 'jwt' }
		}),
		emailOTP: vi.fn((options) => {
			return { id: 'email-otp', options }
		}),
		captcha: vi.fn((options) => {
			return { id: 'captcha', options }
		}),
		genericOAuth: vi.fn((options) => {
			return { id: 'generic-oauth', options }
		})
	}
})

vi.mock('@better-auth/oauth-provider', () => {
	return {
		oauthProvider: vi.fn((options) => {
			return { id: 'oauth-provider', options }
		})
	}
})

vi.mock('../../email', () => {
	return {
		createEmailClients: vi.fn()
	}
})

vi.mock('../../credits', async () => {
	const actual = await vi.importActual<typeof import('../../credits')>('../../credits')
	return {
		...actual,
		CreditsService: vi.fn().mockImplementation(function CreditsService(...args: unknown[]) {
			creditServiceMocks.constructorArgs.push(args)
			return creditServiceMocks
		})
	}
})

vi.mock('../../db/shard-router', () => {
	return {
		resolveD1ShardRegion: (): string => {
			return 'wnam'
		},
		createTenantShardAccess: vi.fn(() => {
			return {
				openUserDb: shardRouterMocks.openUserDb
			}
		})
	}
})

describe('authCore email config mapping', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(betterAuth).mockReturnValue({} as never)
		vi.mocked(createEmailClients).mockReturnValue({
			simple: {
				send: createSendMock()
			},
			resend: {} as Resend
		})
	})

	type GivenDetail = {
		emailEnabled: boolean
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
			scenario: 'enable email and password with signup and verification switches',
			given: 'email signup enabled',
			when: 'building auth core',
			then: 'email config is mapped to better auth options',
			givenDetail: {
				emailEnabled: true,
				emailSignupEnabled: 'true',
				emailRequireVerification: 'true',
				cooldownSeconds: '50',
				emailResendApiKey: 'resend-api-key',
				emailFrom: 'auth@mg.example.com'
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
			scenario: 'allow email auth even when provider config is missing',
			given: 'provider config missing',
			when: 'building auth core',
			then: 'email auth config is still built',
			givenDetail: {
				emailEnabled: false,
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
				requireEmailVerification: false,
				hasEmailOtpPlugin: true,
				hasSendResetPassword: false
			}
		},
		{
			scenario: 'disable signup when email delivery is disabled',
			given: 'signup switch enabled without an email provider',
			when: 'building auth core',
			then: 'email password login remains enabled but signup is disabled',
			givenDetail: {
				emailEnabled: false,
				emailSignupEnabled: 'true',
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
				requireEmailVerification: false,
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
				emailEnabled: true,
				emailSignupEnabled: 'false',
				emailRequireVerification: 'true',
				cooldownSeconds: '0',
				emailResendApiKey: 'resend-api-key',
				emailFrom: 'auth@mg.example.com'
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
		const env = createEnv()

		try {
			authCore(env, {} as never, createAuthRuntimeConfig(given))
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

describe('authCore agent OAuth provider', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(betterAuth).mockReturnValue({} as never)
		vi.mocked(createEmailClients).mockReturnValue({
			simple: {
				send: createSendMock()
			},
			resend: {} as Resend
		})
	})

	it('configures the official Agent OAuth boundary', () => {
		const env = createEnv()

		authCore(env, {} as never, createAuthRuntimeConfig())

		const options = vi.mocked(oauthProvider).mock.calls[0]?.[0]
		const authOptions = vi.mocked(betterAuth).mock.calls[0]?.[0] as {
			plugins?: Array<{ id?: string }>
		}

		expect({
			hasPlugin: authOptions.plugins?.some((plugin) => plugin.id === 'oauth-provider'),
			hasJwtPlugin: authOptions.plugins?.some((plugin) => plugin.id === 'jwt'),
			scopes: options?.scopes,
			validAudiences: options?.validAudiences,
			grantTypes: options?.grantTypes,
			accessTokenExpiresIn: options?.accessTokenExpiresIn,
			refreshTokenExpiresIn: options?.refreshTokenExpiresIn,
			loginPage: options?.loginPage,
			consentPage: options?.consentPage,
			storeTokens: options?.storeTokens
		}).toEqual({
			hasPlugin: true,
			hasJwtPlugin: true,
			scopes: ['agent', 'offline_access'],
			validAudiences: ['http://localhost:5173'],
			grantTypes: ['authorization_code', 'refresh_token'],
			accessTokenExpiresIn: 15 * 60,
			refreshTokenExpiresIn: 30 * 24 * 60 * 60,
			loginPage: '/agent/authorize',
			consentPage: '/agent/consent',
			storeTokens: 'hashed'
		})
	})

	it('binds OAuth tokens to the active Agent grant and its application scopes', async () => {
		const env = createEnv()
		const grant = {
			id: 'grant-1',
			userId: 'user-1',
			clientId: 'opcstack-agent',
			scopes: 'reports:read',
			status: 'active',
			createdAt: 1,
			approvedAt: 2,
			revokedAt: null
		}
		const db = {
			run: vi.fn().mockResolvedValue(undefined),
			query: {
				agentGrant: {
					findFirst: vi.fn().mockResolvedValue(grant)
				}
			}
		} as never

		authCore(env, db, createAuthRuntimeConfig())
		const options = vi.mocked(oauthProvider).mock.calls[0]?.[0] as {
			postLogin?: {
				consentReferenceId: (input: { user: { id: string } }) => Promise<string>
			}
			customAccessTokenClaims?: (input: {
				user: { id: string }
				referenceId: string
			}) => Promise<Record<string, unknown>>
		}

		const referenceId = await options.postLogin?.consentReferenceId({ user: { id: 'user-1' } })
		const claims = await options.customAccessTokenClaims?.({
			user: { id: 'user-1' },
			referenceId: 'grant-1'
		})

		expect(referenceId).toBe('grant-1')
		expect(claims).toEqual({
			grant_id: 'grant-1',
			agent_scopes: ['reports:read'],
			agent_grant_status: 'active'
		})
	})
})

describe('authCore turnstile config mapping', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(betterAuth).mockReturnValue({} as never)
		vi.mocked(createEmailClients).mockReturnValue({
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
		const config = createAuthRuntimeConfig({
			emailEnabled: true,
			emailSignupEnabled: 'true',
			emailRequireVerification: 'true',
			cooldownSeconds: '50',
			emailResendApiKey: 'resend-api-key',
			emailFrom: 'auth@mg.example.com'
		})
		config.authentication.turnstile = {
			enabled: given.turnstileEnabled === 'true',
			siteKey: given.turnstileSiteKey || null,
			secretKey: given.turnstileSecretKey || null
		}

		authCore(createEnv(), {} as never, config)
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
		emailEnabled: boolean
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
				emailEnabled: true,
				emailSignupEnabled: 'true',
				emailRequireVerification: 'true',
				cooldownSeconds: '50',
				emailResendApiKey: 'resend-api-key',
				emailFrom: 'auth@mg.example.com'
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
		vi.mocked(createEmailClients).mockReturnValue({
			simple: { send },
			resend: {} as Resend
		})
		vi.mocked(betterAuth).mockImplementation((options) => {
			return options as never
		})

		const auth = authCore(createEnv(), {} as never, createAuthRuntimeConfig(given)) as unknown as {
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

describe('authCore user create hook', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		creditServiceMocks.constructorArgs = []
		shardRouterMocks.openUserDb.mockResolvedValue({
			shardId: 'shard_0001',
			bindingName: 'TENANT_DB_0001',
			db: { name: 'tenant-db' }
		})
		creditServiceMocks.createBalance.mockResolvedValue(undefined)
		creditServiceMocks.grant.mockResolvedValue({
			balance: 0,
			entryId: '',
			transactionId: '',
			entryRemainingAmount: 0,
			duplicated: false
		})
		vi.mocked(createEmailClients).mockReturnValue({
			simple: {
				send: createSendMock()
			},
			resend: {} as Resend
		})
		vi.mocked(betterAuth).mockImplementation((options) => {
			return options as never
		})
	})

	type GivenDetail = {
		creditsSignupEnabled: string
		creditsSignupAmount: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		openUserDbCalls: number
		createBalanceCalls: number
		grantCalls: number
		createBalanceUserId: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'create zero credit balance when signup reward is disabled',
			given: 'credits signup reward disabled',
			when: 'better auth creates user',
			then: 'tenant credit balance is initialized without grant transaction',
			givenDetail: {
				creditsSignupEnabled: 'false',
				creditsSignupAmount: '0'
			},
			whenDetail: {},
			thenExpected: {
				openUserDbCalls: 1,
				createBalanceCalls: 1,
				grantCalls: 0,
				createBalanceUserId: 'u1'
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		const env: Env = createEnv()
		type CreditSignupTestEnv = Omit<Env, 'CREDITS_SIGNUP_ENABLED' | 'CREDITS_SIGNUP_AMOUNT'> & {
			CREDITS_SIGNUP_ENABLED: string
			CREDITS_SIGNUP_AMOUNT: string
		}
		const testEnv = env as CreditSignupTestEnv
		testEnv.CREDITS_SIGNUP_ENABLED = given.creditsSignupEnabled
		testEnv.CREDITS_SIGNUP_AMOUNT = given.creditsSignupAmount

		const auth = authCore(
			testEnv as unknown as Env,
			{} as never,
			createAuthRuntimeConfig({
				emailEnabled: true,
				emailSignupEnabled: 'true',
				emailRequireVerification: 'false',
				cooldownSeconds: '50',
				emailResendApiKey: 'resend-api-key',
				emailFrom: 'auth@mg.example.com'
			})
		) as unknown as {
			databaseHooks: {
				user: {
					create: {
						after: (createdUser: Record<string, unknown>) => Promise<void>
					}
				}
			}
		}
		await auth.databaseHooks.user.create.after({ id: 'u1' })

		const createBalanceInput = creditServiceMocks.createBalance.mock.calls[0]?.[0] as
			| { userId: string }
			| undefined
		return {
			openUserDbCalls: shardRouterMocks.openUserDb.mock.calls.length,
			createBalanceCalls: creditServiceMocks.createBalance.mock.calls.length,
			grantCalls: creditServiceMocks.grant.mock.calls.length,
			createBalanceUserId: createBalanceInput?.userId ?? ''
		}
	})
})

describe('authCore registration attribution', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(createEmailClients).mockReturnValue({
			simple: {
				send: createSendMock()
			},
			resend: {} as Resend
		})
		vi.mocked(betterAuth).mockImplementation((options) => {
			return options as never
		})
	})

	type GivenDetail = {
		cookie: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		registrationUtmSource: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'persist registration utm source',
			given: 'signup request has registration utm source cookie',
			when: 'better auth creates user',
			then: 'user create data includes registration utm source',
			givenDetail: {
				cookie: 'registration_utm_source=docs'
			},
			whenDetail: {},
			thenExpected: {
				registrationUtmSource: 'docs'
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		const auth = authCore(
			createEnv(),
			{
				query: {
					user: {
						findFirst: async (): Promise<undefined> => undefined
					}
				}
			} as never,
			createAuthRuntimeConfig({
				emailEnabled: true,
				emailSignupEnabled: 'true',
				emailRequireVerification: 'false',
				cooldownSeconds: '50',
				emailResendApiKey: 'resend-api-key',
				emailFrom: 'auth@mg.example.com'
			})
		) as unknown as {
			databaseHooks: {
				user: {
					create: {
						before: (
							userData: Record<string, unknown>,
							context: { headers: Headers } | null
						) => Promise<{ data: Record<string, unknown> }>
					}
				}
			}
		}

		const result = await auth.databaseHooks.user.create.before(
			{ id: 'u1', email: 'u1@example.com' },
			{ headers: new Headers({ cookie: given.cookie }) }
		)

		return {
			registrationUtmSource: String(result.data['registrationUtmSource'] ?? '')
		}
	})
})

describe('authCore social provider config mapping', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(betterAuth).mockReturnValue({} as never)
		vi.mocked(createEmailClients).mockReturnValue({
			simple: {
				send: createSendMock()
			},
			resend: {} as Resend
		})
	})

	type GivenDetail = {
		googleAuthEnabled: string
		googleClientId: string
		googleClientSecret: string
		githubAuthEnabled: string
		githubClientId: string
		githubClientSecret: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		hasGoogleProvider: boolean
		googleClientId: string
		googleClientSecret: string
		hasGithubProvider: boolean
		githubClientId: string
		githubClientSecret: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'register github social provider when enabled',
			given: 'github auth switch enabled',
			when: 'building auth core',
			then: 'github provider is configured',
			givenDetail: {
				googleAuthEnabled: 'false',
				googleClientId: '',
				googleClientSecret: '',
				githubAuthEnabled: 'true',
				githubClientId: 'github-client-id',
				githubClientSecret: 'github-client-secret'
			},
			whenDetail: {},
			thenExpected: {
				hasGoogleProvider: false,
				googleClientId: '',
				googleClientSecret: '',
				hasGithubProvider: true,
				githubClientId: 'github-client-id',
				githubClientSecret: 'github-client-secret'
			}
		},
		{
			scenario: 'skip github social provider when disabled',
			given: 'github auth switch disabled',
			when: 'building auth core',
			then: 'github provider is not configured',
			givenDetail: {
				googleAuthEnabled: 'false',
				googleClientId: '',
				googleClientSecret: '',
				githubAuthEnabled: 'false',
				githubClientId: 'github-client-id',
				githubClientSecret: 'github-client-secret'
			},
			whenDetail: {},
			thenExpected: {
				hasGoogleProvider: false,
				googleClientId: '',
				googleClientSecret: '',
				hasGithubProvider: false,
				githubClientId: '',
				githubClientSecret: ''
			}
		},
		{
			scenario: 'register google and github social providers together',
			given: 'google and github auth switches enabled',
			when: 'building auth core',
			then: 'both social providers are configured',
			givenDetail: {
				googleAuthEnabled: 'true',
				googleClientId: 'google-client-id',
				googleClientSecret: 'google-client-secret',
				githubAuthEnabled: 'true',
				githubClientId: 'github-client-id',
				githubClientSecret: 'github-client-secret'
			},
			whenDetail: {},
			thenExpected: {
				hasGoogleProvider: true,
				googleClientId: 'google-client-id',
				googleClientSecret: 'google-client-secret',
				hasGithubProvider: true,
				githubClientId: 'github-client-id',
				githubClientSecret: 'github-client-secret'
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		const config = createAuthRuntimeConfig()
		config.authentication.providers.google = {
			enabled: given.googleAuthEnabled === 'true',
			clientId: given.googleClientId || null,
			clientSecret: given.googleClientSecret || null
		}
		config.authentication.providers.github = {
			enabled: given.githubAuthEnabled === 'true',
			clientId: given.githubClientId || null,
			clientSecret: given.githubClientSecret || null
		}

		authCore(createEnv(), {} as never, config)
		const options = vi.mocked(betterAuth).mock.calls[0]?.[0] as {
			socialProviders?: {
				google?: {
					clientId: string
					clientSecret: string
				}
				github?: {
					clientId: string
					clientSecret: string
				}
			}
		}

		return {
			hasGoogleProvider: Boolean(options.socialProviders?.google),
			googleClientId: options.socialProviders?.google?.clientId ?? '',
			googleClientSecret: options.socialProviders?.google?.clientSecret ?? '',
			hasGithubProvider: Boolean(options.socialProviders?.github),
			githubClientId: options.socialProviders?.github?.clientId ?? '',
			githubClientSecret: options.socialProviders?.github?.clientSecret ?? ''
		}
	})
})

describe('authCore linuxdo oauth config mapping', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(betterAuth).mockReturnValue({} as never)
		vi.mocked(createEmailClients).mockReturnValue({
			simple: {
				send: createSendMock()
			},
			resend: {} as Resend
		})
	})

	type GivenDetail = {
		linuxdoAuthEnabled: string
		linuxdoClientId: string
		linuxdoClientSecret: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		hasGenericOAuthPlugin: boolean
		providerId: string
		clientId: string
		clientSecret: string
		authorizationUrl: string
		tokenUrl: string
		userInfoUrl: string
		authentication: string
		mappedId: string
		mappedEmail: string
		mappedEmailVerified: boolean
		mappedName: string
		mappedImage: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'skip linuxdo oauth when disabled',
			given: 'linuxdo auth switch disabled',
			when: 'building auth core',
			then: 'generic oauth plugin is not registered',
			givenDetail: {
				linuxdoAuthEnabled: 'false',
				linuxdoClientId: 'linuxdo-client-id',
				linuxdoClientSecret: 'linuxdo-client-secret'
			},
			whenDetail: {},
			thenExpected: {
				hasGenericOAuthPlugin: false,
				providerId: '',
				clientId: '',
				clientSecret: '',
				authorizationUrl: '',
				tokenUrl: '',
				userInfoUrl: '',
				authentication: '',
				mappedId: '',
				mappedEmail: '',
				mappedEmailVerified: false,
				mappedName: '',
				mappedImage: ''
			}
		},
		{
			scenario: 'register linuxdo oauth when enabled',
			given: 'linuxdo auth switch enabled',
			when: 'building auth core',
			then: 'generic oauth plugin maps linuxdo user to better auth user',
			givenDetail: {
				linuxdoAuthEnabled: 'true',
				linuxdoClientId: 'linuxdo-client-id',
				linuxdoClientSecret: 'linuxdo-client-secret'
			},
			whenDetail: {},
			thenExpected: {
				hasGenericOAuthPlugin: true,
				providerId: 'linuxdo',
				clientId: 'linuxdo-client-id',
				clientSecret: 'linuxdo-client-secret',
				authorizationUrl: 'https://connect.linux.do/oauth2/authorize',
				tokenUrl: 'https://connect.linux.do/oauth2/token',
				userInfoUrl: 'https://connect.linux.do/api/user',
				authentication: 'basic',
				mappedId: '123',
				mappedEmail: 'linuxdo-123@linuxdo.local',
				mappedEmailVerified: true,
				mappedName: 'Linux DO User',
				mappedImage: 'https://connect.linux.do/user_avatar/connect.linux.do/demo/96/1.png'
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		const config = createAuthRuntimeConfig()
		config.authentication.providers.linuxdo = {
			enabled: given.linuxdoAuthEnabled === 'true',
			clientId: given.linuxdoClientId || null,
			clientSecret: given.linuxdoClientSecret || null
		}

		authCore(createEnv(), {} as never, config)
		const authOptions = vi.mocked(betterAuth).mock.calls[0]?.[0] as {
			plugins?: Array<{ id?: string }>
		}
		const genericOAuthOptions = vi.mocked(genericOAuth).mock.calls[0]?.[0] as
			| {
					config: Array<{
						providerId: string
						clientId: string
						clientSecret: string
						authorizationUrl: string
						tokenUrl: string
						userInfoUrl: string
						authentication: string
						mapProfileToUser: (profile: Record<string, unknown>) => {
							id?: string
							email?: string
							emailVerified?: boolean
							name?: string
							image?: string
						}
					}>
			  }
			| undefined
		const oauthConfig = genericOAuthOptions?.config[0]
		const mappedUser =
			oauthConfig?.mapProfileToUser({
				id: 123,
				username: 'demo',
				name: 'Linux DO User',
				avatar_template: '/user_avatar/connect.linux.do/demo/{size}/1.png'
			}) ?? {}

		return {
			hasGenericOAuthPlugin:
				authOptions.plugins?.some((plugin: { id?: string }) => plugin.id === 'generic-oauth') ??
				false,
			providerId: oauthConfig?.providerId ?? '',
			clientId: oauthConfig?.clientId ?? '',
			clientSecret: oauthConfig?.clientSecret ?? '',
			authorizationUrl: oauthConfig?.authorizationUrl ?? '',
			tokenUrl: oauthConfig?.tokenUrl ?? '',
			userInfoUrl: oauthConfig?.userInfoUrl ?? '',
			authentication: oauthConfig?.authentication ?? '',
			mappedId: mappedUser.id ?? '',
			mappedEmail: mappedUser.email ?? '',
			mappedEmailVerified: mappedUser.emailVerified ?? false,
			mappedName: mappedUser.name ?? '',
			mappedImage: mappedUser.image ?? ''
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

function createEnv(): Env {
	const env = {
		APP_BASE_URL: 'http://localhost:5173',
		BETTER_AUTH_SECRET: 'secret',
		CREDITS_SIGNUP_ENABLED: 'false',
		CREDITS_SIGNUP_AMOUNT: '0'
	}
	return env as unknown as Env
}

function createAuthRuntimeConfig(input?: {
	emailEnabled: boolean
	emailSignupEnabled: string
	emailRequireVerification: string
	cooldownSeconds: string
	emailResendApiKey: string
	emailFrom: string
}): AuthRuntimeConfig {
	return {
		systemEmail: 'admin@opcstack.local',
		authentication: {
			betaCodeEnabled: false,
			emailSignupEnabled: input?.emailSignupEnabled === 'true',
			emailSignupDomainAllowlist: [],
			emailRequireVerification: input?.emailRequireVerification === 'true',
			emailUserActionCooldownSeconds: Number(input?.cooldownSeconds ?? '50'),
			turnstile: {
				enabled: false,
				siteKey: null,
				secretKey: null
			},
			providers: {
				google: { enabled: false, clientId: null, clientSecret: null },
				github: { enabled: false, clientId: null, clientSecret: null },
				linuxdo: { enabled: false, clientId: null, clientSecret: null }
			}
		},
		email: {
			enabled: input?.emailEnabled ?? false,
			provider: input?.emailResendApiKey ? 'resend' : null,
			resendApiKey: input?.emailResendApiKey || null
		}
	}
}

function createSendMock() {
	return vi.fn(async (_input: EmailSimpleSendInput): Promise<void> => {
		return
	})
}
