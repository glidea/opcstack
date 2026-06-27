import { beforeAll, describe } from 'vitest'
import { runCases, type TestCase } from '../src/backend/testing/bdd'

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
	E2E_ADMIN_API_TOKEN?: string
}

const e2eEnv =
	(globalThis as unknown as { process?: { env?: E2EEnv } }).process?.env ?? {}
const appBaseUrl: string = e2eEnv.APP_BASE_URL ?? 'http://localhost:5173'
const adminApiToken: string = e2eEnv.E2E_ADMIN_API_TOKEN ?? 'admin-token'

describe('beta code api e2e', () => {
	beforeAll(async () => {
		const res = await fetch(`${appBaseUrl}/api/health`)
		if (res.status !== 200) {
			throw new Error('dev server is not ready for e2e tests')
		}
	})

	type PublicCaseGiven = Record<string, never>
	type PublicCaseWhen = {
		action: 'generate_beta_codes_without_admin'
	}
	type PublicCaseThen = {
		status: number
		code: string
		betaEnabled: boolean
		googleEnabled: boolean
		githubEnabled: boolean
		linuxdoEnabled: boolean
		emailEnabled: boolean
		emailSignupEnabled: boolean
		emailRequireVerification: boolean
		emailCooldownSeconds: number
	}

	const publicCases: TestCase<PublicCaseGiven, PublicCaseWhen, PublicCaseThen>[] = [
		{
			scenario: 'rejects admin api without admin api token',
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
				githubEnabled: false,
				linuxdoEnabled: false,
				emailEnabled: false,
				emailSignupEnabled: false,
				emailRequireVerification: false,
				emailCooldownSeconds: 0
			}
		}
	]

	runCases(publicCases, async (_given, when) => {
		const res = await postJson('/api/admin/generate_beta_codes', { count: 1 })
		const payload = (await res.json()) as { code: string }
		return {
			status: res.status,
			code: payload.code,
			betaEnabled: false,
			googleEnabled: false,
			githubEnabled: false,
			linuxdoEnabled: false,
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
			given: 'admin api token and unauthenticated request',
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
				authorization: `Bearer ${adminApiToken}`
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
				authorization: `Bearer ${adminApiToken}`
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
