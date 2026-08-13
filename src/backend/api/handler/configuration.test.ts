import type { Context } from 'hono'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ApiEnv } from '..'
import type { MetaDb } from '../../db'
import type { SystemSettings } from '../../db/schema.meta'
import {
	getAuthenticationConfigHandler,
	getAffiliateConfigHandler,
	getCreditsConfigHandler,
	getEmailConfigHandler,
	getGeneralConfigHandler,
	getStorageConfigHandler,
	updateAuthenticationConfigHandler,
	updateAffiliateConfigHandler,
	updateCreditsConfigHandler,
	updateEmailConfigHandler,
	updateGeneralConfigHandler,
	updateStorageConfigHandler
} from './configuration'

describe('configuration handlers', () => {
	afterEach((): void => {
		vi.restoreAllMocks()
	})

	test('reads General configuration', async (): Promise<void> => {
		const response: Response = await getGeneralConfigHandler(
			createContext({}, createMetaDb({ row: createSettingsRow() }))
		)

		expect({ status: response.status, body: await response.json() }).toEqual({
			status: 200,
			body: {
				docs_enabled: true,
				version: 1
			}
		})
	})

	test('updates General configuration with expected version', async (): Promise<void> => {
		vi.spyOn(Date, 'now').mockReturnValue(2000)
		const updated: SystemSettings = createSettingsRow()
		updated.generalConfig = {
			docsEnabled: false
		}
		updated.generalVersion = 2
		const response: Response = await updateGeneralConfigHandler(
			createContext(
				{
					docs_enabled: false,
					expected_version: 1
				},
				createMetaDb({ row: createSettingsRow(), updated })
			)
		)

		expect({ status: response.status, body: await response.json() }).toEqual({
			status: 200,
			body: {
				docs_enabled: false,
				version: 2
			}
		})
	})

	test('reads Storage configuration', async (): Promise<void> => {
		const response: Response = await getStorageConfigHandler(
			createContext({}, createMetaDb({ row: createSettingsRow() }))
		)

		expect({ status: response.status, body: await response.json() }).toEqual({
			status: 200,
			body: {
				allowed_content_types: ['image/png', 'image/jpeg', 'image/webp'],
				max_upload_bytes: 5_242_880,
				version: 1
			}
		})
	})

	test('rejects invalid Storage configuration before writing', async (): Promise<void> => {
		const response: Response = await updateStorageConfigHandler(
			createContext(
				{
					allowed_content_types: [],
					max_upload_bytes: 1024,
					expected_version: 1
				},
				createMetaDb({ row: createSettingsRow() })
			)
		)
		const body: { code: string; message: string } = await response.json()

		expect({ status: response.status, code: body.code }).toEqual({
			status: 400,
			code: 'INVALID_REQUEST'
		})
		expect(body.message).toContain('allowed_content_types')
	})

	test('returns conflict for a stale Storage version', async (): Promise<void> => {
		const response: Response = await updateStorageConfigHandler(
			createContext(
				{
					allowed_content_types: ['image/png'],
					max_upload_bytes: 1024,
					expected_version: 1
				},
				createMetaDb({ row: createSettingsRow(), updated: undefined })
			)
		)

		expect({ status: response.status, body: await response.json() }).toEqual({
			status: 409,
			body: {
				code: 'CONFIG_CONFLICT',
				message: 'Configuration has changed'
			}
		})
	})

	test('returns unavailable when settings initialization is missing', async (): Promise<void> => {
		const response: Response = await getGeneralConfigHandler(
			createContext({}, createMetaDb({ row: undefined }))
		)

		expect({ status: response.status, body: await response.json() }).toEqual({
			status: 500,
			body: {
				code: 'CONFIG_UNAVAILABLE',
				message: 'Configuration is unavailable'
			}
		})
	})

	test('reads redacted Authentication configuration with derived callback URLs', async (): Promise<void> => {
		const row: SystemSettings = createSettingsRow()
		row.authenticationConfig.turnstile.secretKey = { ciphertext: 'ciphertext', iv: 'iv' }
		row.authenticationConfig.providers.google.clientSecret = {
			ciphertext: 'ciphertext',
			iv: 'iv'
		}
		const response: Response = await getAuthenticationConfigHandler(
			createContext({}, createMetaDb({ row }))
		)

		expect({ status: response.status, body: await response.json() }).toEqual({
			status: 200,
			body: {
				beta_code_enabled: false,
				registration_enabled: false,
				email_signup_domain_allowlist: [],
				email_require_verification: false,
				email_user_action_cooldown_seconds: 50,
				turnstile_enabled: false,
				google_auth_enabled: false,
				google_client_id: null,
				google_client_secret_configured: true,
				google_callback_url: 'https://app.example.com/api/auth/callback/google',
				github_auth_enabled: false,
				github_client_id: null,
				github_client_secret_configured: false,
				github_callback_url: 'https://app.example.com/api/auth/callback/github',
				linuxdo_auth_enabled: false,
				linuxdo_client_id: null,
				linuxdo_client_secret_configured: false,
				linuxdo_callback_url: 'https://app.example.com/api/auth/oauth2/callback/linuxdo',
				version: 1
			}
		})
	})

	test('rejects enabling Authentication without required credentials', async (): Promise<void> => {
		const response: Response = await updateAuthenticationConfigHandler(
			createContext(
				{
					beta_code_enabled: false,
					registration_enabled: false,
					email_signup_domain_allowlist: [],
					email_require_verification: false,
				email_user_action_cooldown_seconds: 50,
				turnstile_enabled: false,
					google_auth_enabled: true,
					google_client_id: null,
					google_client_secret: { action: 'keep' },
					github_auth_enabled: false,
					github_client_id: null,
					github_client_secret: { action: 'keep' },
					linuxdo_auth_enabled: false,
					linuxdo_client_id: null,
					linuxdo_client_secret: { action: 'keep' },
					expected_version: 1
				},
				createMetaDb({ row: createSettingsRow() })
			)
		)
		const body: { code: string; message: string } = await response.json()

		expect({ status: response.status, code: body.code, message: body.message }).toEqual({
			status: 400,
			code: 'INVALID_REQUEST',
			message: 'providers.google.clientId is required when Google authentication is enabled'
		})
	})

	test('reads and updates redacted Email configuration', async (): Promise<void> => {
		const row: SystemSettings = createSettingsRow()
		const updated: SystemSettings = createSettingsRow()
		updated.emailConfig = {
			provider: 'resend',
			resendApiKey: { ciphertext: 'saved', iv: 'saved-iv' }
		}
		updated.emailVersion = 2
		const response: Response = await updateEmailConfigHandler(
			createContext(
				{
					provider: 'resend',
					resend_api_key: { action: 'replace', value: 'resend-secret' },
					expected_version: 1
				},
				createMetaDb({ row, updated })
			)
		)
		const readResponse: Response = await getEmailConfigHandler(
			createContext({}, createMetaDb({ row: updated }))
		)

			expect({ update: await response.json(), read: await readResponse.json() }).toEqual({
				update: {
					provider: 'resend',
				resend_api_key_configured: true,
				version: 2
			},
				read: {
					provider: 'resend',
				resend_api_key_configured: true,
				version: 2
			}
		})
	})

	test('reads Credits configuration using decimal credit amounts', async (): Promise<void> => {
		const response: Response = await getCreditsConfigHandler(
			createContext({}, createMetaDb({ row: createSettingsRow() }))
		)

		expect({ status: response.status, body: await response.json() }).toEqual({
			status: 200,
			body: {
				signup_enabled: false,
				signup_amount: '100.000000',
				daily_checkin_enabled: false,
				daily_checkin_amount: '10.000000',
				history_retention_days: 90,
				version: 1
			}
		})
	})

	test('updates Affiliate configuration using decimal credit amounts', async (): Promise<void> => {
		const updated: SystemSettings = createSettingsRow()
		updated.affiliateConfig = {
			enabled: true,
			inviterCreditAmount: 75_000_000,
			inviteeCreditAmount: 25_000_000
		}
		updated.affiliateVersion = 2

		const response: Response = await updateAffiliateConfigHandler(
			createContext(
				{
					enabled: true,
					inviter_credit_amount: '75',
					invitee_credit_amount: '25',
					expected_version: 1
				},
				createMetaDb({ row: createSettingsRow(), updated })
			)
		)

		expect({ status: response.status, body: await response.json() }).toEqual({
			status: 200,
			body: {
				enabled: true,
				inviter_credit_amount: '75.000000',
				invitee_credit_amount: '25.000000',
				version: 2
			}
		})
	})

	test('rejects enabling Credits with a zero signup reward', async (): Promise<void> => {
		const response: Response = await updateCreditsConfigHandler(
			createContext(
				{
					signup_enabled: true,
					signup_amount: '0',
					daily_checkin_enabled: false,
					daily_checkin_amount: '10',
					history_retention_days: 90,
					expected_version: 1
				},
				createMetaDb({ row: createSettingsRow() })
			)
		)

		expect({ status: response.status, body: await response.json() }).toEqual({
			status: 400,
			body: {
				code: 'INVALID_REQUEST',
				message: 'signupAmount must be positive when signup credits are enabled'
			}
		})
	})
})

type MetaDbInput = {
	row: SystemSettings | undefined
	updated?: SystemSettings | undefined
}

function createMetaDb(input: MetaDbInput): MetaDb {
	return {
		query: {
			user: {
				findFirst: async (): Promise<{ id: string; email: string }> => ({
					id: 'admin-1',
					email: 'owner@example.com'
				})
			},
			systemSettings: {
				findFirst: async (): Promise<SystemSettings | undefined> => input.row
			}
		},
		update: (): Record<string, unknown> => ({
			set: (): Record<string, unknown> => ({
				where: (): Record<string, unknown> => ({
					returning: async (): Promise<SystemSettings[]> => {
						return input.updated ? [input.updated] : []
					}
				})
			})
		})
	} as unknown as MetaDb
}

function createContext(body: unknown, metaDb: MetaDb): Context<ApiEnv> {
	return {
		env: {
			APP_BASE_URL: 'https://app.example.com',
			CONFIG_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
		},
		req: {
			json: async (): Promise<unknown> => body
		},
		get: (): MetaDb => metaDb,
		json: (payload: unknown, status?: number): Response => {
			return Response.json(payload, { status: status ?? 200 })
		}
	} as unknown as Context<ApiEnv>
}

function createSettingsRow(): SystemSettings {
	return {
		id: 1,
		generalVersion: 1,
		generalUpdatedAt: 1000,
		authenticationVersion: 1,
		authenticationUpdatedAt: 1000,
		emailVersion: 1,
		emailUpdatedAt: 1000,
		storageVersion: 1,
		storageUpdatedAt: 1000,
		creditsVersion: 1,
		creditsUpdatedAt: 1000,
		affiliateVersion: 1,
		affiliateUpdatedAt: 1000,
		generalConfig: {
			docsEnabled: true
		},
		authenticationConfig: {
			betaCodeEnabled: false,
			registrationEnabled: false,
			emailSignupDomainAllowlist: [],
			emailRequireVerification: false,
			emailUserActionCooldownSeconds: 50,
			turnstile: { enabled: false, siteKey: null, secretKey: null },
			providers: {
				google: { enabled: false, clientId: null, clientSecret: null },
				github: { enabled: false, clientId: null, clientSecret: null },
				linuxdo: { enabled: false, clientId: null, clientSecret: null }
			}
		},
			emailConfig: {
				provider: null,
			resendApiKey: null
		},
		storageConfig: {
			allowedContentTypes: ['image/png', 'image/jpeg', 'image/webp'],
			maxUploadBytes: 5_242_880
		},
		creditsConfig: {
			signupEnabled: false,
			signupAmount: 100_000_000,
			dailyCheckinEnabled: false,
			dailyCheckinAmount: 10_000_000,
			historyRetentionDays: 90
		},
		affiliateConfig: {
			enabled: false,
			inviterCreditAmount: 50_000_000,
			inviteeCreditAmount: 20_000_000
		}
	} as unknown as SystemSettings
}
