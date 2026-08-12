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

export type ConfigStoreErrorCode =
	| 'SETTINGS_NOT_FOUND'
	| 'SETTINGS_INVALID'
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

export type PublicRuntimeConfig = {
	design_system: GeneralSettingsDocument['designSystem']
	docs_enabled: boolean
}

export type UpdateGeneralConfigInput = GeneralSettingsDocument & {
	expectedVersion: number
	nowMs: number
}

export type UpdateStorageConfigInput = StorageSettingsDocument & {
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

export async function getPublicRuntimeConfig(db: MetaDb): Promise<PublicRuntimeConfig> {
	const general: GeneralConfig = await getGeneralConfig(db)
	return {
		design_system: general.designSystem,
		docs_enabled: general.docsEnabled
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

export * from './crypto'
