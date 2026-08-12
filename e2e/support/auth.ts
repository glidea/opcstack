type SecretMutation = { action: 'keep' }

type AuthenticationConfig = {
	beta_code_enabled: boolean
	email_signup_enabled: boolean
	email_signup_domain_allowlist: string[]
	email_require_verification: boolean
	email_user_action_cooldown_seconds: number
	turnstile_enabled: boolean
	turnstile_site_key: string | null
	google_auth_enabled: boolean
	google_client_id: string | null
	github_auth_enabled: boolean
	github_client_id: string | null
	linuxdo_auth_enabled: boolean
	linuxdo_client_id: string | null
	version: number
}

type EmailConfig = {
	enabled: boolean
	provider: 'cloudflare' | 'resend' | null
	version: number
}

export type LocalTestUser = {
	token: string
	userId: string
}

let adminSessionCookiePromise: Promise<string> | undefined

export function getAdminSessionCookie(appBaseUrl: string): Promise<string> {
	if (adminSessionCookiePromise) {
		return adminSessionCookiePromise
	}

	adminSessionCookiePromise = createAdminSessionCookie(appBaseUrl)
	return adminSessionCookiePromise
}

async function createAdminSessionCookie(appBaseUrl: string): Promise<string> {
	const email: string = process.env['E2E_ADMIN_EMAIL'] ?? ''
	const password: string = process.env['E2E_ADMIN_PASSWORD'] ?? ''
	if (email === '' || password === '') {
		throw new Error('E2E_ADMIN_SESSION_CONFIG_REQUIRED')
	}

	const origin: string = new URL(appBaseUrl).origin
	const response: Response = await fetch(`${appBaseUrl}/api/auth/sign-in/email`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			origin,
			referer: `${origin}/`
		},
		body: JSON.stringify({ email, password })
	})
	if (!response.ok) {
		throw new Error(`failed to sign in super admin: ${response.status}`)
	}

	const setCookie: string = response.headers.get('set-cookie') ?? ''
	const match: RegExpMatchArray | null = setCookie.match(
		/((?:__Secure-)?better-auth\.session_token=[^;,]+)/
	)
	if (!match) {
		throw new Error('E2E_ADMIN_SESSION_COOKIE_MISSING')
	}
	return match[1]
}

export async function createLocalTestUser(input: {
	appBaseUrl: string
	tag: string
}): Promise<LocalTestUser> {
	const authentication: AuthenticationConfig = await readConfig<AuthenticationConfig>(
		input,
		'get_authentication_config'
	)
	const email: EmailConfig = await readConfig<EmailConfig>(input, 'get_email_config')
	let authenticationVersion: number = authentication.version
	let emailVersion: number = email.version
	let bookmark: string | undefined
	let authenticationChanged: boolean = false
	let emailChanged: boolean = false

	try {
		const emailResponse: Response = await callAdminConfig(input, 'update_email_config', {
			enabled: true,
			provider: 'cloudflare',
			resend_api_key: { action: 'keep' },
			expected_version: emailVersion
		})
		const enabledEmail: EmailConfig = await readJson<EmailConfig>(emailResponse)
		emailVersion = enabledEmail.version
		bookmark = requireBookmark(emailResponse)
		emailChanged = true

		const authenticationResponse: Response = await callAdminConfig(
			input,
			'update_authentication_config',
			buildAuthenticationUpdate(authentication, authenticationVersion, {
				betaCodeEnabled: false,
				emailSignupEnabled: true,
				emailSignupDomainAllowlist: [],
				emailRequireVerification: false,
				turnstileEnabled: false
			}),
			bookmark
		)
		const enabledAuthentication: AuthenticationConfig =
			await readJson<AuthenticationConfig>(authenticationResponse)
		authenticationVersion = enabledAuthentication.version
		bookmark = requireBookmark(authenticationResponse)
		authenticationChanged = true

		const cleanTag: string = input.tag.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
		const emailAddress: string = `e2e-${cleanTag}@example.com`
		const password: string = 'Password123'
		const signupResponse: Response = await postJson(
			input.appBaseUrl,
			'/api/auth/sign-up/email',
			{
				name: 'e2e-user',
				email: emailAddress,
				password
			},
			bookmark
		)
		if (!signupResponse.ok) {
			throw new Error(`failed to sign up test user: ${signupResponse.status}`)
		}

		const signInResponse: Response = await postJson(
			input.appBaseUrl,
			'/api/auth/sign-in/email',
			{
				email: emailAddress,
				password
			},
			bookmark
		)
		const payload: { token?: string; user?: { id?: string } } = await signInResponse.json()
		if (!signInResponse.ok || !payload.token || !payload.user?.id) {
			throw new Error(`failed to sign in test user: ${signInResponse.status}`)
		}
		return {
			token: payload.token,
			userId: payload.user.id
		}
	} finally {
		if (authenticationChanged) {
			const response: Response = await callAdminConfig(
				input,
				'update_authentication_config',
				buildAuthenticationUpdate(authentication, authenticationVersion, {}),
				bookmark
			)
			bookmark = requireBookmark(response)
		}
		if (emailChanged) {
			await callAdminConfig(
				input,
				'update_email_config',
				{
					enabled: email.enabled,
					provider: email.provider,
					resend_api_key: { action: 'keep' },
					expected_version: emailVersion
				},
				bookmark
			)
		}
	}
}

function buildAuthenticationUpdate(
	config: AuthenticationConfig,
	expectedVersion: number,
	overrides: {
		betaCodeEnabled?: boolean
		emailSignupEnabled?: boolean
		emailSignupDomainAllowlist?: string[]
		emailRequireVerification?: boolean
		turnstileEnabled?: boolean
	}
): Record<string, boolean | number | string | string[] | null | SecretMutation> {
	return {
		beta_code_enabled: overrides.betaCodeEnabled ?? config.beta_code_enabled,
		email_signup_enabled: overrides.emailSignupEnabled ?? config.email_signup_enabled,
		email_signup_domain_allowlist:
			overrides.emailSignupDomainAllowlist ?? config.email_signup_domain_allowlist,
		email_require_verification:
			overrides.emailRequireVerification ?? config.email_require_verification,
		email_user_action_cooldown_seconds: config.email_user_action_cooldown_seconds,
		turnstile_enabled: overrides.turnstileEnabled ?? config.turnstile_enabled,
		turnstile_site_key: config.turnstile_site_key,
		turnstile_secret_key: { action: 'keep' },
		google_auth_enabled: config.google_auth_enabled,
		google_client_id: config.google_client_id,
		google_client_secret: { action: 'keep' },
		github_auth_enabled: config.github_auth_enabled,
		github_client_id: config.github_client_id,
		github_client_secret: { action: 'keep' },
		linuxdo_auth_enabled: config.linuxdo_auth_enabled,
		linuxdo_client_id: config.linuxdo_client_id,
		linuxdo_client_secret: { action: 'keep' },
		expected_version: expectedVersion
	}
}

async function readConfig<TConfig>(
	input: { appBaseUrl: string },
	endpoint: string
): Promise<TConfig> {
	const response: Response = await callAdminConfig(input, endpoint, {})
	return readJson<TConfig>(response)
}

async function callAdminConfig(
	input: { appBaseUrl: string },
	endpoint: string,
	body: unknown,
	bookmark?: string
): Promise<Response> {
	const adminCookie: string = await getAdminSessionCookie(input.appBaseUrl)
	const headers: Record<string, string> = {
		cookie: adminCookie,
		'content-type': 'application/json'
	}
	if (bookmark) {
		headers['x-d1-meta-bookmark'] = bookmark
	}
	const response: Response = await fetch(`${input.appBaseUrl}/api/admin/${endpoint}`, {
		method: 'POST',
		headers,
		body: JSON.stringify(body)
	})
	if (!response.ok) {
		throw new Error(`${endpoint} failed with ${response.status}: ${await response.text()}`)
	}
	return response
}

function postJson(
	appBaseUrl: string,
	path: string,
	body: unknown,
	bookmark: string
): Promise<Response> {
	return fetch(`${appBaseUrl}${path}`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-d1-meta-bookmark': bookmark,
			origin: new URL(appBaseUrl).origin,
			referer: `${new URL(appBaseUrl).origin}/`
		},
		body: JSON.stringify(body)
	})
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
