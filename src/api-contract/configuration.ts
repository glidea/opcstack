import { z } from 'zod'
import type { ApiErrorResult } from './common'

export const DesignSystemSchema = z.enum(['apple-saas', 'brutalism'])
export type DesignSystem = z.infer<typeof DesignSystemSchema>

export const GetGeneralConfigRequestSchema = z.object({})
export type GetGeneralConfigRequest = z.infer<typeof GetGeneralConfigRequestSchema>

export const GeneralConfigSchema = z.object({
	design_system: DesignSystemSchema,
	docs_enabled: z.boolean(),
	version: z.number().int().min(1)
})
export type GeneralConfig = z.infer<typeof GeneralConfigSchema>

export const UpdateGeneralConfigRequestSchema = z.object({
	design_system: DesignSystemSchema,
	docs_enabled: z.boolean(),
	expected_version: z.number().int().min(1)
})
export type UpdateGeneralConfigRequest = z.infer<typeof UpdateGeneralConfigRequestSchema>

export const GetStorageConfigRequestSchema = z.object({})
export type GetStorageConfigRequest = z.infer<typeof GetStorageConfigRequestSchema>

const AllowedContentTypesSchema = z
	.array(z.string().trim().min(1))
	.min(1)
	.refine((items: string[]): boolean => new Set(items).size === items.length, {
		message: 'Content types must be unique'
	})

export const StorageConfigSchema = z.object({
	allowed_content_types: AllowedContentTypesSchema,
	max_upload_bytes: z.number().int().positive(),
	version: z.number().int().min(1)
})
export type StorageConfig = z.infer<typeof StorageConfigSchema>

export const UpdateStorageConfigRequestSchema = z.object({
	allowed_content_types: AllowedContentTypesSchema,
	max_upload_bytes: z.number().int().positive(),
	expected_version: z.number().int().min(1)
})
export type UpdateStorageConfigRequest = z.infer<typeof UpdateStorageConfigRequestSchema>

const ConfigurationErrors = {
	INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
		return {
			status: 400,
			body: { code: 'INVALID_REQUEST', message }
		}
	},
	UNAUTHORIZED(): ApiErrorResult<'UNAUTHORIZED', 401> {
		return {
			status: 401,
			body: { code: 'UNAUTHORIZED', message: 'Unauthorized' }
		}
	},
	FORBIDDEN(): ApiErrorResult<'FORBIDDEN', 403> {
		return {
			status: 403,
			body: { code: 'FORBIDDEN', message: 'Forbidden' }
		}
	},
	CONFIG_NOT_FOUND(): ApiErrorResult<'CONFIG_NOT_FOUND', 404> {
		return {
			status: 404,
			body: { code: 'CONFIG_NOT_FOUND', message: 'Configuration was not found' }
		}
	},
	CONFIG_CONFLICT(): ApiErrorResult<'CONFIG_CONFLICT', 409> {
		return {
			status: 409,
			body: { code: 'CONFIG_CONFLICT', message: 'Configuration has changed' }
		}
	},
	CONFIG_UNAVAILABLE(): ApiErrorResult<'CONFIG_UNAVAILABLE', 500> {
		return {
			status: 500,
			body: { code: 'CONFIG_UNAVAILABLE', message: 'Configuration is unavailable' }
		}
	}
}

export const GetGeneralConfigApi = {
	request: GetGeneralConfigRequestSchema,
	response: GeneralConfigSchema,
	errors: ConfigurationErrors
}

export const UpdateGeneralConfigApi = {
	request: UpdateGeneralConfigRequestSchema,
	response: GeneralConfigSchema,
	errors: ConfigurationErrors
}

export const GetStorageConfigApi = {
	request: GetStorageConfigRequestSchema,
	response: StorageConfigSchema,
	errors: ConfigurationErrors
}

export const UpdateStorageConfigApi = {
	request: UpdateStorageConfigRequestSchema,
	response: StorageConfigSchema,
	errors: ConfigurationErrors
}
