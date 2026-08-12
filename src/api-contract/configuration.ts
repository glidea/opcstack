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

export const SecretMutationSchema = z.discriminatedUnion('action', [
	z.object({ action: z.literal('keep') }),
	z.object({ action: z.literal('replace'), value: z.string().trim().min(1) }),
	z.object({ action: z.literal('remove') })
])
export type SecretMutation = z.infer<typeof SecretMutationSchema>

export const GetAuthenticationConfigRequestSchema = z.object({})
export type GetAuthenticationConfigRequest = z.infer<typeof GetAuthenticationConfigRequestSchema>

export const AuthenticationConfigSchema = z.object({
	beta_code_enabled: z.boolean(),
	email_signup_enabled: z.boolean(),
	email_signup_domain_allowlist: z.array(z.string()),
	email_require_verification: z.boolean(),
	email_user_action_cooldown_seconds: z.number().int().positive(),
	turnstile_enabled: z.boolean(),
	turnstile_site_key: z.string().nullable(),
	turnstile_secret_key_configured: z.boolean(),
	google_auth_enabled: z.boolean(),
	google_client_id: z.string().nullable(),
	google_client_secret_configured: z.boolean(),
	google_callback_url: z.string().url(),
	github_auth_enabled: z.boolean(),
	github_client_id: z.string().nullable(),
	github_client_secret_configured: z.boolean(),
	github_callback_url: z.string().url(),
	linuxdo_auth_enabled: z.boolean(),
	linuxdo_client_id: z.string().nullable(),
	linuxdo_client_secret_configured: z.boolean(),
	linuxdo_callback_url: z.string().url(),
	version: z.number().int().min(1)
})
export type AuthenticationConfig = z.infer<typeof AuthenticationConfigSchema>

export const UpdateAuthenticationConfigRequestSchema = z.object({
	beta_code_enabled: z.boolean(),
	email_signup_enabled: z.boolean(),
	email_signup_domain_allowlist: z.array(z.string().trim().min(1)),
	email_require_verification: z.boolean(),
	email_user_action_cooldown_seconds: z.number().int().positive(),
	turnstile_enabled: z.boolean(),
	turnstile_site_key: z.string().trim().min(1).nullable(),
	turnstile_secret_key: SecretMutationSchema,
	google_auth_enabled: z.boolean(),
	google_client_id: z.string().trim().min(1).nullable(),
	google_client_secret: SecretMutationSchema,
	github_auth_enabled: z.boolean(),
	github_client_id: z.string().trim().min(1).nullable(),
	github_client_secret: SecretMutationSchema,
	linuxdo_auth_enabled: z.boolean(),
	linuxdo_client_id: z.string().trim().min(1).nullable(),
	linuxdo_client_secret: SecretMutationSchema,
	expected_version: z.number().int().min(1)
})
export type UpdateAuthenticationConfigRequest = z.infer<
	typeof UpdateAuthenticationConfigRequestSchema
>

export const GetEmailConfigRequestSchema = z.object({})
export type GetEmailConfigRequest = z.infer<typeof GetEmailConfigRequestSchema>

export const EmailConfigSchema = z.object({
	enabled: z.boolean(),
	provider: z.enum(['cloudflare', 'resend']).nullable(),
	resend_api_key_configured: z.boolean(),
	version: z.number().int().min(1)
})
export type EmailConfig = z.infer<typeof EmailConfigSchema>

export const UpdateEmailConfigRequestSchema = z.object({
	enabled: z.boolean(),
	provider: z.enum(['cloudflare', 'resend']).nullable(),
	resend_api_key: SecretMutationSchema,
	expected_version: z.number().int().min(1)
})
export type UpdateEmailConfigRequest = z.infer<typeof UpdateEmailConfigRequestSchema>

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

export const GetAuthenticationConfigApi = {
	request: GetAuthenticationConfigRequestSchema,
	response: AuthenticationConfigSchema,
	errors: ConfigurationErrors
}

export const UpdateAuthenticationConfigApi = {
	request: UpdateAuthenticationConfigRequestSchema,
	response: AuthenticationConfigSchema,
	errors: ConfigurationErrors
}

export const GetEmailConfigApi = {
	request: GetEmailConfigRequestSchema,
	response: EmailConfigSchema,
	errors: ConfigurationErrors
}

export const UpdateEmailConfigApi = {
	request: UpdateEmailConfigRequestSchema,
	response: EmailConfigSchema,
	errors: ConfigurationErrors
}
