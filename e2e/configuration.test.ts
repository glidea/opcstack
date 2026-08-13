import { beforeAll, describe, expect, test } from 'vitest'
import { getAdminSessionCookie } from './support/auth'

type GeneralConfig = {
	docs_enabled: boolean
	version: number
}

type SecretMutation = { action: 'keep' } | { action: 'remove' }

type AuthenticationConfig = {
	beta_code_enabled: boolean
	registration_enabled: boolean
	email_signup_domain_allowlist: string[]
	email_require_verification: boolean
	email_user_action_cooldown_seconds: number
	turnstile_enabled: boolean
	google_auth_enabled: boolean
	google_client_id: string | null
	google_client_secret_configured: boolean
	google_callback_url: string
	github_auth_enabled: boolean
	github_client_id: string | null
	github_client_secret_configured: boolean
	github_callback_url: string
	linuxdo_auth_enabled: boolean
	linuxdo_client_id: string | null
	linuxdo_client_secret_configured: boolean
	linuxdo_callback_url: string
	version: number
}

type EmailConfig = {
	provider: 'cloudflare' | 'resend' | null
	resend_api_key_configured: boolean
	version: number
}

const appBaseUrl: string = process.env['APP_BASE_URL'] ?? 'http://localhost:5173'
const remote: boolean = process.env['E2E_REMOTE'] === '1'
let adminSessionCookie: string

describe.skipIf(remote)('dynamic configuration e2e', () => {
	beforeAll(async (): Promise<void> => {
		const response: Response = await fetch(`${appBaseUrl}/api/health`)
		if (response.status !== 200) {
			throw new Error('dev server is not ready for e2e tests')
		}
		adminSessionCookie = await getAdminSessionCookie(appBaseUrl)
	})

	test('saved General configuration affects the next operation', async (): Promise<void> => {
		const originalGeneral: GeneralConfig = await readConfig<GeneralConfig>('get_general_config')
		let generalVersion: number = originalGeneral.version
		try {
			const generalResponse: Response = await callAdminConfig('update_general_config', {
				docs_enabled: false,
				expected_version: generalVersion
			})
			const savedGeneral: GeneralConfig = await readJson<GeneralConfig>(generalResponse)
			generalVersion = savedGeneral.version
			const generalBookmark: string = requireBookmark(generalResponse)

			const pageResponse: Response = await fetch(`${appBaseUrl}/en`, {
				headers: {
					cookie: `d1_meta_bookmark=${encodeURIComponent(generalBookmark)}`
				}
			})
			const pageHtml: string = await pageResponse.text()
			expect(pageHtml).toMatch(/data-design="(?:apple-saas|brutalism)"/)
			expect(pageHtml).not.toContain('href="/en/docs"')

			const docsResponse: Response = await fetch(`${appBaseUrl}/en/docs`, {
				headers: {
					cookie: `d1_meta_bookmark=${encodeURIComponent(generalBookmark)}`
				}
			})
			expect(docsResponse.status).toBe(404)

		} finally {
			await callAdminConfig('update_general_config', {
				docs_enabled: originalGeneral.docs_enabled,
				expected_version: generalVersion
			})
		}
	})

	test('saved Authentication and Email configuration affects the next auth request', async (): Promise<void> => {
		const originalAuthentication: AuthenticationConfig =
			await readConfig<AuthenticationConfig>('get_authentication_config')
		const originalEmail: EmailConfig = await readConfig<EmailConfig>('get_email_config')
		let authenticationVersion: number = originalAuthentication.version
		let emailVersion: number = originalEmail.version
		let bookmark: string | undefined

		try {
			const emailResponse: Response = await callAdminConfig(
				'update_email_config',
				{
					provider: 'cloudflare',
					resend_api_key: { action: 'keep' },
					expected_version: emailVersion
				},
				bookmark
			)
			const enabledEmail: EmailConfig = await readJson<EmailConfig>(emailResponse)
			emailVersion = enabledEmail.version
			bookmark = requireBookmark(emailResponse)

			const authenticationResponse: Response = await callAdminConfig(
				'update_authentication_config',
				buildAuthenticationUpdate(originalAuthentication, authenticationVersion, {
					registrationEnabled: true
				}),
				bookmark
			)
			const enabledAuthentication: AuthenticationConfig =
				await readJson<AuthenticationConfig>(authenticationResponse)
			authenticationVersion = enabledAuthentication.version
			bookmark = requireBookmark(authenticationResponse)

			expect({
				google: enabledAuthentication.google_callback_url,
				github: enabledAuthentication.github_callback_url,
				linuxdo: enabledAuthentication.linuxdo_callback_url
			}).toEqual({
				google: `${appBaseUrl}/api/auth/callback/google`,
				github: `${appBaseUrl}/api/auth/callback/github`,
				linuxdo: `${appBaseUrl}/api/auth/oauth2/callback/linuxdo`
			})

			const enabledLoginHtml: string = await readPage('/en/login', bookmark)
			expect(enabledLoginHtml).toContain('href="/en/register"')
			expect(enabledLoginHtml).toContain('href="/en/forgot-password"')

			const disabledAuthenticationResponse: Response = await callAdminConfig(
				'update_authentication_config',
				buildAuthenticationUpdate(enabledAuthentication, authenticationVersion, {
					registrationEnabled: false,
					emailRequireVerification: false,
					disableSocialProviders: true
				}),
				bookmark
			)
			const disabledAuthentication: AuthenticationConfig =
				await readJson<AuthenticationConfig>(disabledAuthenticationResponse)
			authenticationVersion = disabledAuthentication.version
			bookmark = requireBookmark(disabledAuthenticationResponse)

			const disabledEmailResponse: Response = await callAdminConfig(
				'update_email_config',
				{
					provider: null,
					resend_api_key: { action: 'keep' },
					expected_version: emailVersion
				},
				bookmark
			)
			const disabledEmail: EmailConfig = await readJson<EmailConfig>(disabledEmailResponse)
			emailVersion = disabledEmail.version
			bookmark = requireBookmark(disabledEmailResponse)

			const disabledLoginHtml: string = await readPage('/en/login', bookmark)
			expect(disabledLoginHtml).not.toContain('href="/en/register"')
			expect(disabledLoginHtml).not.toContain('href="/en/forgot-password"')

			const resetResponse: Response = await fetch(
				`${appBaseUrl}/api/auth/email-otp/request-password-reset`,
				{
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						'x-d1-meta-bookmark': bookmark
					},
					body: JSON.stringify({ email: 'configuration-e2e@example.com' })
				}
			)
			expect({ status: resetResponse.status, body: await resetResponse.json() }).toEqual({
				status: 400,
				body: {
					code: 'EMAIL_PROVIDER_UNAVAILABLE',
					message: 'Email provider is not configured'
				}
			})

			const invalidResponse: Response = await callAdminConfigRaw(
				'update_authentication_config',
				buildAuthenticationUpdate(disabledAuthentication, authenticationVersion, {
					enableGoogleWithoutCredentials: true
				}),
				bookmark
			)
			expect({ status: invalidResponse.status, body: await invalidResponse.json() }).toEqual({
				status: 400,
				body: {
					code: 'INVALID_REQUEST',
					message: 'providers.google.clientId is required when Google authentication is enabled'
				}
			})

			const unchangedAuthentication: AuthenticationConfig = await readConfig<AuthenticationConfig>(
				'get_authentication_config',
				bookmark
			)
			expect({
				version: unchangedAuthentication.version,
				googleAuthEnabled: unchangedAuthentication.google_auth_enabled
			}).toEqual({ version: authenticationVersion, googleAuthEnabled: false })
		} finally {
			const emailResponse: Response = await callAdminConfig(
				'update_email_config',
				{
					provider: originalEmail.provider,
					resend_api_key: { action: 'keep' },
					expected_version: emailVersion
				},
				bookmark
			)
			bookmark = requireBookmark(emailResponse)
			await callAdminConfig(
				'update_authentication_config',
				buildAuthenticationUpdate(originalAuthentication, authenticationVersion, {}),
				bookmark
			)
		}
	})
})

async function readConfig<TConfig>(endpoint: string, bookmark?: string): Promise<TConfig> {
	const response: Response = await callAdminConfig(endpoint, {}, bookmark)
	return readJson<TConfig>(response)
}

async function callAdminConfig(
	endpoint: string,
	body: unknown,
	bookmark?: string
): Promise<Response> {
	const response: Response = await callAdminConfigRaw(endpoint, body, bookmark)
	if (!response.ok) {
		throw new Error(`${endpoint} failed with ${response.status}: ${await response.text()}`)
	}
	return response
}

async function callAdminConfigRaw(
	endpoint: string,
	body: unknown,
	bookmark?: string
): Promise<Response> {
	const headers: Record<string, string> = {
		cookie: adminSessionCookie,
		'content-type': 'application/json'
	}
	if (bookmark) {
		headers['x-d1-meta-bookmark'] = bookmark
	}
	const response: Response = await fetch(`${appBaseUrl}/api/admin/${endpoint}`, {
		method: 'POST',
		headers,
		body: JSON.stringify(body)
	})
	return response
}

async function readPage(path: string, bookmark: string): Promise<string> {
	const response: Response = await fetch(`${appBaseUrl}${path}`, {
		headers: {
			cookie: `d1_meta_bookmark=${encodeURIComponent(bookmark)}`
		}
	})
	if (!response.ok) {
		throw new Error(`${path} failed with ${response.status}`)
	}
	return response.text()
}

function buildAuthenticationUpdate(
	config: AuthenticationConfig,
	expectedVersion: number,
	overrides: {
		registrationEnabled?: boolean
		emailRequireVerification?: boolean
		disableSocialProviders?: boolean
		enableGoogleWithoutCredentials?: boolean
	}
): Record<string, boolean | number | string | string[] | null | SecretMutation> {
	const disableSocialProviders: boolean = overrides.disableSocialProviders ?? false
	const enableGoogleWithoutCredentials: boolean =
		overrides.enableGoogleWithoutCredentials ?? false
	return {
		beta_code_enabled: config.beta_code_enabled,
		registration_enabled: overrides.registrationEnabled ?? config.registration_enabled,
		email_signup_domain_allowlist: config.email_signup_domain_allowlist,
		email_require_verification:
			overrides.emailRequireVerification ?? config.email_require_verification,
		email_user_action_cooldown_seconds: config.email_user_action_cooldown_seconds,
		turnstile_enabled: config.turnstile_enabled,
		google_auth_enabled: enableGoogleWithoutCredentials
			? true
			: disableSocialProviders
				? false
				: config.google_auth_enabled,
		google_client_id: enableGoogleWithoutCredentials ? null : config.google_client_id,
		google_client_secret: enableGoogleWithoutCredentials ? { action: 'remove' } : { action: 'keep' },
		github_auth_enabled: disableSocialProviders ? false : config.github_auth_enabled,
		github_client_id: config.github_client_id,
		github_client_secret: { action: 'keep' },
		linuxdo_auth_enabled: disableSocialProviders ? false : config.linuxdo_auth_enabled,
		linuxdo_client_id: config.linuxdo_client_id,
		linuxdo_client_secret: { action: 'keep' },
		expected_version: expectedVersion
	}
}

async function readJson<T>(response: Response): Promise<T> {
	return response.json() as Promise<T>
}

function requireBookmark(response: Response): string {
	const bookmark: string | null = response.headers.get('x-d1-meta-bookmark')
	if (!bookmark) {
		throw new Error('CONFIGURATION_BOOKMARK_MISSING')
	}
	return bookmark
}
