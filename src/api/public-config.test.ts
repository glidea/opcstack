import { describe } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import { readPublicConfig } from './public-config'

describe('readPublicConfig', () => {
	type GivenDetail = {
		paymentEnabled: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		paymentEnabled: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'map payment flag from env',
			given: 'PAYMENT_ENABLED=false',
			when: 'reading public config',
			then: 'payment_enabled becomes false',
			givenDetail: {
				paymentEnabled: 'false'
			},
			whenDetail: {},
			thenExpected: {
				paymentEnabled: false
			}
		}
	]

	runCases(cases, async (given) => {
		const config = readPublicConfig({
			BETA_CODE_ENABLED: 'false',
			GOOGLE_AUTH_ENABLED: 'false',
			EMAIL_ENABLED: 'false',
			EMAIL_SIGNUP_ENABLED: 'false',
			EMAIL_REQUIRE_VERIFICATION: 'true',
			EMAIL_USER_ACTION_COOLDOWN_SECONDS: '50',
			PAYMENT_ENABLED: given.paymentEnabled
		} as unknown as Env)

		return {
			paymentEnabled: config.payment_enabled
		}
	})
})
