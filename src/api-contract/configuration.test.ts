import { describe, expect, test } from 'vitest'
import {
	CreatePaymentProductRequestSchema,
	PaymentProductSchema,
	UpdateAuthenticationConfigRequestSchema,
	UpdateEmailConfigRequestSchema,
	UpdateGeneralConfigRequestSchema
} from './configuration'

describe('configuration contract', () => {
	test('accepts complete General updates', (): void => {
		const result = UpdateGeneralConfigRequestSchema.safeParse({
			docs_enabled: false,
			expected_version: 2
		})

		expect(result.success).toBe(true)
	})

	test('accepts a payment product linked to exactly one provider', (): void => {
		const result = PaymentProductSchema.safeParse({
			product_id: 'credits-100',
			provider: 'dodo',
			test_mode: true,
			provider_product_id: 'prod_100',
			type: 'one_time',
			credits_amount: '100',
			subscription_plan: null,
			upgrade_rank: null,
			period_credits_amount: null,
			version: 1
		})

		expect(result.success).toBe(true)
	})

	test('rejects legacy payment provider product columns', (): void => {
		const result = CreatePaymentProductRequestSchema.safeParse({
			product_id: 'credits-100',
			provider: 'dodo',
			provider_product_id: 'prod_100',
			type: 'one_time',
			credits_amount: '100',
			subscription_plan: null,
			upgrade_rank: null,
			period_credits_amount: null,
			dodo_product_id: 'prod_100',
			creem_product_id: null
		})

		expect(result.success).toBe(false)
	})

	test('accepts explicit secret mutations for Authentication', (): void => {
		const result = UpdateAuthenticationConfigRequestSchema.safeParse({
			beta_code_enabled: false,
			registration_enabled: true,
			email_signup_domain_allowlist: ['example.com'],
			email_require_verification: false,
			email_user_action_cooldown_seconds: 50,
			turnstile_enabled: false,
			google_auth_enabled: false,
			google_client_id: null,
			google_client_secret: { action: 'remove' },
			github_auth_enabled: true,
			github_client_id: 'github-client',
			github_client_secret: { action: 'replace', value: 'github-secret' },
			linuxdo_auth_enabled: false,
			linuxdo_client_id: null,
			linuxdo_client_secret: { action: 'keep' },
			expected_version: 1
		})

		expect(result.success).toBe(true)
	})

	test('rejects Turnstile credentials in dynamic Authentication updates', (): void => {
		const result = UpdateAuthenticationConfigRequestSchema.safeParse({
			beta_code_enabled: false,
			registration_enabled: true,
			email_signup_domain_allowlist: [],
			email_require_verification: false,
			email_user_action_cooldown_seconds: 50,
			turnstile_enabled: false,
			turnstile_site_key: 'deployment-site-key',
			turnstile_secret_key: { action: 'keep' },
			google_auth_enabled: false,
			google_client_id: null,
			google_client_secret: { action: 'keep' },
			github_auth_enabled: false,
			github_client_id: null,
			github_client_secret: { action: 'keep' },
			linuxdo_auth_enabled: false,
			linuxdo_client_id: null,
			linuxdo_client_secret: { action: 'keep' },
			expected_version: 1
		})

		expect(result.success).toBe(false)
	})

	test('rejects an empty replacement secret', (): void => {
		const result = UpdateEmailConfigRequestSchema.safeParse({
				provider: 'resend',
			resend_api_key: { action: 'replace', value: '' },
			expected_version: 1
		})

		expect(result.success).toBe(false)
	})
})
