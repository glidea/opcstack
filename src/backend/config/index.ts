import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { MetaDb } from '../db'
import {
	systemSettings,
	type AffiliateSettingsDocument,
	type AISettingsDocument,
	type AuthenticationSettingsDocument,
	type CreditsSettingsDocument,
	type EmailSettingsDocument,
	type GeneralSettingsDocument,
	type PaymentSettingsDocument,
	type StorageSettingsDocument,
	type SystemSettings
} from '../db/schema.meta'
import {
	decryptConfigSecret,
	mutateConfigSecret,
	type SecretMutation
} from './crypto'
import { getAdministrator } from '../auth/administrator'

export type ConfigStoreErrorCode =
	| 'SETTINGS_NOT_FOUND'
	| 'SETTINGS_INVALID'
	| 'INVALID_UPDATE'
	| 'VERSION_CONFLICT'

export class ConfigStoreError extends Error {
	readonly code: ConfigStoreErrorCode

	constructor(code: ConfigStoreErrorCode, message: string) {
		super(message)
		this.name = 'ConfigStoreError'
		this.code = code
	}
}

export type GeneralConfig = GeneralSettingsDocument & {
	version: number
}

export type StorageConfig = StorageSettingsDocument & {
	version: number
}

export type AuthenticationConfig = AuthenticationSettingsDocument & {
	version: number
}

export type EmailConfig = EmailSettingsDocument & {
	version: number
}

export type AuthenticationRuntimeConfig = Omit<
	AuthenticationSettingsDocument,
	'turnstile' | 'providers'
> & {
	turnstile: {
		enabled: boolean
		siteKey: string | null
		secretKey: string | null
	}
	providers: {
		google: AuthenticationRuntimeProviderConfig
		github: AuthenticationRuntimeProviderConfig
		linuxdo: AuthenticationRuntimeProviderConfig
	}
}

export type AuthenticationRuntimeProviderConfig = {
	enabled: boolean
	clientId: string | null
	clientSecret: string | null
}

export type EmailRuntimeConfig = {
	enabled: boolean
	provider: EmailSettingsDocument['provider']
	resendApiKey: string | null
}

export type AuthRuntimeConfig = {
	systemEmail: string
	authentication: AuthenticationRuntimeConfig
	email: EmailRuntimeConfig
}

export type PublicRuntimeConfig = {
	support_email: string
	design_system: GeneralSettingsDocument['designSystem']
	docs_enabled: boolean
	email_enabled: boolean
	email_signup_enabled: boolean
	email_require_verification: boolean
	email_user_action_cooldown_seconds: number
	google_auth_enabled: boolean
	github_auth_enabled: boolean
	linuxdo_auth_enabled: boolean
	turnstile_enabled: boolean
	turnstile_site_key: string | null
}

export type UpdateGeneralConfigInput = GeneralSettingsDocument & {
	expectedVersion: number
	nowMs: number
}

export type UpdateStorageConfigInput = StorageSettingsDocument & {
	expectedVersion: number
	nowMs: number
}

export type UpdateAuthenticationConfigInput = {
	betaCodeEnabled: boolean
	emailSignupEnabled: boolean
	emailSignupDomainAllowlist: string[]
	emailRequireVerification: boolean
	emailUserActionCooldownSeconds: number
	turnstile: {
		enabled: boolean
		siteKey: string | null
		secretKey: SecretMutation
	}
	providers: {
		google: AuthenticationProviderUpdate
		github: AuthenticationProviderUpdate
		linuxdo: AuthenticationProviderUpdate
	}
	expectedVersion: number
	nowMs: number
}

type AuthenticationProviderUpdate = {
	enabled: boolean
	clientId: string | null
	clientSecret: SecretMutation
}

export type UpdateEmailConfigInput = {
	enabled: boolean
	provider: EmailSettingsDocument['provider']
	resendApiKey: SecretMutation
	expectedVersion: number
	nowMs: number
}

export type SystemSettingsDomainUpdate =
	| DomainUpdate<'general', GeneralSettingsDocument>
	| DomainUpdate<'authentication', AuthenticationSettingsDocument>
	| DomainUpdate<'email', EmailSettingsDocument>
	| DomainUpdate<'storage', StorageSettingsDocument>
	| DomainUpdate<'credits', CreditsSettingsDocument>
	| DomainUpdate<'affiliate', AffiliateSettingsDocument>
	| DomainUpdate<'payment', PaymentSettingsDocument>
	| DomainUpdate<'ai', AISettingsDocument>

type DomainUpdate<TDomain extends string, TValues> = {
	domain: TDomain
	expectedVersion: number
	values: TValues
	nowMs: number
}

const GeneralSettingsSchema = z.object({
	designSystem: z.enum(['apple-saas', 'brutalism']),
	docsEnabled: z.boolean()
})

const StorageSettingsSchema = z.object({
	allowedContentTypes: z
		.array(z.string().trim().min(1))
		.min(1)
		.refine((items: string[]): boolean => new Set(items).size === items.length),
	maxUploadBytes: z.number().int().positive()
})

const EncryptedSecretSchema = z.object({
	ciphertext: z.string().min(1),
	iv: z.string().min(1)
})

const AuthenticationProviderSchema = z.object({
	enabled: z.boolean(),
	clientId: z.string().trim().min(1).nullable(),
	clientSecret: EncryptedSecretSchema.nullable()
})

const AuthenticationSettingsSchema = z.object({
	betaCodeEnabled: z.boolean(),
	emailSignupEnabled: z.boolean(),
	emailSignupDomainAllowlist: z
		.array(z.string().trim().toLowerCase().min(1))
		.refine((items: string[]): boolean => new Set(items).size === items.length),
	emailRequireVerification: z.boolean(),
	emailUserActionCooldownSeconds: z.number().int().positive(),
	turnstile: z.object({
		enabled: z.boolean(),
		siteKey: z.string().trim().min(1).nullable(),
		secretKey: EncryptedSecretSchema.nullable()
	}),
	providers: z.object({
		google: AuthenticationProviderSchema,
		github: AuthenticationProviderSchema,
		linuxdo: AuthenticationProviderSchema
	})
})

const EmailSettingsSchema = z.object({
	enabled: z.boolean(),
	provider: z.enum(['cloudflare', 'resend']).nullable(),
	resendApiKey: EncryptedSecretSchema.nullable()
})

export async function readSystemSettingsSnapshot(db: MetaDb): Promise<SystemSettings> {
	const row: SystemSettings | undefined = await db.query.systemSettings.findFirst({
		where: eq(systemSettings.id, 1)
	})
	if (!row) {
		throw new ConfigStoreError('SETTINGS_NOT_FOUND', 'System settings are unavailable')
	}
	return row
}

export async function getGeneralConfig(db: MetaDb): Promise<GeneralConfig> {
	const settings: SystemSettings = await readSystemSettingsSnapshot(db)
	return toGeneralConfig(settings)
}

export async function updateGeneralConfig(
	db: MetaDb,
	input: UpdateGeneralConfigInput
): Promise<GeneralConfig> {
	const values: GeneralSettingsDocument = parseGeneralSettings({
		designSystem: input.designSystem,
		docsEnabled: input.docsEnabled
	})
	const settings: SystemSettings = await updateSystemSettingsDomain(db, {
		domain: 'general',
		expectedVersion: input.expectedVersion,
		values,
		nowMs: input.nowMs
	})
	return toGeneralConfig(settings)
}

export async function getStorageConfig(db: MetaDb): Promise<StorageConfig> {
	const settings: SystemSettings = await readSystemSettingsSnapshot(db)
	return toStorageConfig(settings)
}

export async function updateStorageConfig(
	db: MetaDb,
	input: UpdateStorageConfigInput
): Promise<StorageConfig> {
	const values: StorageSettingsDocument = parseStorageSettings({
		allowedContentTypes: input.allowedContentTypes,
		maxUploadBytes: input.maxUploadBytes
	})
	const settings: SystemSettings = await updateSystemSettingsDomain(db, {
		domain: 'storage',
		expectedVersion: input.expectedVersion,
		values,
		nowMs: input.nowMs
	})
	return toStorageConfig(settings)
}

export async function getAuthenticationConfig(db: MetaDb): Promise<AuthenticationConfig> {
	const settings: SystemSettings = await readSystemSettingsSnapshot(db)
	return toAuthenticationConfig(settings)
}

export async function getEmailConfig(db: MetaDb): Promise<EmailConfig> {
	const settings: SystemSettings = await readSystemSettingsSnapshot(db)
	return toEmailConfig(settings)
}

export async function updateAuthenticationConfig(
	db: MetaDb,
	encryptionKey: string,
	input: UpdateAuthenticationConfigInput
): Promise<AuthenticationConfig> {
	const current: AuthenticationConfig = await getAuthenticationConfig(db)
	const values: AuthenticationSettingsDocument = parseAuthenticationSettings({
		betaCodeEnabled: input.betaCodeEnabled,
		emailSignupEnabled: input.emailSignupEnabled,
		emailSignupDomainAllowlist: input.emailSignupDomainAllowlist,
		emailRequireVerification: input.emailRequireVerification,
		emailUserActionCooldownSeconds: input.emailUserActionCooldownSeconds,
		turnstile: {
			enabled: input.turnstile.enabled,
			siteKey: input.turnstile.siteKey,
			secretKey: await mutateConfigSecret(
				encryptionKey,
				current.turnstile.secretKey,
				input.turnstile.secretKey
			)
		},
		providers: {
			google: await applyAuthenticationProviderUpdate(
				encryptionKey,
				current.providers.google,
				input.providers.google
			),
			github: await applyAuthenticationProviderUpdate(
				encryptionKey,
				current.providers.github,
				input.providers.github
			),
			linuxdo: await applyAuthenticationProviderUpdate(
				encryptionKey,
				current.providers.linuxdo,
				input.providers.linuxdo
			)
		}
	})
	validateAuthenticationDependencies(values)
	const settings: SystemSettings = await updateSystemSettingsDomain(db, {
		domain: 'authentication',
		expectedVersion: input.expectedVersion,
		values,
		nowMs: input.nowMs
	})
	return toAuthenticationConfig(settings)
}

export async function updateEmailConfig(
	db: MetaDb,
	encryptionKey: string,
	input: UpdateEmailConfigInput
): Promise<EmailConfig> {
	const current: EmailConfig = await getEmailConfig(db)
	const values: EmailSettingsDocument = parseEmailSettings({
		enabled: input.enabled,
		provider: input.provider,
		resendApiKey: await mutateConfigSecret(
			encryptionKey,
			current.resendApiKey,
			input.resendApiKey
		)
	})
	validateEmailDependencies(values)
	if (values.enabled) {
		const administrator = await getAdministrator(db)
		if (administrator.email.endsWith('@opcstack.local')) {
			throw new ConfigStoreError(
				'INVALID_UPDATE',
				'Administrator email must be changed before Email is enabled'
			)
		}
	}
	const settings: SystemSettings = await updateSystemSettingsDomain(db, {
		domain: 'email',
		expectedVersion: input.expectedVersion,
		values,
		nowMs: input.nowMs
	})
	return toEmailConfig(settings)
}

export async function getAuthRuntimeConfig(
	db: MetaDb,
	encryptionKey: string
): Promise<AuthRuntimeConfig> {
	const settings: SystemSettings = await readSystemSettingsSnapshot(db)
	const authentication: AuthenticationSettingsDocument = parseAuthenticationSettings(
		settings.authenticationConfig
	)
	const email: EmailSettingsDocument = parseEmailSettings(settings.emailConfig)
	const administrator = await getAdministrator(db)
	validateAuthenticationDependencies(authentication)
	validateEmailDependencies(email)
	return {
		systemEmail: administrator.email,
		authentication: await decryptAuthenticationConfig(encryptionKey, authentication),
		email: {
			enabled: email.enabled,
			provider: email.provider,
			resendApiKey: email.resendApiKey
				? await decryptConfigSecret(encryptionKey, email.resendApiKey)
				: null
		}
	}
}

export async function getPublicRuntimeConfig(db: MetaDb): Promise<PublicRuntimeConfig> {
	const settings: SystemSettings = await readSystemSettingsSnapshot(db)
	const general: GeneralSettingsDocument = parseGeneralSettings(settings.generalConfig)
	const authentication: AuthenticationSettingsDocument = parseAuthenticationSettings(
		settings.authenticationConfig
	)
	const email: EmailSettingsDocument = parseEmailSettings(settings.emailConfig)
	const administrator = await getAdministrator(db)
	validateAuthenticationDependencies(authentication)
	validateEmailDependencies(email)
	return {
		support_email: administrator.email,
		design_system: general.designSystem,
		docs_enabled: general.docsEnabled,
		email_enabled: email.enabled,
		email_signup_enabled: authentication.emailSignupEnabled,
		email_require_verification: authentication.emailRequireVerification,
		email_user_action_cooldown_seconds: authentication.emailUserActionCooldownSeconds,
		google_auth_enabled: authentication.providers.google.enabled,
		github_auth_enabled: authentication.providers.github.enabled,
		linuxdo_auth_enabled: authentication.providers.linuxdo.enabled,
		turnstile_enabled: authentication.turnstile.enabled,
		turnstile_site_key: authentication.turnstile.siteKey
	}
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
					generalConfig: input.values,
					generalVersion: sql`${systemSettings.generalVersion} + 1`,
					generalUpdatedAt: input.nowMs
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
					authenticationConfig: input.values,
					authenticationVersion: sql`${systemSettings.authenticationVersion} + 1`,
					authenticationUpdatedAt: input.nowMs
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
					emailConfig: input.values,
					emailVersion: sql`${systemSettings.emailVersion} + 1`,
					emailUpdatedAt: input.nowMs
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
					storageConfig: input.values,
					storageVersion: sql`${systemSettings.storageVersion} + 1`,
					storageUpdatedAt: input.nowMs
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
					creditsConfig: input.values,
					creditsVersion: sql`${systemSettings.creditsVersion} + 1`,
					creditsUpdatedAt: input.nowMs
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
					affiliateConfig: input.values,
					affiliateVersion: sql`${systemSettings.affiliateVersion} + 1`,
					affiliateUpdatedAt: input.nowMs
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
					paymentConfig: input.values,
					paymentVersion: sql`${systemSettings.paymentVersion} + 1`,
					paymentUpdatedAt: input.nowMs
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
					aiConfig: input.values,
					aiVersion: sql`${systemSettings.aiVersion} + 1`,
					aiUpdatedAt: input.nowMs
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

function toGeneralConfig(settings: SystemSettings): GeneralConfig {
	const config: GeneralSettingsDocument = parseGeneralSettings(settings.generalConfig)
	return {
		...config,
		version: settings.generalVersion
	}
}

function parseGeneralSettings(value: unknown): GeneralSettingsDocument {
	const result: z.ZodSafeParseResult<GeneralSettingsDocument> = GeneralSettingsSchema.safeParse(value)
	if (!result.success) {
		throw new ConfigStoreError('SETTINGS_INVALID', 'General settings are invalid')
	}
	return result.data
}

function toStorageConfig(settings: SystemSettings): StorageConfig {
	const config: StorageSettingsDocument = parseStorageSettings(settings.storageConfig)
	return {
		...config,
		version: settings.storageVersion
	}
}

function parseStorageSettings(value: unknown): StorageSettingsDocument {
	const result: z.ZodSafeParseResult<StorageSettingsDocument> = StorageSettingsSchema.safeParse(value)
	if (!result.success) {
		throw new ConfigStoreError('SETTINGS_INVALID', 'Storage settings are invalid')
	}
	return result.data
}

function toAuthenticationConfig(settings: SystemSettings): AuthenticationConfig {
	return {
		...parseAuthenticationSettings(settings.authenticationConfig),
		version: settings.authenticationVersion
	}
}

function toEmailConfig(settings: SystemSettings): EmailConfig {
	return {
		...parseEmailSettings(settings.emailConfig),
		version: settings.emailVersion
	}
}

function parseAuthenticationSettings(value: unknown): AuthenticationSettingsDocument {
	const result: z.ZodSafeParseResult<AuthenticationSettingsDocument> =
		AuthenticationSettingsSchema.safeParse(value)
	if (!result.success) {
		throw new ConfigStoreError('SETTINGS_INVALID', 'Authentication settings are invalid')
	}
	return result.data
}

function parseEmailSettings(value: unknown): EmailSettingsDocument {
	const result: z.ZodSafeParseResult<EmailSettingsDocument> = EmailSettingsSchema.safeParse(value)
	if (!result.success) {
		throw new ConfigStoreError('SETTINGS_INVALID', 'Email settings are invalid')
	}
	return result.data
}

async function applyAuthenticationProviderUpdate(
	encryptionKey: string,
	current: AuthenticationSettingsDocument['providers']['google'],
	input: AuthenticationProviderUpdate
): Promise<AuthenticationSettingsDocument['providers']['google']> {
	return {
		enabled: input.enabled,
		clientId: input.clientId,
		clientSecret: await mutateConfigSecret(
			encryptionKey,
			current.clientSecret,
			input.clientSecret
		)
	}
}

function validateAuthenticationDependencies(config: AuthenticationSettingsDocument): void {
	if (config.turnstile.enabled && !config.turnstile.siteKey) {
		throw new ConfigStoreError(
			'INVALID_UPDATE',
			'turnstile.siteKey is required when Turnstile is enabled'
		)
	}
	if (config.turnstile.enabled && !config.turnstile.secretKey) {
		throw new ConfigStoreError(
			'INVALID_UPDATE',
			'turnstile.secretKey is required when Turnstile is enabled'
		)
	}
	validateAuthenticationProvider('google', 'Google', config.providers.google)
	validateAuthenticationProvider('github', 'GitHub', config.providers.github)
	validateAuthenticationProvider('linuxdo', 'LinuxDO', config.providers.linuxdo)
}

function validateAuthenticationProvider(
	path: 'google' | 'github' | 'linuxdo',
	label: 'Google' | 'GitHub' | 'LinuxDO',
	provider: AuthenticationSettingsDocument['providers']['google']
): void {
	if (provider.enabled && !provider.clientId) {
		throw new ConfigStoreError(
			'INVALID_UPDATE',
			`providers.${path}.clientId is required when ${label} authentication is enabled`
		)
	}
	if (provider.enabled && !provider.clientSecret) {
		throw new ConfigStoreError(
			'INVALID_UPDATE',
			`providers.${path}.clientSecret is required when ${label} authentication is enabled`
		)
	}
}

function validateEmailDependencies(config: EmailSettingsDocument): void {
	if (config.enabled && !config.provider) {
		throw new ConfigStoreError('INVALID_UPDATE', 'provider is required when Email is enabled')
	}
	if (config.enabled && config.provider === 'resend' && !config.resendApiKey) {
		throw new ConfigStoreError(
			'INVALID_UPDATE',
			'resendApiKey is required when the Resend provider is enabled'
		)
	}
}

async function decryptAuthenticationConfig(
	encryptionKey: string,
	config: AuthenticationSettingsDocument
): Promise<AuthenticationRuntimeConfig> {
	return {
		betaCodeEnabled: config.betaCodeEnabled,
		emailSignupEnabled: config.emailSignupEnabled,
		emailSignupDomainAllowlist: config.emailSignupDomainAllowlist,
		emailRequireVerification: config.emailRequireVerification,
		emailUserActionCooldownSeconds: config.emailUserActionCooldownSeconds,
		turnstile: {
			enabled: config.turnstile.enabled,
			siteKey: config.turnstile.siteKey,
			secretKey: config.turnstile.secretKey
				? await decryptConfigSecret(encryptionKey, config.turnstile.secretKey)
				: null
		},
		providers: {
			google: await decryptAuthenticationProvider(encryptionKey, config.providers.google),
			github: await decryptAuthenticationProvider(encryptionKey, config.providers.github),
			linuxdo: await decryptAuthenticationProvider(encryptionKey, config.providers.linuxdo)
		}
	}
}

async function decryptAuthenticationProvider(
	encryptionKey: string,
	provider: AuthenticationSettingsDocument['providers']['google']
): Promise<AuthenticationRuntimeProviderConfig> {
	return {
		enabled: provider.enabled,
		clientId: provider.clientId,
		clientSecret: provider.clientSecret
			? await decryptConfigSecret(encryptionKey, provider.clientSecret)
			: null
	}
}

export * from './crypto'
