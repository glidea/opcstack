import { describe, expect, test } from 'vitest'
import {
	UpdateAuthenticationConfigRequestSchema,
	UpdateEmailConfigRequestSchema,
	UpdateGeneralConfigRequestSchema,
	UpdateStorageConfigRequestSchema
} from './configuration'

describe('configuration contract', () => {
	test('accepts complete General updates', (): void => {
		const result = UpdateGeneralConfigRequestSchema.safeParse({
			design_system: 'brutalism',
			docs_enabled: false,
			expected_version: 2
		})

		expect(result.success).toBe(true)
	})

	test('rejects duplicate Storage content types', (): void => {
		const result = UpdateStorageConfigRequestSchema.safeParse({
			allowed_content_types: ['image/png', 'image/png'],
			max_upload_bytes: 1024,
			expected_version: 1
		})

		expect(result.success).toBe(false)
	})

	test('rejects an empty Storage content type list', (): void => {
		const result = UpdateStorageConfigRequestSchema.safeParse({
			allowed_content_types: [],
			max_upload_bytes: 1024,
			expected_version: 1
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
			turnstile_site_key: null,
			turnstile_secret_key: { action: 'keep' },
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

		test('rejects an empty replacement secret', (): void => {
			const result = UpdateEmailConfigRequestSchema.safeParse({
				provider: 'resend',
			resend_api_key: { action: 'replace', value: '' },
			expected_version: 1
		})

		expect(result.success).toBe(false)
	})
})
