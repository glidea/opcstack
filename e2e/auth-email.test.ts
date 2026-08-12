import { beforeAll, describe } from 'vitest'
import { runCases, type TestCase } from '../src/backend/testing/bdd'

type E2EEnv = {
	APP_BASE_URL?: string
	E2E_ADMIN_EMAIL?: string
}

const e2eEnv =
	(globalThis as unknown as { process?: { env?: E2EEnv } }).process?.env ?? {}
const appBaseUrl: string = e2eEnv.APP_BASE_URL ?? 'http://localhost:5173'
const appOrigin: string = new URL(appBaseUrl).origin
const adminEmail: string = e2eEnv.E2E_ADMIN_EMAIL ?? ''

describe('email auth e2e', () => {
	beforeAll(async () => {
		const res = await fetch(`${appBaseUrl}/api/health`)
		if (res.status !== 200) {
			throw new Error('dev server is not ready for e2e tests')
		}
	})

	type PublicGiven = Record<string, never>
	type PublicWhen = {
		action: 'sign_in_email_otp' | 'send_sign_in_otp'
	}
	type PublicThen = {
		status: number
		code: string
	}

	const publicCases: TestCase<PublicGiven, PublicWhen, PublicThen>[] = [
		{
			scenario: 'reject email otp sign in endpoint',
			given: 'email otp sign in request',
			when: 'calling sign in email otp',
			then: 'returns otp sign in disabled',
			givenDetail: {},
			whenDetail: {
				action: 'sign_in_email_otp'
			},
			thenExpected: {
				status: 400,
				code: 'EMAIL_OTP_SIGN_IN_DISABLED'
			}
		},
		{
			scenario: 'reject sign in otp send request',
			given: 'send verification otp request with sign in type',
			when: 'calling send verification otp',
			then: 'returns otp sign in disabled',
			givenDetail: {},
			whenDetail: {
				action: 'send_sign_in_otp'
			},
			thenExpected: {
				status: 400,
				code: 'EMAIL_OTP_SIGN_IN_DISABLED'
			}
		}
	]

	runCases(publicCases, async (_given, when) => {
		const email = buildScenarioEmail(`blocked-${when.action}-${Date.now()}`)
		if (when.action === 'sign_in_email_otp') {
			const res = await postJson('/api/auth/sign-in/email-otp', {
				email,
				otp: '123456'
			})
			const payload = (await res.json()) as { code?: string }
			return {
				status: res.status,
				code: payload.code ?? ''
			}
		}

		const res = await postJson('/api/auth/email-otp/send-verification-otp', {
			email,
			type: 'sign-in'
		})
		const payload = (await res.json()) as { code?: string }
		return {
			status: res.status,
			code: payload.code ?? ''
		}
	})

})

function buildScenarioEmail(tag: string): string {
	const domain = extractEmailDomain(adminEmail) || 'example.com'
	const cleanTag = tag.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
	return `e2e-${cleanTag}@${domain}`
}

function extractEmailDomain(value: string): string {
	const email = extractEmailAddress(value)
	const at = email.lastIndexOf('@')
	if (at < 0) {
		return ''
	}
	return email.slice(at + 1)
}

function extractEmailAddress(value: string): string {
	const match = value.match(/<([^>]+)>/)
	if (match?.[1]) {
		return match[1].trim()
	}
	return value.trim()
}

function buildHeaders(extra?: Record<string, string>): Headers {
	const headers = new Headers({
		'content-type': 'application/json',
		'x-captcha-response': 'XXXX.DUMMY.TOKEN.XXXX',
		origin: appOrigin,
		referer: `${appOrigin}/`
	})
	if (!extra) {
		return headers
	}
	for (const [key, value] of Object.entries(extra)) {
		headers.set(key, value)
	}
	return headers
}

function postJson(
	path: string,
	body: unknown,
	headers?: Record<string, string>
): Promise<Response> {
	return fetch(`${appBaseUrl}${path}`, {
		method: 'POST',
		headers: buildHeaders(headers),
		body: JSON.stringify(body)
	})
}
