import { describe, expect, it } from 'vitest'
import type { MetaDb } from '../db'
import type { SystemSettings } from '../db/schema.meta'
import {
	ConfigStoreError,
	getPublicRuntimeConfig,
	getStorageConfig,
	readSystemSettingsSnapshot,
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
				design_system: 'apple-saas',
				docs_enabled: true
			},
			reads: 1
		})
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
})

type ConfigDbInput = {
	row: SystemSettings | undefined
	updated?: SystemSettings | undefined
	onRead?: () => void
}

function createConfigDb(input: ConfigDbInput): MetaDb {
	return {
		query: {
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
		storageVersion,
		storageUpdatedAt: 1000,
		generalConfig: {
			designSystem: generalVersion === 1 ? 'apple-saas' : 'brutalism',
			docsEnabled: generalVersion === 1
		},
		storageConfig: {
			allowedContentTypes: ['image/png', 'image/jpeg', 'image/webp'],
			maxUploadBytes: 5_242_880
		}
	} as unknown as SystemSettings
}
