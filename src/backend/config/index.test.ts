import { describe, expect, it } from 'vitest'
import type { MetaDb } from '../db'
import type { SystemSettings } from '../db/schema.meta'
import {
	ConfigStoreError,
	readSystemSettingsSnapshot,
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

		expect({ version: result.generalVersion, designSystem: result.designSystem }).toEqual({
			version: 2,
			designSystem: 'brutalism'
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

function createSettingsRow(generalVersion: number): SystemSettings {
	return {
		id: 1,
		generalVersion,
		designSystem: generalVersion === 1 ? 'apple-saas' : 'brutalism',
		docsEnabled: generalVersion === 1
	} as unknown as SystemSettings
}
