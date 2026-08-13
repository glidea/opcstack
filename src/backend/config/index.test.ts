import { describe, expect, it } from 'vitest'
import type { MetaDb } from '../db'
import type { SystemSettings } from '../db/schema.meta'
import {
	ConfigStoreError,
	getAffiliateConfig,
	getAuthenticationConfig,
	getCreditsConfig,
	getEmailConfig,
	getPublicRuntimeConfig,
	getStorageConfig,
	readSystemSettingsSnapshot,
	updateAuthenticationConfig,
	updateAffiliateConfig,
	updateCreditsConfig,
	updateEmailConfig,
	updateStorageConfig,
	updateSystemSettingsDomain
} from './index'

describe('system configuration store', () => {
	it('reads the singleton settings row once for an operation snapshot', async (): Promise<void> => {
		const row: SystemSettings = createSettingsRow(1)
		let reads: number = 0
		const db: MetaDb = createConfigDb({
			row,
			onRead: (): void => {
				reads += 1
			}
		})

		const result: SystemSettings = await readSystemSettingsSnapshot(db)

		expect({ id: result.id, reads }).toEqual({ id: 1, reads: 1 })
	})

	it('fails when initialization did not create settings', async (): Promise<void> => {
		const db: MetaDb = createConfigDb({ row: undefined })

		await expect(readSystemSettingsSnapshot(db)).rejects.toEqual(
			new ConfigStoreError('SETTINGS_NOT_FOUND', 'System settings are unavailable')
		)
	})

	it('updates one domain and increments only its version', async (): Promise<void> => {
		const updated: SystemSettings = createSettingsRow(2)
		const db: MetaDb = createConfigDb({ row: createSettingsRow(1), updated })

		const result: SystemSettings = await updateSystemSettingsDomain(db, {
			domain: 'general',
			expectedVersion: 1,
			values: {
				designSystem: 'brutalism',
				docsEnabled: false
			},
			nowMs: 2000
		})

		expect({ version: result.generalVersion, config: result.generalConfig }).toEqual({
			version: 2,
			config: {
				designSystem: 'brutalism',
				docsEnabled: false
			}
		})
	})

	it('rejects a stale domain version without changing settings', async (): Promise<void> => {
		const db: MetaDb = createConfigDb({ row: createSettingsRow(2), updated: undefined })

		await expect(
			updateSystemSettingsDomain(db, {
				domain: 'general',
				expectedVersion: 1,
				values: { designSystem: 'brutalism', docsEnabled: false },
				nowMs: 2000
			})
		).rejects.toEqual(new ConfigStoreError('VERSION_CONFLICT', 'System settings version conflict'))
	})

	it('maps one settings read to the public runtime snapshot', async (): Promise<void> => {
		let reads: number = 0
		const db: MetaDb = createConfigDb({
			row: createSettingsRow(1),
			onRead: (): void => {
				reads += 1
			}
		})

		const result = await getPublicRuntimeConfig(db)

		expect({ result, reads }).toEqual({
			result: {
				support_email: 'admin@opcstack.local',
				design_system: 'apple-saas',
				docs_enabled: true,
				payment_enabled: false,
				email_enabled: false,
				email_signup_enabled: false,
				email_require_verification: false,
				email_user_action_cooldown_seconds: 50,
				google_auth_enabled: false,
				github_auth_enabled: false,
				linuxdo_auth_enabled: false,
				turnstile_enabled: false,
				turnstile_site_key: null
			},
			reads: 1
		})
	})

	it('reads Authentication and Email without exposing secret values', async (): Promise<void> => {
		const row: SystemSettings = createSettingsRow(1)
		row.authenticationConfig.providers.google.clientSecret = {
			ciphertext: 'ciphertext',
			iv: 'iv'
		}
		row.emailConfig.resendApiKey = { ciphertext: 'ciphertext', iv: 'iv' }
		const db: MetaDb = createConfigDb({ row })

		const authentication = await getAuthenticationConfig(db)
		const email = await getEmailConfig(db)

		expect({ authentication, email }).toEqual({
			authentication: {
				...row.authenticationConfig,
				version: 1
			},
			email: {
				...row.emailConfig,
				version: 1
			}
		})
	})

	it('rejects enabling an OAuth provider without complete credentials before writing', async (): Promise<void> => {
		let writes: number = 0
		const db: MetaDb = createConfigDb({
			row: createSettingsRow(1),
			onWrite: (): void => {
				writes += 1
			}
		})

		await expect(
			updateAuthenticationConfig(db, TEST_ENCRYPTION_KEY, {
				betaCodeEnabled: false,
				emailSignupEnabled: false,
				emailSignupDomainAllowlist: [],
				emailRequireVerification: false,
				emailUserActionCooldownSeconds: 50,
				turnstile: { enabled: false, siteKey: null, secretKey: { action: 'keep' } },
				providers: {
					google: { enabled: true, clientId: null, clientSecret: { action: 'keep' } },
					github: { enabled: false, clientId: null, clientSecret: { action: 'keep' } },
					linuxdo: { enabled: false, clientId: null, clientSecret: { action: 'keep' } }
				},
				expectedVersion: 1,
				nowMs: 2000
			})
		).rejects.toEqual(
			new ConfigStoreError(
				'INVALID_UPDATE',
				'providers.google.clientId is required when Google authentication is enabled'
			)
		)
		expect(writes).toBe(0)
	})

	it('rejects a partially configured disabled OAuth provider before writing', async (): Promise<void> => {
		const db: MetaDb = createConfigDb({ row: createSettingsRow(1) })

		await expect(updateAuthenticationConfig(db, TEST_ENCRYPTION_KEY, {
			betaCodeEnabled: false,
			emailSignupEnabled: false,
			emailSignupDomainAllowlist: [],
			emailRequireVerification: false,
			emailUserActionCooldownSeconds: 50,
			turnstile: { enabled: false, siteKey: null, secretKey: { action: 'keep' } },
			providers: {
				google: { enabled: false, clientId: 'client-id', clientSecret: { action: 'keep' } },
				github: { enabled: false, clientId: null, clientSecret: { action: 'keep' } },
				linuxdo: { enabled: false, clientId: null, clientSecret: { action: 'keep' } }
			},
			expectedVersion: 1,
			nowMs: 2000
		})).rejects.toEqual(new ConfigStoreError(
			'INVALID_UPDATE',
			'providers.google.clientSecret is required when Google authentication is configured'
		))
	})

	it('replaces an Email secret and validates the resulting provider atomically', async (): Promise<void> => {
		const updated: SystemSettings = createSettingsRow(1)
		updated.emailConfig = {
			enabled: true,
			provider: 'resend',
			resendApiKey: { ciphertext: 'saved', iv: 'saved-iv' }
		}
		updated.emailVersion = 2
		const db: MetaDb = createConfigDb({
			row: createSettingsRow(1),
			updated,
			administratorEmail: 'owner@example.com'
		})

		const result = await updateEmailConfig(db, TEST_ENCRYPTION_KEY, {
			enabled: true,
			provider: 'resend',
			resendApiKey: { action: 'replace', value: 'resend-secret' },
			expectedVersion: 1,
			nowMs: 2000
		})

		expect(result).toEqual({ ...updated.emailConfig, version: 2 })
	})

	it('rejects a partially configured disabled Email provider', async (): Promise<void> => {
		const db: MetaDb = createConfigDb({ row: createSettingsRow(1) })

		await expect(updateEmailConfig(db, TEST_ENCRYPTION_KEY, {
			enabled: false,
			provider: 'resend',
			resendApiKey: { action: 'keep' },
			expectedVersion: 1,
			nowMs: 2000
		})).rejects.toEqual(new ConfigStoreError(
			'INVALID_UPDATE',
			'resendApiKey is required when the Resend provider is configured'
		))
	})

	it('rejects enabling Email while the administrator uses the local address', async (): Promise<void> => {
		const db: MetaDb = createConfigDb({ row: createSettingsRow(1) })

		await expect(updateEmailConfig(db, TEST_ENCRYPTION_KEY, {
			enabled: true,
			provider: 'cloudflare',
			resendApiKey: { action: 'keep' },
			expectedVersion: 1,
			nowMs: 2000
		})).rejects.toEqual(new ConfigStoreError(
			'INVALID_UPDATE',
			'Administrator email must be changed before Email is enabled'
		))
	})

	it('reads Storage as a validated operation snapshot', async (): Promise<void> => {
		const db: MetaDb = createConfigDb({ row: createSettingsRow(1) })

		const result = await getStorageConfig(db)

		expect(result).toEqual({
			allowedContentTypes: ['image/png', 'image/jpeg', 'image/webp'],
			maxUploadBytes: 5_242_880,
			version: 1
		})
	})

	it('rejects invalid Storage data read from D1', async (): Promise<void> => {
		const row: SystemSettings = createSettingsRow(1)
		row.storageConfig.allowedContentTypes = ['image/png', 'image/png']
		const db: MetaDb = createConfigDb({ row })

		await expect(getStorageConfig(db)).rejects.toEqual(
			new ConfigStoreError('SETTINGS_INVALID', 'Storage settings are invalid')
		)
	})

	it('updates Storage as one versioned domain', async (): Promise<void> => {
		const updated: SystemSettings = createSettingsRow(1, 2)
		updated.storageConfig = {
			allowedContentTypes: ['text/plain'],
			maxUploadBytes: 1024
		}
		const db: MetaDb = createConfigDb({ row: createSettingsRow(1), updated })

		const result = await updateStorageConfig(db, {
			allowedContentTypes: ['text/plain'],
			maxUploadBytes: 1024,
			expectedVersion: 1,
			nowMs: 2000
		})

		expect(result).toEqual({
			allowedContentTypes: ['text/plain'],
			maxUploadBytes: 1024,
			version: 2
		})
	})

	it('reads Credits and Affiliate as validated operation snapshots', async (): Promise<void> => {
		const db: MetaDb = createConfigDb({ row: createSettingsRow(1) })

		const credits = await getCreditsConfig(db)
		const affiliate = await getAffiliateConfig(db)

		expect({ credits, affiliate }).toEqual({
			credits: {
				signupEnabled: false,
				signupAmount: 100_000_000,
				dailyCheckinEnabled: false,
				dailyCheckinAmount: 10_000_000,
				historyRetentionDays: 90,
				version: 1
			},
			affiliate: {
				enabled: false,
				inviterCreditAmount: 50_000_000,
				inviteeCreditAmount: 20_000_000,
				version: 1
			}
		})
	})

	it('rejects enabling a Credits reward with zero amount before writing', async (): Promise<void> => {
		let writes: number = 0
		const db: MetaDb = createConfigDb({
			row: createSettingsRow(1),
			onWrite: (): void => {
				writes += 1
			}
		})

		await expect(updateCreditsConfig(db, {
			signupEnabled: true,
			signupAmount: 0,
			dailyCheckinEnabled: false,
			dailyCheckinAmount: 10_000_000,
			historyRetentionDays: 90,
			expectedVersion: 1,
			nowMs: 2000
		})).rejects.toEqual(new ConfigStoreError(
			'INVALID_UPDATE',
			'signupAmount must be positive when signup credits are enabled'
		))
		expect(writes).toBe(0)
	})

	it('updates Affiliate rewards as one versioned domain', async (): Promise<void> => {
		const updated: SystemSettings = createSettingsRow(1)
		updated.affiliateConfig = {
			enabled: true,
			inviterCreditAmount: 75_000_000,
			inviteeCreditAmount: 25_000_000
		}
		updated.affiliateVersion = 2
		const db: MetaDb = createConfigDb({ row: createSettingsRow(1), updated })

		const result = await updateAffiliateConfig(db, {
			enabled: true,
			inviterCreditAmount: 75_000_000,
			inviteeCreditAmount: 25_000_000,
			expectedVersion: 1,
			nowMs: 2000
		})

		expect(result).toEqual({ ...updated.affiliateConfig, version: 2 })
	})
})

type ConfigDbInput = {
	row: SystemSettings | undefined
	updated?: SystemSettings | undefined
	administratorEmail?: string
	onRead?: () => void
	onWrite?: () => void
}

function createConfigDb(input: ConfigDbInput): MetaDb {
	return {
		query: {
			user: {
				findFirst: async (): Promise<{ id: string; email: string }> => ({
					id: 'admin-1',
					email: input.administratorEmail ?? 'admin@opcstack.local'
				})
			},
				systemSettings: {
					findFirst: async (): Promise<SystemSettings | undefined> => {
						if (input.onRead) {
							input.onRead()
						}
						return input.row
				}
			}
		},
		update: () => ({
			set: () => ({
				where: () => ({
					returning: async (): Promise<SystemSettings[]> => {
						input.onWrite?.()
						return input.updated ? [input.updated] : []
					}
				})
			})
		})
	} as unknown as MetaDb
}

function createSettingsRow(generalVersion: number, storageVersion: number = 1): SystemSettings {
	return {
		id: 1,
		generalVersion,
		generalUpdatedAt: 1000,
		authenticationVersion: 1,
		authenticationUpdatedAt: 1000,
		emailVersion: 1,
		emailUpdatedAt: 1000,
		storageVersion,
		storageUpdatedAt: 1000,
		creditsVersion: 1,
		creditsUpdatedAt: 1000,
		affiliateVersion: 1,
		affiliateUpdatedAt: 1000,
		generalConfig: {
			designSystem: generalVersion === 1 ? 'apple-saas' : 'brutalism',
			docsEnabled: generalVersion === 1
		},
		authenticationConfig: {
			betaCodeEnabled: false,
			emailSignupEnabled: false,
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
			enabled: false,
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
			},
			paymentConfig: {
				enabled: false,
				defaultProvider: null,
				providerCountryOverrides: [],
				providers: {
					dodo: { testMode: false, apiKey: null, webhookSecret: null },
					creem: { testMode: false, apiKey: null, webhookSecret: null }
				}
			}
	} as unknown as SystemSettings
}

const TEST_ENCRYPTION_KEY: string = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
