import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { beforeAll, describe } from 'vitest'
import { runCases, type TestCase } from '../src/testing/bdd'

type E2EEnv = {
	APP_BASE_URL?: string
	E2E_REMOTE?: string
	E2E_AFF_ENABLED?: string
	E2E_EMAIL_ENABLED?: string
	E2E_EMAIL_SIGNUP_ENABLED?: string
	E2E_EMAIL_REQUIRE_VERIFICATION?: string
	E2E_EMAIL_FROM?: string
	E2E_TURNSTILE_ENABLED?: string
}

interface PublicConfigResponse {
	aff_enabled: boolean
}

interface AffSummaryResponse {
	aff_enabled: boolean
	aff_code: string
	invited_count: number
}

const e2eEnv =
	(globalThis as unknown as { process?: { env?: E2EEnv } }).process?.env ?? {}
const appBaseUrl: string = e2eEnv.APP_BASE_URL ?? 'http://localhost:5173'
const appOrigin: string = new URL(appBaseUrl).origin
const isRemote: boolean = appOrigin !== 'http://localhost:5173'
const affEnabled: boolean = e2eEnv.E2E_AFF_ENABLED === 'true'
const emailEnabled: boolean = e2eEnv.E2E_EMAIL_ENABLED === 'true'
const emailSignupEnabled: boolean = e2eEnv.E2E_EMAIL_SIGNUP_ENABLED === 'true'
const emailRequireVerification: boolean = e2eEnv.E2E_EMAIL_REQUIRE_VERIFICATION === 'true'
const emailFrom: string = e2eEnv.E2E_EMAIL_FROM ?? ''
const turnstileEnabled: boolean = e2eEnv.E2E_TURNSTILE_ENABLED === 'true'
const canUseDummyCaptcha: boolean = !isRemote || !turnstileEnabled
const canCreateUser: boolean =
	emailEnabled && emailSignupEnabled && !emailRequireVerification && canUseDummyCaptcha
const canCreateLocalUser: boolean = !isRemote
const canRunAffFlow: boolean = affEnabled && (canCreateUser || canCreateLocalUser)

describe('aff api e2e', () => {
	beforeAll(async () => {
		const res: Response = await fetch(`${appBaseUrl}/api/health`)
		if (res.status !== 200) {
			throw new Error('dev server is not ready for e2e tests')
		}
	})

	type PublicGiven = Record<string, never>
	type PublicWhen = {
		action: 'get_public_config' | 'get_summary_without_auth' | 'bind_without_auth'
	}
	type PublicThen = {
		status: number
		code: string
		hasAffFlag: boolean
	}

	const publicCases: TestCase<PublicGiven, PublicWhen, PublicThen>[] = [
		{
			scenario: 'public config exposes aff flag',
			given: 'no auth required',
			when: 'calling public config api',
			then: 'returns aff feature flag',
			givenDetail: {},
			whenDetail: {
				action: 'get_public_config'
			},
			thenExpected: {
				status: 200,
				code: '',
				hasAffFlag: true
			}
		},
		{
			scenario: 'aff summary rejects anonymous caller',
			given: 'no bearer token',
			when: 'calling aff summary api',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'get_summary_without_auth'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED',
				hasAffFlag: false
			}
		},
		{
			scenario: 'bind aff rejects anonymous caller',
			given: 'no bearer token',
			when: 'calling bind aff api',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'bind_without_auth'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED',
				hasAffFlag: false
			}
		}
	]

	runCases(publicCases, async (_given, when) => {
		switch (when.action) {
			case 'get_public_config': {
				const res: Response = await postJson('/api/get_public_config', {})
				const payload = (await res.json()) as PublicConfigResponse
				return {
					status: res.status,
					code: '',
					hasAffFlag: typeof payload.aff_enabled === 'boolean'
				}
			}
			case 'get_summary_without_auth': {
				const res: Response = await postJson('/api/get_aff_summary', {})
				const payload = (await res.json()) as { code: string }
				return {
					status: res.status,
					code: payload.code,
					hasAffFlag: false
				}
			}
			case 'bind_without_auth': {
				const res: Response = await postJson('/api/bind_aff', {
					aff_code: 'ABC12345'
				})
				const payload = (await res.json()) as { code: string }
				return {
					status: res.status,
					code: payload.code,
					hasAffFlag: false
				}
			}
		}
	})

	describe.skipIf(!canRunAffFlow)('aff authenticated flow', () => {
		type SummaryGiven = Record<string, never>
		type SummaryWhen = Record<string, never>
		type SummaryThen = {
			status: number
			affEnabled: boolean
			hasAffCode: boolean
			invitedCount: number
		}

		const summaryCases: TestCase<SummaryGiven, SummaryWhen, SummaryThen>[] = [
			{
				scenario: 'signed in user reads aff summary',
				given: 'a signed in user',
				when: 'calling aff summary api',
				then: 'returns own aff code',
				givenDetail: {},
				whenDetail: {},
				thenExpected: {
					status: 200,
					affEnabled: true,
					hasAffCode: true,
					invitedCount: 0
				}
			}
		]

		runCases(summaryCases, async () => {
			const runId: string = String(Date.now())
			const token: string = await createUserToken(`aff-summary-${runId}`)
			const summaryRes: Response = await postJson(
				'/api/get_aff_summary',
				{},
				{
					authorization: `Bearer ${token}`
				}
			)
			const summaryPayload = (await summaryRes.json()) as AffSummaryResponse
			return {
				status: summaryRes.status,
				affEnabled: summaryPayload.aff_enabled,
				hasAffCode: summaryPayload.aff_code.length > 0,
				invitedCount: summaryPayload.invited_count
			}
		})

		type BindGiven = Record<string, never>
		type BindWhen = {
			action: 'bind_once' | 'bind_twice'
		}
		type BindThen = {
			firstBindStatus: number
			secondBindStatus: number
			secondBindCode: string
			invitedCount: number
		}

		const bindCases: TestCase<BindGiven, BindWhen, BindThen>[] = [
			{
				scenario: 'invitee binds inviter code',
				given: 'signed in inviter and invitee',
				when: 'invitee binds inviter aff code',
				then: 'inviter count increases',
				givenDetail: {},
				whenDetail: {
					action: 'bind_once'
				},
				thenExpected: {
					firstBindStatus: 200,
					secondBindStatus: 0,
					secondBindCode: '',
					invitedCount: 1
				}
			},
			{
				scenario: 'invitee bind same code twice is idempotent',
				given: 'invitee has already bound an aff code',
				when: 'invitee binds the same aff code again',
				then: 'returns success without increasing count twice',
				givenDetail: {},
				whenDetail: {
					action: 'bind_twice'
				},
				thenExpected: {
					firstBindStatus: 200,
					secondBindStatus: 200,
					secondBindCode: '',
					invitedCount: 1
				}
			}
		]

		runCases(bindCases, async (_given, when) => {
			const runId: string = String(Date.now())
			const inviterToken: string = await createUserToken(`aff-inviter-${when.action}-${runId}`)
			const inviteeToken: string = await createUserToken(`aff-invitee-${when.action}-${runId}`)
			const beforeSummaryRes: Response = await postJson(
				'/api/get_aff_summary',
				{},
				{
					authorization: `Bearer ${inviterToken}`
				}
			)
			const beforeSummary = (await beforeSummaryRes.json()) as AffSummaryResponse

			const firstBindRes: Response = await postJson(
				'/api/bind_aff',
				{
					aff_code: beforeSummary.aff_code
				},
				{
					authorization: `Bearer ${inviteeToken}`
				}
			)

			let secondBindStatus = 0
			let secondBindCode = ''
			if (when.action === 'bind_twice') {
				const secondBindRes: Response = await postJson(
					'/api/bind_aff',
					{
						aff_code: beforeSummary.aff_code
					},
					{
						authorization: `Bearer ${inviteeToken}`
					}
				)
				const secondBindPayload = (await secondBindRes.json()) as { code?: string }
				secondBindStatus = secondBindRes.status
				secondBindCode = secondBindPayload.code ?? ''
			}

			const afterSummaryRes: Response = await postJson(
				'/api/get_aff_summary',
				{},
				{
					authorization: `Bearer ${inviterToken}`
				}
			)
			const afterSummary = (await afterSummaryRes.json()) as AffSummaryResponse

			return {
				firstBindStatus: firstBindRes.status,
				secondBindStatus,
				secondBindCode,
				invitedCount: afterSummary.invited_count
			}
		})
	})
})

async function createUserToken(tag: string): Promise<string> {
	if (!canCreateUser) {
		return createLocalUserSession(tag)
	}

	const email: string = buildScenarioEmail(tag)
	const password: string = 'Password123'
	const signupRes: Response = await postJson('/api/auth/sign-up/email', {
		name: 'e2e-user',
		email,
		password
	})
	if (!signupRes.ok) {
		throw new Error(`failed to sign up test user: ${signupRes.status}`)
	}

	const signInRes: Response = await postJson('/api/auth/sign-in/email', {
		email,
		password
	})
	const payload = (await signInRes.json()) as { token?: string }
	if (!signInRes.ok || !payload.token) {
		throw new Error(`failed to sign in test user: ${signInRes.status}`)
	}
	return payload.token
}

function createLocalUserSession(tag: string): string {
	const now: number = Date.now()
	const userId: string = `u_${tag}_${now}`.replace(/[^a-zA-Z0-9_]/g, '_')
	const sessionId: string = `s_${tag}_${now}`.replace(/[^a-zA-Z0-9_]/g, '_')
	const token: string = `t_${tag}_${now}`.replace(/[^a-zA-Z0-9_]/g, '_')
	const affCodePrefix: string = tag.includes('invitee') ? 'I' : 'A'
	const affCode: string = `${affCodePrefix}${String(now).slice(-7)}`
	const email: string = `${userId}@example.com`
	const expiresAt: number = now + 30 * 24 * 60 * 60 * 1000
	const sql: string = [
		'PRAGMA busy_timeout=5000;',
		`INSERT INTO user (id, name, email, aff_code, email_verified, image, created_at, updated_at) VALUES ('${userId}', 'e2e-user', '${email}', '${affCode}', 1, NULL, ${now}, ${now});`,
		`INSERT INTO session (id, expires_at, token, created_at, updated_at, ip_address, user_agent, user_id) VALUES ('${sessionId}', ${expiresAt}, '${token}', ${now}, ${now}, NULL, 'e2e', '${userId}');`
	].join(' ')
	execFileSync('sqlite3', [readLocalD1SqlitePath(), sql], {
		stdio: 'ignore'
	})
	return token
}

function readLocalD1SqlitePath(): string {
	const dir: string = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'
	const files: string[] = readdirSync(dir).filter((file: string): boolean => {
		return file.endsWith('.sqlite') && file !== 'metadata.sqlite'
	})
	for (const file of files) {
		const path: string = `${dir}/${file}`
		const output: string = execFileSync(
			'sqlite3',
			[path, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user';"],
			{ encoding: 'utf-8' }
		)
		if (output.trim() === 'user') {
			return path
		}
	}
	throw new Error('LOCAL_META_D1_SQLITE_NOT_FOUND')
}

function buildScenarioEmail(tag: string): string {
	const domain: string = extractEmailDomain(emailFrom) || 'example.com'
	const cleanTag: string = tag.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
	return `e2e-${cleanTag}@${domain}`
}

function extractEmailDomain(value: string): string {
	const email: string = extractEmailAddress(value)
	const at: number = email.lastIndexOf('@')
	if (at < 0) {
		return ''
	}
	return email.slice(at + 1)
}

function extractEmailAddress(value: string): string {
	const match: RegExpMatchArray | null = value.match(/<([^>]+)>/)
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
	return postJsonOnce(path, body, headers).catch(async (): Promise<Response> => {
		await sleep(100)
		return postJsonOnce(path, body, headers)
	})
}

function postJsonOnce(
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

function sleep(ms: number): Promise<void> {
	return new Promise((resolve: () => void): void => {
		setTimeout(resolve, ms)
	})
}
