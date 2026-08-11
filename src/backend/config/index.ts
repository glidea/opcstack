import { and, eq, sql } from 'drizzle-orm'
import type { MetaDb } from '../db'
import { systemSettings, type SystemSettings } from '../db/schema.meta'

export type ConfigStoreErrorCode = 'SETTINGS_NOT_FOUND' | 'VERSION_CONFLICT'

export class ConfigStoreError extends Error {
	readonly code: ConfigStoreErrorCode

	constructor(code: ConfigStoreErrorCode, message: string) {
		super(message)
		this.name = 'ConfigStoreError'
		this.code = code
	}
}

export type GeneralSettingsValues = Pick<SystemSettings, 'designSystem' | 'docsEnabled'>

export type AuthenticationSettingsValues = Pick<
	SystemSettings,
	| 'betaCodeEnabled'
	| 'emailSignupEnabled'
	| 'emailSignupDomainAllowlist'
	| 'emailRequireVerification'
	| 'emailUserActionCooldownSeconds'
	| 'turnstileEnabled'
	| 'turnstileSiteKey'
	| 'turnstileSecretKeyCiphertext'
	| 'turnstileSecretKeyIv'
	| 'googleAuthEnabled'
	| 'googleClientId'
	| 'googleClientSecretCiphertext'
	| 'googleClientSecretIv'
	| 'githubAuthEnabled'
	| 'githubClientId'
	| 'githubClientSecretCiphertext'
	| 'githubClientSecretIv'
	| 'linuxdoAuthEnabled'
	| 'linuxdoClientId'
	| 'linuxdoClientSecretCiphertext'
	| 'linuxdoClientSecretIv'
>

export type EmailSettingsValues = Pick<
	SystemSettings,
	'emailEnabled' | 'emailProvider' | 'emailResendApiKeyCiphertext' | 'emailResendApiKeyIv'
>

export type StorageSettingsValues = Pick<
	SystemSettings,
	'r2UserUploadAllowedContentTypes' | 'r2UserUploadMaxBytes'
>

export type CreditsSettingsValues = Pick<
	SystemSettings,
	| 'creditsSignupEnabled'
	| 'creditsSignupAmount'
	| 'creditsDailyCheckinEnabled'
	| 'creditsDailyCheckinAmount'
	| 'creditsHistoryRetentionDays'
>

export type AffiliateSettingsValues = Pick<
	SystemSettings,
	'affiliateEnabled' | 'affiliateInviterCreditAmount' | 'affiliateInviteeCreditAmount'
>

export type PaymentSettingsValues = Pick<
	SystemSettings,
	| 'paymentEnabled'
	| 'paymentDefaultProvider'
	| 'paymentProviderCountryOverrides'
	| 'paymentDodoTestMode'
	| 'paymentDodoApiKeyCiphertext'
	| 'paymentDodoApiKeyIv'
	| 'paymentDodoWebhookSecretCiphertext'
	| 'paymentDodoWebhookSecretIv'
	| 'paymentCreemTestMode'
	| 'paymentCreemApiKeyCiphertext'
	| 'paymentCreemApiKeyIv'
	| 'paymentCreemWebhookSecretCiphertext'
	| 'paymentCreemWebhookSecretIv'
>

export type AISettingsValues = Pick<
	SystemSettings,
	| 'aiRoutingErrorWeight'
	| 'aiRoutingLatencyWeight'
	| 'aiRoutingPriceWeight'
	| 'aiTaskRetentionDays'
	| 'chatOpenaiEnabled'
	| 'chatOpenaiBaseUrl'
	| 'chatOpenaiDefaultModel'
	| 'chatOpenaiApiKeyCiphertext'
	| 'chatOpenaiApiKeyIv'
	| 'imageGeminiEnabled'
	| 'imageGeminiBaseUrl'
	| 'imageGeminiDefaultModel'
	| 'imageGeminiApiKeyCiphertext'
	| 'imageGeminiApiKeyIv'
	| 'imageOpenaiEnabled'
	| 'imageOpenaiBaseUrl'
	| 'imageOpenaiDefaultModel'
	| 'imageOpenaiApiKeyCiphertext'
	| 'imageOpenaiApiKeyIv'
	| 'imageSeedreamEnabled'
	| 'imageSeedreamBaseUrl'
	| 'imageSeedreamDefaultModel'
	| 'imageSeedreamApiKeyCiphertext'
	| 'imageSeedreamApiKeyIv'
	| 'imageAliyunEnabled'
	| 'imageAliyunBaseUrl'
	| 'imageAliyunDefaultModel'
	| 'imageAliyunApiKeyCiphertext'
	| 'imageAliyunApiKeyIv'
	| 'ttsGeminiEnabled'
	| 'ttsGeminiBaseUrl'
	| 'ttsGeminiDefaultModel'
	| 'ttsGeminiApiKeyCiphertext'
	| 'ttsGeminiApiKeyIv'
	| 'ttsSeedEnabled'
	| 'ttsSeedBaseUrl'
	| 'ttsSeedDefaultModel'
	| 'ttsSeedApiKeyCiphertext'
	| 'ttsSeedApiKeyIv'
	| 'realtimeDoubaoEnabled'
	| 'realtimeDoubaoBaseUrl'
	| 'realtimeDoubaoDefaultModel'
	| 'realtimeDoubaoApiKeyCiphertext'
	| 'realtimeDoubaoApiKeyIv'
	| 'videoSeedanceEnabled'
	| 'videoSeedanceBaseUrl'
	| 'videoSeedanceDefaultModel'
	| 'videoSeedanceApiKeyCiphertext'
	| 'videoSeedanceApiKeyIv'
>

export type SystemSettingsDomainUpdate =
	| DomainUpdate<'general', GeneralSettingsValues>
	| DomainUpdate<'authentication', AuthenticationSettingsValues>
	| DomainUpdate<'email', EmailSettingsValues>
	| DomainUpdate<'storage', StorageSettingsValues>
	| DomainUpdate<'credits', CreditsSettingsValues>
	| DomainUpdate<'affiliate', AffiliateSettingsValues>
	| DomainUpdate<'payment', PaymentSettingsValues>
	| DomainUpdate<'ai', AISettingsValues>

type DomainUpdate<TDomain extends string, TValues> = {
	domain: TDomain
	expectedVersion: number
	values: TValues
	nowMs: number
}

export async function readSystemSettingsSnapshot(db: MetaDb): Promise<SystemSettings> {
	const row: SystemSettings | undefined = await db.query.systemSettings.findFirst({
		where: eq(systemSettings.id, 1)
	})
	if (!row) {
		throw new ConfigStoreError('SETTINGS_NOT_FOUND', 'System settings are unavailable')
	}
	return row
}

export async function updateSystemSettingsDomain(
	db: MetaDb,
	input: SystemSettingsDomainUpdate
): Promise<SystemSettings> {
	switch (input.domain) {
		case 'general': {
			const rows: SystemSettings[] = await db
				.update(systemSettings)
				.set({
					...input.values,
					generalVersion: sql`${systemSettings.generalVersion} + 1`,
					updatedAt: input.nowMs
				})
				.where(
					and(
						eq(systemSettings.id, 1),
						eq(systemSettings.generalVersion, input.expectedVersion)
					)
				)
				.returning()
			return requireUpdatedSettings(rows)
		}
		case 'authentication': {
			const rows: SystemSettings[] = await db
				.update(systemSettings)
				.set({
					...input.values,
					authenticationVersion: sql`${systemSettings.authenticationVersion} + 1`,
					updatedAt: input.nowMs
				})
				.where(
					and(
						eq(systemSettings.id, 1),
						eq(systemSettings.authenticationVersion, input.expectedVersion)
					)
				)
				.returning()
			return requireUpdatedSettings(rows)
		}
		case 'email': {
			const rows: SystemSettings[] = await db
				.update(systemSettings)
				.set({
					...input.values,
					emailVersion: sql`${systemSettings.emailVersion} + 1`,
					updatedAt: input.nowMs
				})
				.where(
					and(
						eq(systemSettings.id, 1),
						eq(systemSettings.emailVersion, input.expectedVersion)
					)
				)
				.returning()
			return requireUpdatedSettings(rows)
		}
		case 'storage': {
			const rows: SystemSettings[] = await db
				.update(systemSettings)
				.set({
					...input.values,
					storageVersion: sql`${systemSettings.storageVersion} + 1`,
					updatedAt: input.nowMs
				})
				.where(
					and(
						eq(systemSettings.id, 1),
						eq(systemSettings.storageVersion, input.expectedVersion)
					)
				)
				.returning()
			return requireUpdatedSettings(rows)
		}
		case 'credits': {
			const rows: SystemSettings[] = await db
				.update(systemSettings)
				.set({
					...input.values,
					creditsVersion: sql`${systemSettings.creditsVersion} + 1`,
					updatedAt: input.nowMs
				})
				.where(
					and(
						eq(systemSettings.id, 1),
						eq(systemSettings.creditsVersion, input.expectedVersion)
					)
				)
				.returning()
			return requireUpdatedSettings(rows)
		}
		case 'affiliate': {
			const rows: SystemSettings[] = await db
				.update(systemSettings)
				.set({
					...input.values,
					affiliateVersion: sql`${systemSettings.affiliateVersion} + 1`,
					updatedAt: input.nowMs
				})
				.where(
					and(
						eq(systemSettings.id, 1),
						eq(systemSettings.affiliateVersion, input.expectedVersion)
					)
				)
				.returning()
			return requireUpdatedSettings(rows)
		}
		case 'payment': {
			const rows: SystemSettings[] = await db
				.update(systemSettings)
				.set({
					...input.values,
					paymentVersion: sql`${systemSettings.paymentVersion} + 1`,
					updatedAt: input.nowMs
				})
				.where(
					and(
						eq(systemSettings.id, 1),
						eq(systemSettings.paymentVersion, input.expectedVersion)
					)
				)
				.returning()
			return requireUpdatedSettings(rows)
		}
		case 'ai': {
			const rows: SystemSettings[] = await db
				.update(systemSettings)
				.set({
					...input.values,
					aiVersion: sql`${systemSettings.aiVersion} + 1`,
					updatedAt: input.nowMs
				})
				.where(
					and(
						eq(systemSettings.id, 1),
						eq(systemSettings.aiVersion, input.expectedVersion)
					)
				)
				.returning()
			return requireUpdatedSettings(rows)
		}
	}
}

function requireUpdatedSettings(rows: SystemSettings[]): SystemSettings {
	const row: SystemSettings | undefined = rows[0]
	if (!row) {
		throw new ConfigStoreError('VERSION_CONFLICT', 'System settings version conflict')
	}
	return row
}

export * from './crypto'
