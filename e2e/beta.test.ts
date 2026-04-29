import { beforeAll, describe } from 'vitest'
import { runCases, type TestCase } from '../src/testing/bdd'

interface PublicConfigResponse {
	beta_code_enabled: boolean
	google_auth_enabled: boolean
	email_enabled: boolean
	email_signup_enabled: boolean
	email_require_verification: boolean
	email_user_action_cooldown_seconds: number
}

interface GenerateBetaCodesResponse {
	codes: Array<{
		id: string
		code: string
	}>
}

interface ListBetaCodesResponse {
	items: Array<{
		id: string
		code: string
		used_by: string | null
		used_at: number | null
		created_at: number
	}>
}

type E2EEnv = {
	APP_BASE_URL?: string
	E2E_ADMIN_SECRET?: string
	E2E_BETA_CODE_ENABLED?: string
	E2E_GOOGLE_AUTH_ENABLED?: string
	E2E_EMAIL_ENABLED?: string
	E2E_EMAIL_SIGNUP_ENABLED?: string
	E2E_EMAIL_REQUIRE_VERIFICATION?: string
	E2E_EMAIL_USER_ACTION_COOLDOWN_SECONDS?: string
}

const e2eEnv =
	(globalThis as unknown as { process?: { env?: E2EEnv } }).process?.env ?? {}
const appBaseUrl: string = e2eEnv.APP_BASE_URL ?? 'http://localhost:5173'
const adminSecret: string = e2eEnv.E2E_ADMIN_SECRET ?? 'admin-secret'
const expectedBetaEnabled: boolean = e2eEnv.E2E_BETA_CODE_ENABLED === 'true'
const expectedGoogleEnabled: boolean = e2eEnv.E2E_GOOGLE_AUTH_ENABLED === 'true'
const expectedEmailEnabled: boolean = e2eEnv.E2E_EMAIL_ENABLED === 'true'
const expectedEmailSignupEnabled: boolean = e2eEnv.E2E_EMAIL_SIGNUP_ENABLED === 'true'
const expectedEmailRequireVerification: boolean =
	e2eEnv.E2E_EMAIL_REQUIRE_VERIFICATION === 'true'
const expectedEmailCooldownSeconds: number = Number(
	e2eEnv.E2E_EMAIL_USER_ACTION_COOLDOWN_SECONDS ?? '50'
)

describe('beta code api e2e', () => {
	beforeAll(async () => {
		const res = await fetch(`${appBaseUrl}/api/health`)
		if (res.status !== 200) {
			throw new Error('dev server is not ready for e2e tests')
		}
	})

	type PublicCaseGiven = Record<string, never>
	type PublicCaseWhen = {
		action: 'get_public_config' | 'generate_beta_codes_without_admin'
	}
	type PublicCaseThen = {
		status: number
		code: string
		betaEnabled: boolean
		googleEnabled: boolean
		emailEnabled: boolean
		emailSignupEnabled: boolean
		emailRequireVerification: boolean
		emailCooldownSeconds: number
	}

	const publicCases: TestCase<PublicCaseGiven, PublicCaseWhen, PublicCaseThen>[] = [
		{
			scenario: 'returns public config without authentication',
			given: 'api server is running',
			when: 'requesting /api/get_public_config',
			then: 'returns feature switches',
			givenDetail: {},
			whenDetail: {
				action: 'get_public_config'
			},
			thenExpected: {
				status: 200,
				code: '',
				betaEnabled: expectedBetaEnabled,
				googleEnabled: expectedGoogleEnabled,
				emailEnabled: expectedEmailEnabled,
				emailSignupEnabled: expectedEmailSignupEnabled,
				emailRequireVerification: expectedEmailRequireVerification,
				emailCooldownSeconds: expectedEmailCooldownSeconds
			}
		},
		{
			scenario: 'rejects admin api without ADMIN_SECRET',
			given: 'no admin authorization header',
			when: 'posting /api/admin/generate_beta_codes',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'generate_beta_codes_without_admin'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED',
				betaEnabled: false,
				googleEnabled: false,
				emailEnabled: false,
				emailSignupEnabled: false,
				emailRequireVerification: false,
				emailCooldownSeconds: 0
			}
		}
	]

	runCases(publicCases, async (_given, when) => {
		if (when.action === 'get_public_config') {
			const res = await postJson('/api/get_public_config', {})
			const payload = (await res.json()) as PublicConfigResponse
			return {
				status: res.status,
				code: '',
				betaEnabled: payload.beta_code_enabled,
				googleEnabled: payload.google_auth_enabled,
				emailEnabled: payload.email_enabled,
				emailSignupEnabled: payload.email_signup_enabled,
				emailRequireVerification: payload.email_require_verification,
				emailCooldownSeconds: payload.email_user_action_cooldown_seconds
			}
		}

		const res = await postJson('/api/admin/generate_beta_codes', { count: 1 })
		const payload = (await res.json()) as { code: string }
		return {
			status: res.status,
			code: payload.code,
			betaEnabled: false,
			googleEnabled: false,
			emailEnabled: false,
			emailSignupEnabled: false,
			emailRequireVerification: false,
			emailCooldownSeconds: 0
		}
	})

	type FlowGiven = Record<string, never>
	type FlowWhen = Record<string, never>
	type FlowThen = {
		generateStatus: number
		listStatus: number
		listContainsGeneratedCode: boolean
		bindWithoutAuthStatus: number
		bindWithoutAuthCode: string
	}

	const flowCases: TestCase<FlowGiven, FlowWhen, FlowThen>[] = [
		{
			scenario: 'supports beta code admin flow and protects bind api by bearer auth',
			given: 'admin secret and unauthenticated request',
			when: 'generating listing and binding beta codes',
			then: 'admin apis work and bind api rejects unauthenticated caller',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				generateStatus: 200,
				listStatus: 200,
				listContainsGeneratedCode: true,
				bindWithoutAuthStatus: 401,
				bindWithoutAuthCode: 'UNAUTHORIZED'
			}
		}
	]

	runCases(flowCases, async () => {
		const generateRes = await postJson(
			'/api/admin/generate_beta_codes',
			{ count: 1 },
			{
				authorization: `Bearer ${adminSecret}`
			}
		)
		const generatePayload = (await generateRes.json()) as GenerateBetaCodesResponse
		const targetBetaCode = generatePayload.codes[0]
		if (!targetBetaCode) {
			throw new Error('failed to generate beta code for e2e flow')
		}

		const listRes = await postJson(
			'/api/admin/list_beta_codes',
			{},
			{
				authorization: `Bearer ${adminSecret}`
			}
		)
		const listPayload = (await listRes.json()) as ListBetaCodesResponse
		const bindWithoutAuthRes = await postJson('/api/bind_beta_code', {
			beta_code: targetBetaCode.code
		})
		const bindWithoutAuthPayload = (await bindWithoutAuthRes.json()) as { code: string }

		return {
			generateStatus: generateRes.status,
			listStatus: listRes.status,
			listContainsGeneratedCode: listPayload.items.some((item) => item.id === targetBetaCode.id),
			bindWithoutAuthStatus: bindWithoutAuthRes.status,
			bindWithoutAuthCode: bindWithoutAuthPayload.code
		}
	})
})

function buildHeaders(extra?: Record<string, string>): Headers {
	const headers = new Headers({
		'content-type': 'application/json'
	})
	if (!extra) {
		return headers
	}
	for (const [k, v] of Object.entries(extra)) {
		headers.set(k, v)
	}
	return headers
}

async function postJson(
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
