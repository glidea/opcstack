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
	type EncryptedConfigValue,
	type GeneralSettingsDocument,
	type PaymentSettingsDocument,
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

export type AuthenticationConfig = AuthenticationSettingsDocument & {
	version: number
}

export type EmailConfig = EmailSettingsDocument & {
	version: number
}

export type CreditsConfig = CreditsSettingsDocument & {
	version: number
}

export type AffiliateConfig = AffiliateSettingsDocument & {
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
	docs_enabled: boolean
	payment_enabled: boolean
	email_provider_configured: boolean
	registration_enabled: boolean
	email_require_verification: boolean
	email_user_action_cooldown_seconds: number
	google_auth_enabled: boolean
	github_auth_enabled: boolean
	linuxdo_auth_enabled: boolean
	turnstile_enabled: boolean
	turnstile_site_key: string | null
}

export type UpdateGeneralConfigInput = {
	docsEnabled: boolean
	expectedVersion: number
	nowMs: number
}

export type UpdateAuthenticationConfigInput = {
	betaCodeEnabled: boolean
	registrationEnabled: boolean
	emailSignupDomainAllowlist: string[]
	emailRequireVerification: boolean
	emailUserActionCooldownSeconds: number
	turnstile: {
		enabled: boolean
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
	provider: EmailSettingsDocument['provider']
	resendApiKey: SecretMutation
	expectedVersion: number
	nowMs: number
}

export type UpdateCreditsConfigInput = CreditsSettingsDocument & {
	expectedVersion: number
	nowMs: number
}

export type UpdateAffiliateConfigInput = AffiliateSettingsDocument & {
	expectedVersion: number
	nowMs: number
}

export type SystemSettingsDomainUpdate =
	| DomainUpdate<'general', GeneralSettingsDocument>
	| DomainUpdate<'authentication', AuthenticationSettingsDocument>
	| DomainUpdate<'email', EmailSettingsDocument>
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
	docsEnabled: z.boolean()
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
	registrationEnabled: z.boolean(),
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
	provider: z.enum(['cloudflare', 'resend']).nullable(),
	resendApiKey: EncryptedSecretSchema.nullable()
})

const CreditUnitsSchema = z.number().int().nonnegative().safe()

const CreditsSettingsSchema = z.object({
	signupEnabled: z.boolean(),
	signupAmount: CreditUnitsSchema,
	dailyCheckinEnabled: z.boolean(),
	dailyCheckinAmount: CreditUnitsSchema,
	historyRetentionDays: z.number().int().positive()
})

const AffiliateSettingsSchema = z.object({
	enabled: z.boolean(),
	inviterCreditAmount: CreditUnitsSchema,
	inviteeCreditAmount: CreditUnitsSchema
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

export async function getAuthenticationConfig(db: MetaDb): Promise<AuthenticationConfig> {
	const settings: SystemSettings = await readSystemSettingsSnapshot(db)
	return toAuthenticationConfig(settings)
}

export async function getEmailConfig(db: MetaDb): Promise<EmailConfig> {
	const settings: SystemSettings = await readSystemSettingsSnapshot(db)
	return toEmailConfig(settings)
}

export async function getCreditsConfig(db: MetaDb): Promise<CreditsConfig> {
	const settings: SystemSettings = await readSystemSettingsSnapshot(db)
	return toCreditsConfig(settings)
}

export async function getAffiliateConfig(db: MetaDb): Promise<AffiliateConfig> {
	const settings: SystemSettings = await readSystemSettingsSnapshot(db)
	return toAffiliateConfig(settings)
}

export async function updateAuthenticationConfig(
	db: MetaDb,
	encryptionKey: string,
	input: UpdateAuthenticationConfigInput
): Promise<AuthenticationConfig> {
	const currentSettings: SystemSettings = await readSystemSettingsSnapshot(db)
	const current: AuthenticationConfig = toAuthenticationConfig(currentSettings)
	const email: EmailSettingsDocument = parseEmailSettings(currentSettings.emailConfig)
	const values: AuthenticationSettingsDocument = parseAuthenticationSettings({
		betaCodeEnabled: input.betaCodeEnabled,
		registrationEnabled: input.registrationEnabled,
		emailSignupDomainAllowlist: input.emailSignupDomainAllowlist,
		emailRequireVerification: input.emailRequireVerification,
		emailUserActionCooldownSeconds: input.emailUserActionCooldownSeconds,
		turnstile: {
			enabled: input.turnstile.enabled,
			siteKey: current.turnstile.siteKey,
			secretKey: current.turnstile.secretKey
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
	validateAuthenticationEmailDependencies(values, email)
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
	const currentSettings: SystemSettings = await readSystemSettingsSnapshot(db)
	const current: EmailConfig = toEmailConfig(currentSettings)
	const authentication: AuthenticationSettingsDocument = parseAuthenticationSettings(
		currentSettings.authenticationConfig
	)
	const resendApiKey: EncryptedConfigValue | null = input.provider === 'resend'
		? await mutateConfigSecret(
			encryptionKey,
			current.resendApiKey,
			input.resendApiKey
		)
		: null
	const values: EmailSettingsDocument = parseEmailSettings({
		provider: input.provider,
		resendApiKey
	})
	validateEmailDependencies(values)
	validateAuthenticationEmailDependencies(authentication, values)
	const settings: SystemSettings = await updateSystemSettingsDomain(db, {
		domain: 'email',
		expectedVersion: input.expectedVersion,
		values,
		nowMs: input.nowMs
	})
	return toEmailConfig(settings)
}

export async function updateCreditsConfig(
	db: MetaDb,
	input: UpdateCreditsConfigInput
): Promise<CreditsConfig> {
	const values: CreditsSettingsDocument = parseCreditsSettings(input)
	validateCreditsDependencies(values)
	const settings: SystemSettings = await updateSystemSettingsDomain(db, {
		domain: 'credits',
		expectedVersion: input.expectedVersion,
		values,
		nowMs: input.nowMs
	})
	return toCreditsConfig(settings)
}

export async function updateAffiliateConfig(
	db: MetaDb,
	input: UpdateAffiliateConfigInput
): Promise<AffiliateConfig> {
	const values: AffiliateSettingsDocument = parseAffiliateSettings(input)
	validateAffiliateDependencies(values)
	const settings: SystemSettings = await updateSystemSettingsDomain(db, {
		domain: 'affiliate',
		expectedVersion: input.expectedVersion,
		values,
		nowMs: input.nowMs
	})
	return toAffiliateConfig(settings)
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
	validateAuthenticationEmailDependencies(authentication, email)
	return {
		systemEmail: administrator.email,
		authentication: await decryptAuthenticationConfig(encryptionKey, authentication),
		email: {
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
	validateAuthenticationEmailDependencies(authentication, email)
	return {
		support_email: administrator.email,
		docs_enabled: general.docsEnabled,
		payment_enabled: parsePaymentEnabled(settings.paymentConfig),
		email_provider_configured: email.provider !== null,
		registration_enabled: authentication.registrationEnabled,
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

function toAuthenticationConfig(settings: SystemSettings): AuthenticationConfig {
	return {
		...parseAuthenticationSettings(settings.authenticationConfig),
		version: settings.authenticationVersion
	}
}

function toEmailConfig(settings: SystemSettings): EmailConfig {
	const config: EmailSettingsDocument = parseEmailSettings(settings.emailConfig)
	validateEmailDependencies(config)
	return {
		...config,
		version: settings.emailVersion
	}
}

function toCreditsConfig(settings: SystemSettings): CreditsConfig {
	const config: CreditsSettingsDocument = parseCreditsSettings(settings.creditsConfig)
	validateCreditsDependencies(config)
	return {
		...config,
		version: settings.creditsVersion
	}
}

function toAffiliateConfig(settings: SystemSettings): AffiliateConfig {
	const config: AffiliateSettingsDocument = parseAffiliateSettings(settings.affiliateConfig)
	validateAffiliateDependencies(config)
	return {
		...config,
		version: settings.affiliateVersion
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

function parseCreditsSettings(value: unknown): CreditsSettingsDocument {
	const result: z.ZodSafeParseResult<CreditsSettingsDocument> = CreditsSettingsSchema.safeParse(value)
	if (!result.success) {
		throw new ConfigStoreError('SETTINGS_INVALID', 'Credits settings are invalid')
	}
	return result.data
}

function parseAffiliateSettings(value: unknown): AffiliateSettingsDocument {
	const result: z.ZodSafeParseResult<AffiliateSettingsDocument> = AffiliateSettingsSchema.safeParse(value)
	if (!result.success) {
		throw new ConfigStoreError('SETTINGS_INVALID', 'Affiliate settings are invalid')
	}
	return result.data
}

function parsePaymentEnabled(value: unknown): boolean {
	const result: z.ZodSafeParseResult<{ enabled: boolean }> = z
		.object({ enabled: z.boolean() })
		.safeParse(value)
	if (!result.success) {
		throw new ConfigStoreError('SETTINGS_INVALID', 'Payment settings are invalid')
	}
	return result.data.enabled
}

function validateCreditsDependencies(config: CreditsSettingsDocument): void {
	if (config.signupEnabled && config.signupAmount === 0) {
		throw new ConfigStoreError(
			'INVALID_UPDATE',
			'signupAmount must be positive when signup credits are enabled'
		)
	}
	if (config.dailyCheckinEnabled && config.dailyCheckinAmount === 0) {
		throw new ConfigStoreError(
			'INVALID_UPDATE',
			'dailyCheckinAmount must be positive when daily check-in is enabled'
		)
	}
}

function validateAffiliateDependencies(config: AffiliateSettingsDocument): void {
	if (config.enabled && config.inviterCreditAmount === 0) {
		throw new ConfigStoreError(
			'INVALID_UPDATE',
			'inviterCreditAmount must be positive when Affiliate is enabled'
		)
	}
	if (config.enabled && config.inviteeCreditAmount === 0) {
		throw new ConfigStoreError(
			'INVALID_UPDATE',
			'inviteeCreditAmount must be positive when Affiliate is enabled'
		)
	}
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
	const turnstileConfigured: boolean = config.turnstile.enabled || config.turnstile.siteKey !== null || config.turnstile.secretKey !== null
	if (turnstileConfigured && !config.turnstile.siteKey) {
		throw new ConfigStoreError(
			'INVALID_UPDATE',
			`turnstile.siteKey is required when Turnstile is ${config.turnstile.enabled ? 'enabled' : 'configured'}`
		)
	}
	if (turnstileConfigured && !config.turnstile.secretKey) {
		throw new ConfigStoreError(
			'INVALID_UPDATE',
			`turnstile.secretKey is required when Turnstile is ${config.turnstile.enabled ? 'enabled' : 'configured'}`
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
	const configured: boolean = provider.enabled || provider.clientId !== null || provider.clientSecret !== null
	if (configured && !provider.clientId) {
		throw new ConfigStoreError(
			'INVALID_UPDATE',
			`providers.${path}.clientId is required when ${label} authentication is ${provider.enabled ? 'enabled' : 'configured'}`
		)
	}
	if (configured && !provider.clientSecret) {
		throw new ConfigStoreError(
			'INVALID_UPDATE',
			`providers.${path}.clientSecret is required when ${label} authentication is ${provider.enabled ? 'enabled' : 'configured'}`
		)
	}
}

function validateEmailDependencies(config: EmailSettingsDocument): void {
	if (config.provider !== 'resend' && config.resendApiKey !== null) {
		throw new ConfigStoreError(
			'INVALID_UPDATE',
			'resendApiKey is only valid for the Resend provider'
		)
	}
	const configured: boolean = config.provider !== null || config.resendApiKey !== null
	if (configured && !config.provider) {
		throw new ConfigStoreError('INVALID_UPDATE', 'provider is required when Email is configured')
	}
	if (configured && config.provider === 'resend' && !config.resendApiKey) {
		throw new ConfigStoreError(
			'INVALID_UPDATE',
			'resendApiKey is required when the Resend provider is configured'
		)
	}
}

function validateAuthenticationEmailDependencies(
	authentication: AuthenticationSettingsDocument,
	email: EmailSettingsDocument
): void {
	if (authentication.emailRequireVerification && email.provider === null) {
		throw new ConfigStoreError(
			'INVALID_UPDATE',
			'Email provider is required when email verification is enabled'
		)
	}
}

async function decryptAuthenticationConfig(
	encryptionKey: string,
	config: AuthenticationSettingsDocument
): Promise<AuthenticationRuntimeConfig> {
	return {
		betaCodeEnabled: config.betaCodeEnabled,
		registrationEnabled: config.registrationEnabled,
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
