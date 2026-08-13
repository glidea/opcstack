import { beforeAll, describe } from 'vitest'
import { runCases, type TestCase } from '../src/backend/testing/bdd'

type E2EEnv = {
	APP_BASE_URL?: string
}

const e2eEnv =
	(globalThis as unknown as { process?: { env?: E2EEnv } }).process?.env ?? {}
const appBaseUrl: string = e2eEnv.APP_BASE_URL ?? 'http://localhost:5173'

describe('credits api e2e', () => {
	beforeAll(async () => {
		const res = await fetch(`${appBaseUrl}/api/health`)
		if (res.status !== 200) {
			throw new Error('dev server is not ready for e2e tests')
		}
	})

	type GivenDetail = Record<string, never>
	type WhenDetail = {
		action:
			| 'get_credit_summary_without_auth'
			| 'daily_checkin_without_auth'
			| 'redeem_code_without_auth'
			| 'admin_grant_without_auth'
	}
	type ThenExpected = {
		status: number
		code: string
		hasCreditsFields: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'credit summary requires auth',
			given: 'no bearer token',
			when: 'calling /api/get_credit_summary',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'get_credit_summary_without_auth'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED',
				hasCreditsFields: false
			}
		},
		{
			scenario: 'daily checkin requires auth',
			given: 'no bearer token',
			when: 'calling /api/daily_checkin',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'daily_checkin_without_auth'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED',
				hasCreditsFields: false
			}
		},
		{
			scenario: 'redeem credit code requires auth',
			given: 'no bearer token',
			when: 'calling /api/redeem_credit_code',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'redeem_code_without_auth'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED',
				hasCreditsFields: false
			}
		},
		{
			scenario: 'admin grant requires an administrator session',
			given: 'no admin authorization header',
			when: 'calling /api/admin/grant_credits',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'admin_grant_without_auth'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED',
				hasCreditsFields: false
			}
		}
	]

	runCases(cases, async (_given, when) => {
		if (when.action === 'get_credit_summary_without_auth') {
			const res = await postJson('/api/get_credit_summary', {})
			const payload = (await res.json()) as { code: string }
			return {
				status: res.status,
				code: payload.code,
				hasCreditsFields: false
			}
		}

		if (when.action === 'daily_checkin_without_auth') {
			const res = await postJson('/api/daily_checkin', {})
			const payload = (await res.json()) as { code: string }
			return {
				status: res.status,
				code: payload.code,
				hasCreditsFields: false
			}
		}

		if (when.action === 'redeem_code_without_auth') {
			const res = await postJson('/api/redeem_credit_code', { code: 'AAA' })
			const payload = (await res.json()) as { code: string }
			return {
				status: res.status,
				code: payload.code,
				hasCreditsFields: false
			}
		}

		const res = await postJson('/api/admin/grant_credits', {
			user_id: 'u1',
			amount: '10',
			source_id: 's1',
			description: 'x'
		})
		const payload = (await res.json()) as { code: string }
		return {
			status: res.status,
			code: payload.code,
			hasCreditsFields: false
		}
	})
})

function postJson(path: string, body: unknown): Promise<Response> {
	return fetch(`${appBaseUrl}${path}`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify(body)
	})
}
