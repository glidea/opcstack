import { beforeAll, describe } from 'vitest'
import { runCases, type TestCase } from '../src/testing/bdd'

type E2EEnv = {
	APP_BASE_URL?: string
	E2E_ADMIN_SECRET?: string
	E2E_BETTER_AUTH_SECRET?: string
	E2E_EMAIL_ENABLED?: string
	E2E_EMAIL_SIGNUP_ENABLED?: string
	E2E_EMAIL_REQUIRE_VERIFICATION?: string
	E2E_EMAIL_FROM?: string
}

interface NotificationListResponse {
	items: Array<{
		id: string
		type: string
		title: string
		content: string
		read: boolean
		created_at: number
	}>
}

const e2eEnv =
	(globalThis as unknown as { process?: { env?: E2EEnv } }).process?.env ?? {}
const appBaseUrl: string = e2eEnv.APP_BASE_URL ?? 'http://localhost:5173'
const appOrigin: string = new URL(appBaseUrl).origin
const adminSecret: string = e2eEnv.E2E_ADMIN_SECRET ?? 'admin-secret'
const betterAuthSecret: string = e2eEnv.E2E_BETTER_AUTH_SECRET ?? ''
const emailEnabled: boolean = e2eEnv.E2E_EMAIL_ENABLED === 'true'
const emailSignupEnabled: boolean = e2eEnv.E2E_EMAIL_SIGNUP_ENABLED === 'true'
const emailRequireVerification: boolean = e2eEnv.E2E_EMAIL_REQUIRE_VERIFICATION === 'true'
const emailFrom: string = e2eEnv.E2E_EMAIL_FROM ?? ''
const canCreateUser: boolean = emailEnabled && emailSignupEnabled && betterAuthSecret !== ''

describe('notification api e2e', () => {
	beforeAll(async () => {
		const res = await fetch(`${appBaseUrl}/api/health`)
		if (res.status !== 200) {
			throw new Error('dev server is not ready for e2e tests')
		}
	})

	type PublicGiven = Record<string, never>
	type PublicWhen = {
		action: 'create_without_admin' | 'list_without_auth' | 'read_without_auth'
	}
	type PublicThen = {
		status: number
		code: string
	}

	const publicCases: TestCase<PublicGiven, PublicWhen, PublicThen>[] = [
		{
			scenario: 'create notification requires admin secret',
			given: 'no admin authorization header',
			when: 'creating notification',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'create_without_admin'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED'
			}
		},
		{
			scenario: 'list notifications requires auth',
			given: 'no bearer token',
			when: 'listing notifications',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'list_without_auth'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED'
			}
		},
		{
			scenario: 'read notification requires auth',
			given: 'no bearer token',
			when: 'marking notification read',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'read_without_auth'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED'
			}
		}
	]

	runCases(publicCases, async (_given, when) => {
		if (when.action === 'create_without_admin') {
			const res = await postJson('/api/admin/create_notification', {
				title: 'no auth',
				content: 'no auth'
			})
			const payload = (await res.json()) as { code: string }
			return {
				status: res.status,
				code: payload.code
			}
		}

		if (when.action === 'list_without_auth') {
			const res = await postJson('/api/list_notifications', {})
			const payload = (await res.json()) as { code: string }
			return {
				status: res.status,
				code: payload.code
			}
		}

		const res = await postJson('/api/read_notification', { id: 'n1' })
		const payload = (await res.json()) as { code: string }
		return {
			status: res.status,
			code: payload.code
		}
	})

	describe.skipIf(!canCreateUser)('notification authenticated flow', () => {
		type FlowGiven = Record<string, never>
		type FlowWhen = Record<string, never>
		type FlowThen = {
			createStatus: number
			firstListStatus: number
			firstListContainsNotification: boolean
			firstReadState: boolean
			readStatus: number
			secondReadState: boolean
		}

		const flowCases: TestCase<FlowGiven, FlowWhen, FlowThen>[] = [
			{
				scenario: 'admin creates global notification and user can read it',
				given: 'admin secret and a signed in user',
				when: 'creating listing and reading a notification',
				then: 'notification read state changes from false to true',
				givenDetail: {},
				whenDetail: {},
				thenExpected: {
					createStatus: 200,
					firstListStatus: 200,
					firstListContainsNotification: true,
					firstReadState: false,
					readStatus: 200,
					secondReadState: true
				}
			}
		]

		runCases(flowCases, async () => {
			const runId = String(Date.now())
			const token = await createUserToken(`notification-${runId}`)
			const title = `e2e-title-${runId}`
			const content = `e2e-content-${runId}`
			const createRes = await postJson(
				'/api/admin/create_notification',
				{
					type: 'system',
					title,
					content
				},
				{
					authorization: `Bearer ${adminSecret}`
				}
			)

			const firstListRes = await postJson(
				'/api/list_notifications',
				{},
				{
					authorization: `Bearer ${token}`
				}
			)
			const firstListPayload = (await firstListRes.json()) as NotificationListResponse
			const firstNotification = firstListPayload.items.find((item) => {
				return item.title === title && item.content === content
			})
			if (!firstNotification) {
				return {
					createStatus: createRes.status,
					firstListStatus: firstListRes.status,
					firstListContainsNotification: false,
					firstReadState: true,
					readStatus: 0,
					secondReadState: false
				}
			}

			const readRes = await postJson(
				'/api/read_notification',
				{
					id: firstNotification.id
				},
				{
					authorization: `Bearer ${token}`
				}
			)

			const secondListRes = await postJson(
				'/api/list_notifications',
				{},
				{
					authorization: `Bearer ${token}`
				}
			)
			const secondListPayload = (await secondListRes.json()) as NotificationListResponse
			const secondNotification = secondListPayload.items.find((item) => {
				return item.id === firstNotification.id
			})

			return {
				createStatus: createRes.status,
				firstListStatus: firstListRes.status,
				firstListContainsNotification: true,
				firstReadState: firstNotification.read,
				readStatus: readRes.status,
				secondReadState: secondNotification?.read ?? false
			}
		})
	})
})

async function createUserToken(tag: string): Promise<string> {
	const email = buildScenarioEmail(tag)
	const password = 'Password123'
	const signupRes = await postJson('/api/auth/sign-up/email', {
		name: 'e2e-user',
		email,
		password
	})
	if (!signupRes.ok) {
		throw new Error(`failed to sign up test user: ${signupRes.status}`)
	}

	if (emailRequireVerification) {
		const verifyToken = await createEmailVerificationToken(email)
		const verifyRes = await fetch(
			`${appBaseUrl}/api/auth/verify-email?token=${encodeURIComponent(verifyToken)}`
		)
		if (!verifyRes.ok) {
			throw new Error(`failed to verify test user email: ${verifyRes.status}`)
		}
	}

	const signInRes = await postJson('/api/auth/sign-in/email', {
		email,
		password
	})
	const payload = (await signInRes.json()) as { token?: string }
	if (!signInRes.ok || !payload.token) {
		throw new Error(`failed to sign in test user: ${signInRes.status}`)
	}
	return payload.token
}

async function createEmailVerificationToken(email: string): Promise<string> {
	const now = Math.floor(Date.now() / 1000)
	const header = base64UrlEncodeJson({ alg: 'HS256' })
	const payload = base64UrlEncodeJson({
		email: email.toLowerCase(),
		iat: now,
		exp: now + 3600
	})
	const signature = await hmacSha256Base64Url(`${header}.${payload}`, betterAuthSecret)
	return `${header}.${payload}.${signature}`
}

function base64UrlEncodeJson(value: Record<string, string | number>): string {
	const raw = JSON.stringify(value)
	const bytes = new TextEncoder().encode(raw)
	return base64UrlEncode(bytes)
}

async function hmacSha256Base64Url(value: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{
			name: 'HMAC',
			hash: 'SHA-256'
		},
		false,
		['sign']
	)
	const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
	return base64UrlEncode(new Uint8Array(signature))
}

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = ''
	for (const byte of bytes) {
		binary += String.fromCharCode(byte)
	}
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function buildScenarioEmail(tag: string): string {
	const domain = extractEmailDomain(emailFrom) || 'example.com'
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
