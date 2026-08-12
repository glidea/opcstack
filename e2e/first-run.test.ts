import { beforeAll, describe, expect, test } from 'vitest'
import { verifyConfigurationAndOAuthJourney } from './support/configuration-journey'
import { browserHeaders, readJson, signInWithPassword, type CookieJar } from './support/http'

type AuthenticationConfig = {
	beta_code_enabled: boolean
	email_signup_enabled: boolean
	turnstile_enabled: boolean
	google_auth_enabled: boolean
	github_auth_enabled: boolean
	linuxdo_auth_enabled: boolean
}

type EmailConfig = { enabled: boolean }
type AffiliateConfig = { enabled: boolean }
type PaymentConfig = { enabled: boolean }
type AiConfig = {
	providers: Record<string, { enabled: boolean }>
}

const firstRun: boolean = process.env['E2E_FIRST_RUN'] === '1'
const appBaseUrl: string = process.env['APP_BASE_URL'] ?? 'http://localhost:5173'
const initialEmail: string = process.env['E2E_ADMIN_EMAIL'] ?? ''
const initialPassword: string = process.env['E2E_ADMIN_PASSWORD'] ?? ''
const nextEmail: string = process.env['E2E_NEW_ADMIN_EMAIL'] ?? ''
const nextPassword: string = process.env['E2E_NEW_ADMIN_PASSWORD'] ?? ''
let cookies: CookieJar

describe.skipIf(!firstRun)('first-run user journey', (): void => {
	beforeAll(async (): Promise<void> => {
		for (const value of [initialEmail, initialPassword, nextEmail, nextPassword]) {
			if (value === '') {
				throw new Error('FIRST_RUN_E2E_CREDENTIALS_REQUIRED')
			}
		}
		const healthResponse: Response = await fetch(`${appBaseUrl}/api/health`)
		expect(healthResponse.status).toBe(200)
	})

	test('completes setup, configuration, OAuth access and revocation through HTTP', async (): Promise<void> => {
		const initialSignIn = await signInWithPassword({
			appBaseUrl,
			email: initialEmail,
			password: initialPassword
		})
		expect(initialSignIn.response.status).toBe(200)
		cookies = initialSignIn.cookies

		const authentication: AuthenticationConfig = await callAdmin<AuthenticationConfig>(
			'get_authentication_config'
		)
		const email: EmailConfig = await callAdmin<EmailConfig>('get_email_config')
		const affiliate: AffiliateConfig = await callAdmin<AffiliateConfig>('get_affiliate_config')
		const payment: PaymentConfig = await callAdmin<PaymentConfig>('get_payment_config')
		const ai: AiConfig = await callAdmin<AiConfig>('get_ai_config')
		expect({
			beta: authentication.beta_code_enabled,
			emailSignup: authentication.email_signup_enabled,
			turnstile: authentication.turnstile_enabled,
			google: authentication.google_auth_enabled,
			github: authentication.github_auth_enabled,
			linuxdo: authentication.linuxdo_auth_enabled,
			email: email.enabled,
			affiliate: affiliate.enabled,
			payment: payment.enabled,
			aiProviders: Object.values(ai.providers).some(
				(provider: { enabled: boolean }): boolean => provider.enabled
			)
		}).toEqual({
			beta: false,
			emailSignup: false,
			turnstile: false,
			google: false,
			github: false,
			linuxdo: false,
			email: false,
			affiliate: false,
			payment: false,
			aiProviders: false
		})

		const emailResponse: Response = await fetch(
			`${appBaseUrl}/api/admin/update_administrator_email`,
			{
				method: 'POST',
				headers: browserHeaders(appBaseUrl, cookies),
				body: JSON.stringify({ email: nextEmail })
			}
		)
		expect(emailResponse.status).toBe(200)

		const passwordResponse: Response = await fetch(`${appBaseUrl}/api/auth/change-password`, {
			method: 'POST',
			headers: browserHeaders(appBaseUrl, cookies),
			body: JSON.stringify({
				currentPassword: initialPassword,
				newPassword: nextPassword,
				revokeOtherSessions: true
			})
		})
		expect(passwordResponse.status).toBe(200)

		const rejectedInitialSignIn = await signInWithPassword({
			appBaseUrl,
			email: initialEmail,
			password: initialPassword
		})
		expect(rejectedInitialSignIn.response.ok).toBe(false)
		const changedSignIn = await signInWithPassword({
			appBaseUrl,
			email: nextEmail,
			password: nextPassword
		})
		expect(changedSignIn.response.status).toBe(200)
		cookies = changedSignIn.cookies

		await verifyConfigurationAndOAuthJourney({ appBaseUrl, cookies })
	})
})

async function callAdmin<T>(endpoint: string): Promise<T> {
	const response: Response = await fetch(`${appBaseUrl}/api/admin/${endpoint}`, {
		method: 'POST',
		headers: browserHeaders(appBaseUrl, cookies),
		body: JSON.stringify({})
	})
	if (!response.ok) {
		throw new Error(`${endpoint} failed with ${response.status}`)
	}
	return readJson<T>(response)
}
