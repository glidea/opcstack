import { describe } from 'vitest'
import { runCases, type TestCase } from '../../../testing/bdd'
import { getPublicConfig, type PublicConfig } from './client'

type GivenDetail = {
	publicConfig: PublicConfig
}

type WhenDetail = Record<string, never>

type ThenExpected = {
	publicConfig: PublicConfig
	fetchCalls: Array<{ input: string; method: string }>
}

describe('getPublicConfig', () => {
	const publicConfig: PublicConfig = {
		beta_code_enabled: false,
		google_auth_enabled: false,
		email_enabled: true,
		email_signup_enabled: true,
		email_require_verification: true,
		email_user_action_cooldown_seconds: 50,
		credits_signup_enabled: true,
		credits_signup_amount: '100',
		credits_daily_checkin_enabled: true,
		credits_daily_checkin_amount: '10',
		credits_referral_enabled: true,
		payment_enabled: false
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'load public config from backend api',
			given: 'public config response',
			when: 'requesting public config',
			then: 'uses post api and returns config',
			givenDetail: { publicConfig },
			whenDetail: {},
			thenExpected: {
				publicConfig,
				fetchCalls: [{ input: '/api/get_public_config', method: 'POST' }]
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		const fetchCalls: Array<{ input: string; method: string }> = []
		const fetchApi = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			fetchCalls.push({
				input: String(input),
				method: init?.method ?? 'GET'
			})
			return Response.json(given.publicConfig)
		}
		const publicConfig = await getPublicConfig(fetchApi)

		return {
			publicConfig,
			fetchCalls
		}
	})
})
