import { describe, expect, test } from 'vitest'
import { readPublicConfig } from './public-config'

describe('readPublicConfig', () => {
	test('returns payment_enabled false when PAYMENT_ENABLED=false', () => {
		const config = readPublicConfig({
			BETA_CODE_ENABLED: 'false',
			GOOGLE_AUTH_ENABLED: 'false',
			EMAIL_ENABLED: 'false',
			EMAIL_SIGNUP_ENABLED: 'false',
			EMAIL_REQUIRE_VERIFICATION: 'true',
			EMAIL_USER_ACTION_COOLDOWN_SECONDS: '50',
			PAYMENT_ENABLED: 'false'
		} as unknown as Env)

		expect(config.payment_enabled).toBe(false)
	})
})
