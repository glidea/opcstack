import { z } from 'zod'
import type { ApiErrorResult } from './common'

export const GetGeneralConfigRequestSchema = z.object({})
export type GetGeneralConfigRequest = z.infer<typeof GetGeneralConfigRequestSchema>

export const GeneralConfigSchema = z.object({
	docs_enabled: z.boolean(),
	version: z.number().int().min(1)
})
export type GeneralConfig = z.infer<typeof GeneralConfigSchema>

export const UpdateGeneralConfigRequestSchema = z.object({
	docs_enabled: z.boolean(),
	expected_version: z.number().int().min(1)
})
export type UpdateGeneralConfigRequest = z.infer<typeof UpdateGeneralConfigRequestSchema>

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
	registration_enabled: z.boolean(),
	email_signup_domain_allowlist: z.array(z.string()),
	email_require_verification: z.boolean(),
	email_user_action_cooldown_seconds: z.number().int().positive(),
	turnstile_enabled: z.boolean(),
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
	registration_enabled: z.boolean(),
	email_signup_domain_allowlist: z.array(z.string().trim().min(1)),
	email_require_verification: z.boolean(),
	email_user_action_cooldown_seconds: z.number().int().positive(),
	turnstile_enabled: z.boolean(),
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
}).strict()
export type UpdateAuthenticationConfigRequest = z.infer<
	typeof UpdateAuthenticationConfigRequestSchema
>

export const GetEmailConfigRequestSchema = z.object({})
export type GetEmailConfigRequest = z.infer<typeof GetEmailConfigRequestSchema>

export const EmailConfigSchema = z.object({
	provider: z.enum(['cloudflare', 'resend']).nullable(),
	resend_api_key_configured: z.boolean(),
	version: z.number().int().min(1)
})
export type EmailConfig = z.infer<typeof EmailConfigSchema>

export const UpdateEmailConfigRequestSchema = z.object({
	provider: z.enum(['cloudflare', 'resend']).nullable(),
	resend_api_key: SecretMutationSchema,
	expected_version: z.number().int().min(1)
})
export type UpdateEmailConfigRequest = z.infer<typeof UpdateEmailConfigRequestSchema>

const CreditConfigAmountSchema = z.string().refine((raw: string): boolean => {
	if (!/^\d+(?:\.\d{1,6})?$/.test(raw)) {
		return false
	}
	const parts: string[] = raw.split('.')
	const fraction: string = (parts[1] ?? '').padEnd(6, '0')
	const units: number = Number(parts[0]) * 1_000_000 + Number(fraction)
	return Number.isSafeInteger(units)
}, 'Credit amount is invalid')

export const GetCreditsConfigRequestSchema = z.object({})
export type GetCreditsConfigRequest = z.infer<typeof GetCreditsConfigRequestSchema>

export const CreditsConfigSchema = z.object({
	signup_enabled: z.boolean(),
	signup_amount: CreditConfigAmountSchema,
	daily_checkin_enabled: z.boolean(),
	daily_checkin_amount: CreditConfigAmountSchema,
	history_retention_days: z.number().int().positive(),
	version: z.number().int().min(1)
})
export type CreditsConfig = z.infer<typeof CreditsConfigSchema>

export const UpdateCreditsConfigRequestSchema = CreditsConfigSchema.omit({ version: true }).extend({
	expected_version: z.number().int().min(1)
})
export type UpdateCreditsConfigRequest = z.infer<typeof UpdateCreditsConfigRequestSchema>

export const GetAffiliateConfigRequestSchema = z.object({})
export type GetAffiliateConfigRequest = z.infer<typeof GetAffiliateConfigRequestSchema>

export const AffiliateConfigSchema = z.object({
	enabled: z.boolean(),
	inviter_credit_amount: CreditConfigAmountSchema,
	invitee_credit_amount: CreditConfigAmountSchema,
	version: z.number().int().min(1)
})
export type AffiliateConfig = z.infer<typeof AffiliateConfigSchema>

export const UpdateAffiliateConfigRequestSchema = AffiliateConfigSchema.omit({ version: true }).extend({
	expected_version: z.number().int().min(1)
})
export type UpdateAffiliateConfigRequest = z.infer<typeof UpdateAffiliateConfigRequestSchema>

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

export const GetCreditsConfigApi = {
	request: GetCreditsConfigRequestSchema,
	response: CreditsConfigSchema,
	errors: ConfigurationErrors
}

export const UpdateCreditsConfigApi = {
	request: UpdateCreditsConfigRequestSchema,
	response: CreditsConfigSchema,
	errors: ConfigurationErrors
}

export const GetAffiliateConfigApi = {
	request: GetAffiliateConfigRequestSchema,
	response: AffiliateConfigSchema,
	errors: ConfigurationErrors
}

export const UpdateAffiliateConfigApi = {
	request: UpdateAffiliateConfigRequestSchema,
	response: AffiliateConfigSchema,
	errors: ConfigurationErrors
}

export const PaymentProviderNameSchema = z.enum(['dodo', 'creem'])
export type PaymentProviderName = z.infer<typeof PaymentProviderNameSchema>

export const PaymentProductSchema = z.object({
	product_id: z.string().trim().min(1),
	provider: PaymentProviderNameSchema,
	test_mode: z.boolean(),
	provider_product_id: z.string().trim().min(1),
	type: z.enum(['one_time', 'subscription']),
	credits_amount: CreditConfigAmountSchema.nullable(),
	subscription_plan: z.string().trim().min(1).nullable(),
	upgrade_rank: z.number().int().nonnegative().nullable(),
	period_credits_amount: CreditConfigAmountSchema.nullable(),
	version: z.number().int().min(1)
}).strict()
export type PaymentProduct = z.infer<typeof PaymentProductSchema>

const PaymentProviderConfigSchema = z.object({
	api_key_configured: z.boolean(),
	webhook_secret_configured: z.boolean(),
	webhook_url: z.string().url()
})

export const PaymentConfigSchema = z.object({
	enabled: z.boolean(),
	default_provider: PaymentProviderNameSchema.nullable(),
	country_provider_overrides: z.array(
		z.object({ country: z.string().length(2), provider: PaymentProviderNameSchema })
	),
	dodo: PaymentProviderConfigSchema,
	creem: PaymentProviderConfigSchema,
	products: z.array(PaymentProductSchema),
	version: z.number().int().min(1)
})
export type PaymentConfig = z.infer<typeof PaymentConfigSchema>

export const GetPaymentConfigRequestSchema = z.object({})
export const UpdatePaymentConfigRequestSchema = z.object({
	enabled: z.boolean(),
	default_provider: PaymentProviderNameSchema.nullable(),
	country_provider_overrides: z.array(
		z.object({ country: z.string().trim().length(2), provider: PaymentProviderNameSchema })
	),
	dodo_api_key: SecretMutationSchema,
	dodo_webhook_secret: SecretMutationSchema,
	creem_api_key: SecretMutationSchema,
	creem_webhook_secret: SecretMutationSchema,
	expected_version: z.number().int().min(1)
})
export type UpdatePaymentConfigRequest = z.infer<typeof UpdatePaymentConfigRequestSchema>

const PaymentProductEntitlementFieldsSchema = z.object({
	credits_amount: CreditConfigAmountSchema.nullable(),
	subscription_plan: z.string().trim().min(1).nullable(),
	upgrade_rank: z.number().int().nonnegative().nullable(),
	period_credits_amount: CreditConfigAmountSchema.nullable()
})
export const CreatePaymentProductRequestSchema = PaymentProductEntitlementFieldsSchema.extend({
	provider: PaymentProviderNameSchema,
	provider_product_id: z.string().trim().min(1)
}).strict()
export type CreatePaymentProductRequest = z.infer<typeof CreatePaymentProductRequestSchema>

export const UpdatePaymentProductRequestSchema = PaymentProductEntitlementFieldsSchema.extend({
	product_id: z.string().trim().min(1),
	expected_version: z.number().int().min(1)
}).strict()
export type UpdatePaymentProductRequest = z.infer<typeof UpdatePaymentProductRequestSchema>

export const ListRemotePaymentProductsRequestSchema = z.object({
	provider: PaymentProviderNameSchema
}).strict()
export type ListRemotePaymentProductsRequest = z.infer<typeof ListRemotePaymentProductsRequestSchema>

export const RemotePaymentProductSchema = z.object({
	provider_product_id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	price_amount: z.number(),
	currency: z.string(),
	type: z.enum(['one_time', 'subscription'])
})
export type RemotePaymentProduct = z.infer<typeof RemotePaymentProductSchema>

export const ListRemotePaymentProductsResponseSchema = z.object({
	provider: PaymentProviderNameSchema,
	environment: z.enum(['test', 'live']),
	items: z.array(RemotePaymentProductSchema)
})
export type ListRemotePaymentProductsResponse = z.infer<typeof ListRemotePaymentProductsResponseSchema>
export const DeletePaymentProductRequestSchema = z.object({
	product_id: z.string().trim().min(1),
	expected_version: z.number().int().min(1)
})
export type DeletePaymentProductRequest = z.infer<typeof DeletePaymentProductRequestSchema>
export const DeletePaymentProductResponseSchema = z.object({ product_id: z.string() })
export type DeletePaymentProductResponse = z.infer<typeof DeletePaymentProductResponseSchema>

export const GetPaymentConfigApi = {
	request: GetPaymentConfigRequestSchema,
	response: PaymentConfigSchema,
	errors: ConfigurationErrors
}

export const ListRemotePaymentProductsApi = {
	request: ListRemotePaymentProductsRequestSchema,
	response: ListRemotePaymentProductsResponseSchema,
	errors: ConfigurationErrors
}

export const UpdatePaymentConfigApi = {
	request: UpdatePaymentConfigRequestSchema,
	response: PaymentConfigSchema,
	errors: ConfigurationErrors
}

export const CreatePaymentProductApi = {
	request: CreatePaymentProductRequestSchema,
	response: PaymentProductSchema,
	errors: ConfigurationErrors
}

export const UpdatePaymentProductApi = {
	request: UpdatePaymentProductRequestSchema,
	response: PaymentProductSchema,
	errors: ConfigurationErrors
}

export const DeletePaymentProductApi = {
	request: DeletePaymentProductRequestSchema,
	response: DeletePaymentProductResponseSchema,
	errors: ConfigurationErrors
}

export const AIProviderTypeSchema = z.enum([
	'chat_openai',
	'image_gemini',
	'image_openai',
	'image_seedream',
	'image_aliyun',
	'tts_gemini',
	'tts_seed',
	'realtime_doubao',
	'video_seedance'
])
export type AIProviderType = z.infer<typeof AIProviderTypeSchema>

export const AIProviderSchema = z.object({
	id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
	name: z.string().min(1),
	type: AIProviderTypeSchema,
	base_url: z.string().url(),
	models: z.array(z.string().min(1)).min(1),
	price_multiplier: z.number().positive(),
	api_key_configured: z.literal(true),
	enabled: z.boolean(),
	version: z.number().int().min(1)
})
export type AIProvider = z.infer<typeof AIProviderSchema>

export const AIConfigSchema = z.object({
	routing_error_weight: z.number().nonnegative(),
	routing_latency_weight: z.number().nonnegative(),
	routing_price_weight: z.number().nonnegative(),
	task_retention_days: z.number().int().positive(),
	providers: z.array(AIProviderSchema),
	version: z.number().int().min(1)
})
export type AIConfig = z.infer<typeof AIConfigSchema>

export const GetAIConfigRequestSchema = z.object({})
export const UpdateAIConfigRequestSchema = z.object({
	routing_error_weight: z.number().nonnegative(),
	routing_latency_weight: z.number().nonnegative(),
	routing_price_weight: z.number().nonnegative(),
	task_retention_days: z.number().int().positive(),
	expected_version: z.number().int().min(1)
})
export type UpdateAIConfigRequest = z.infer<typeof UpdateAIConfigRequestSchema>

const AIProviderWriteFieldsSchema = z.object({
	name: z.string().trim().min(1),
	type: AIProviderTypeSchema,
	base_url: z.string().url(),
	models: z.array(z.string().trim().min(1)).min(1),
	price_multiplier: z.number().positive(),
	enabled: z.boolean()
}).strict()
export const CreateAIProviderRequestSchema = AIProviderWriteFieldsSchema.extend({
	api_key: z.string().min(1)
}).strict()
export type CreateAIProviderRequest = z.infer<typeof CreateAIProviderRequestSchema>
export const UpdateAIProviderRequestSchema = AIProviderWriteFieldsSchema.extend({
	id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
	api_key: z.discriminatedUnion('action', [
		z.object({ action: z.literal('keep') }),
		z.object({ action: z.literal('replace'), value: z.string().min(1) })
	]),
	expected_version: z.number().int().min(1)
}).strict()
export type UpdateAIProviderRequest = z.infer<typeof UpdateAIProviderRequestSchema>
export const DeleteAIProviderRequestSchema = z.object({
	id: z.string().min(1),
	expected_version: z.number().int().min(1)
})
export type DeleteAIProviderRequest = z.infer<typeof DeleteAIProviderRequestSchema>
export const DeleteAIProviderResponseSchema = z.object({ id: z.string() })
export type DeleteAIProviderResponse = z.infer<typeof DeleteAIProviderResponseSchema>

export const GetAIConfigApi = {
	request: GetAIConfigRequestSchema,
	response: AIConfigSchema,
	errors: ConfigurationErrors
}

export const UpdateAIConfigApi = {
	request: UpdateAIConfigRequestSchema,
	response: AIConfigSchema,
	errors: ConfigurationErrors
}

export const CreateAIProviderApi = {
	request: CreateAIProviderRequestSchema,
	response: AIProviderSchema,
	errors: ConfigurationErrors
}

export const UpdateAIProviderApi = {
	request: UpdateAIProviderRequestSchema,
	response: AIProviderSchema,
	errors: ConfigurationErrors
}

export const DeleteAIProviderApi = {
	request: DeleteAIProviderRequestSchema,
	response: DeleteAIProviderResponseSchema,
	errors: ConfigurationErrors
}
