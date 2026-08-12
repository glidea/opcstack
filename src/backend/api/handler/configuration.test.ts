import type { Context } from 'hono'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ApiEnv } from '..'
import type { MetaDb } from '../../db'
import type { SystemSettings } from '../../db/schema.meta'
import {
	getGeneralConfigHandler,
	getStorageConfigHandler,
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
				design_system: 'apple-saas',
				docs_enabled: true,
				version: 1
			}
		})
	})

	test('updates General configuration with expected version', async (): Promise<void> => {
		vi.spyOn(Date, 'now').mockReturnValue(2000)
		const updated: SystemSettings = createSettingsRow()
		updated.generalConfig = {
			designSystem: 'brutalism',
			docsEnabled: false
		}
		updated.generalVersion = 2
		const response: Response = await updateGeneralConfigHandler(
			createContext(
				{
					design_system: 'brutalism',
					docs_enabled: false,
					expected_version: 1
				},
				createMetaDb({ row: createSettingsRow(), updated })
			)
		)

		expect({ status: response.status, body: await response.json() }).toEqual({
			status: 200,
			body: {
				design_system: 'brutalism',
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
})

type MetaDbInput = {
	row: SystemSettings | undefined
	updated?: SystemSettings | undefined
}

function createMetaDb(input: MetaDbInput): MetaDb {
	return {
		query: {
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
		storageVersion: 1,
		storageUpdatedAt: 1000,
		generalConfig: {
			designSystem: 'apple-saas',
			docsEnabled: true
		},
		storageConfig: {
			allowedContentTypes: ['image/png', 'image/jpeg', 'image/webp'],
			maxUploadBytes: 5_242_880
		}
	} as unknown as SystemSettings
}
