import { beforeAll, describe, expect, test } from 'vitest'
import { verifyConfigurationAndOAuthJourney } from './support/configuration-journey'
import { readJson, signInWithPassword, type CookieJar } from './support/http'

const remote: boolean = process.env['E2E_REMOTE'] === '1'
const appBaseUrl: string = process.env['APP_BASE_URL'] ?? ''
const adminEmail: string = process.env['E2E_ADMIN_EMAIL'] ?? ''
const adminPassword: string = process.env['E2E_ADMIN_PASSWORD'] ?? ''
let cookies: CookieJar

describe.skipIf(!remote)('deployed Cloudflare public entrypoints', (): void => {
	test('serves the deployed worker', async (): Promise<void> => {
		const response: Response = await fetch(`${appBaseUrl}/api/health`)
		expect(response.status).toBe(200)
	})

	test('serves the published getting started documentation', async (): Promise<void> => {
		const response: Response = await fetch(`${appBaseUrl}/en/docs/getting-started`)
		expect(response.status).toBe(200)
		expect(await response.text()).toContain('Getting Started')
	})

	test('redirects the configuration deep link to administrator sign in', async (): Promise<void> => {
		const response: Response = await fetch(
			`${appBaseUrl}/en/admin/configuration/general`,
			{ redirect: 'manual' }
		)
		expect(response.status).toBe(302)
		const location: string | null = response.headers.get('location')
		expect(location).not.toBeNull()
		const redirectUrl: URL = new URL(location!, appBaseUrl)
		expect(redirectUrl.pathname).toBe('/en/login')
		expect(redirectUrl.searchParams.get('redirect')).toBe(
			'/en/admin/configuration/general'
		)
	})

	test('exposes OAuth authorization creation without a browser session', async (): Promise<void> => {
		const response: Response = await fetch(`${appBaseUrl}/api/oauth/create_authorization`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				client_id: 'opc-cli',
				scopes: ['config:storage:read'],
				code_challenge: 'invalid',
				code_challenge_method: 'S256'
			})
		})
		expect(response.status).toBe(400)
		expect(await readJson<{ code: string }>(response)).toEqual(
			expect.objectContaining({ code: 'INVALID_REQUEST' })
		)
	})
})

describe.skipIf(!remote)('deployed Cloudflare configuration journey', (): void => {
	beforeAll(async (): Promise<void> => {
		if (adminEmail === '' || adminPassword === '') {
			throw new Error('REMOTE_E2E_ADMIN_CREDENTIALS_REQUIRED')
		}
		const signIn = await signInWithPassword({ appBaseUrl, email: adminEmail, password: adminPassword })
		expect(signIn.response.status).toBe(200)
		cookies = signIn.cookies
	})

	test('updates configuration, calls a scoped API and revokes access through public HTTP', async (): Promise<void> => {
		await verifyConfigurationAndOAuthJourney({ appBaseUrl, cookies })
	})
})
