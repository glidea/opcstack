import type { Context } from 'hono'
import type { ApiEnv } from '..'
import {
	CreateAIProviderApi,
	CreatePaymentProductApi,
	DeleteAIProviderApi,
	DeletePaymentProductApi,
	GetAIConfigApi,
	GetAuthenticationConfigApi,
	GetAffiliateConfigApi,
	GetCreditsConfigApi,
	GetEmailConfigApi,
	GetGeneralConfigApi,
	GetPaymentConfigApi,
	UpdateAIProviderApi,
	UpdateAIConfigApi,
	UpdateAuthenticationConfigApi,
	UpdateAffiliateConfigApi,
	UpdateCreditsConfigApi,
	UpdateEmailConfigApi,
	UpdateGeneralConfigApi,
	UpdatePaymentConfigApi,
	UpdatePaymentProductApi,
	type AIProvider as AIProviderResponse,
	type AIConfig as AIConfigResponse,
	type AuthenticationConfig as AuthenticationConfigResponse,
	type AffiliateConfig as AffiliateConfigResponse,
	type CreditsConfig as CreditsConfigResponse,
	type EmailConfig as EmailConfigResponse,
	type GeneralConfig as GeneralConfigResponse,
	type PaymentConfig as PaymentConfigResponse,
	type PaymentProduct as PaymentProductResponse
} from '../../../api-contract/configuration'
import {
	ConfigStoreError,
	getAffiliateConfig,
	getAuthenticationConfig,
	getCreditsConfig,
	getEmailConfig,
	getGeneralConfig,
	updateGeneralConfig,
	updateAffiliateConfig,
	updateAuthenticationConfig,
	updateCreditsConfig,
	updateEmailConfig,
	type AuthenticationConfig,
	type AffiliateConfig,
	type CreditsConfig,
	type EmailConfig,
	type GeneralConfig
} from '../../config'

import {
	AIConfigError,
	createAIProvider,
	deleteAIProvider,
	getAIConfig,
	updateAIProvider,
	updateAIConfig,
	type AIConfigView,
	type UpdateAIConfigInput
} from '../../ai/config'
import {
	createPaymentProduct,
	deletePaymentProduct,
	getPaymentConfig,
	PaymentConfigError,
	updatePaymentConfig,
	updatePaymentProduct,
	type PaymentConfigView,
	type PaymentProductValues
} from '../../payment/config'
import type { AIProvider, PaymentProduct } from '../../db/schema.meta'

import { formatDecimal, parseDecimal } from '../../lib/decimal'
import { logError } from '../../lib/log'
import { parseRequest } from '../../lib/request'

export async function getGeneralConfigHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, GetGeneralConfigApi.request)
	if (!request.success) {
		const error = GetGeneralConfigApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}

	try {
		const config: GeneralConfig = await getGeneralConfig(ctx.get('metaDb'))
		return ctx.json(toGeneralConfigResponse(config) as GeneralConfigResponse)
	} catch (error) {
		return mapConfigurationError(ctx, error, 'general')
	}
}

export async function getAuthenticationConfigHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, GetAuthenticationConfigApi.request)
	if (!request.success) {
		const error = GetAuthenticationConfigApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}

	try {
		const config: AuthenticationConfig = await getAuthenticationConfig(ctx.get('metaDb'))
		return ctx.json(
			toAuthenticationConfigResponse(config, ctx.env.APP_BASE_URL) as AuthenticationConfigResponse
		)
	} catch (error) {
		return mapConfigurationError(ctx, error, 'authentication')
	}
}

export async function updateAuthenticationConfigHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, UpdateAuthenticationConfigApi.request)
	if (!request.success) {
		const error = UpdateAuthenticationConfigApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}

	try {
		const config: AuthenticationConfig = await updateAuthenticationConfig(
			ctx.get('metaDb'),
			ctx.env.CONFIG_ENCRYPTION_KEY,
			{
				betaCodeEnabled: request.data.beta_code_enabled,
					registrationEnabled: request.data.registration_enabled,
				emailSignupDomainAllowlist: request.data.email_signup_domain_allowlist,
				emailRequireVerification: request.data.email_require_verification,
				emailUserActionCooldownSeconds: request.data.email_user_action_cooldown_seconds,
				turnstile: {
					enabled: request.data.turnstile_enabled
				},
				providers: {
					google: {
						enabled: request.data.google_auth_enabled,
						clientId: request.data.google_client_id,
						clientSecret: request.data.google_client_secret
					},
					github: {
						enabled: request.data.github_auth_enabled,
						clientId: request.data.github_client_id,
						clientSecret: request.data.github_client_secret
					},
					linuxdo: {
						enabled: request.data.linuxdo_auth_enabled,
						clientId: request.data.linuxdo_client_id,
						clientSecret: request.data.linuxdo_client_secret
					}
				},
				expectedVersion: request.data.expected_version,
				nowMs: Date.now()
			}
		)
		return ctx.json(
			toAuthenticationConfigResponse(config, ctx.env.APP_BASE_URL) as AuthenticationConfigResponse
		)
	} catch (error) {
		return mapConfigurationError(ctx, error, 'authentication')
	}
}

export async function getEmailConfigHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, GetEmailConfigApi.request)
	if (!request.success) {
		const error = GetEmailConfigApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}

	try {
		const config: EmailConfig = await getEmailConfig(ctx.get('metaDb'))
		return ctx.json(toEmailConfigResponse(config) as EmailConfigResponse)
	} catch (error) {
		return mapConfigurationError(ctx, error, 'email')
	}
}

export async function updateEmailConfigHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, UpdateEmailConfigApi.request)
	if (!request.success) {
		const error = UpdateEmailConfigApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}

	try {
		const config: EmailConfig = await updateEmailConfig(
			ctx.get('metaDb'),
			ctx.env.CONFIG_ENCRYPTION_KEY,
			{
					provider: request.data.provider,
				resendApiKey: request.data.resend_api_key,
				expectedVersion: request.data.expected_version,
				nowMs: Date.now()
			}
		)
		return ctx.json(toEmailConfigResponse(config) as EmailConfigResponse)
	} catch (error) {
		return mapConfigurationError(ctx, error, 'email')
	}
}

export async function updateGeneralConfigHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, UpdateGeneralConfigApi.request)
	if (!request.success) {
		const error = UpdateGeneralConfigApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}

	try {
		const config: GeneralConfig = await updateGeneralConfig(ctx.get('metaDb'), {
			docsEnabled: request.data.docs_enabled,
			expectedVersion: request.data.expected_version,
			nowMs: Date.now()
		})
		return ctx.json(toGeneralConfigResponse(config) as GeneralConfigResponse)
	} catch (error) {
		return mapConfigurationError(ctx, error, 'general')
	}
}

export async function getCreditsConfigHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, GetCreditsConfigApi.request)
	if (!request.success) {
		const error = GetCreditsConfigApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}

	try {
		const config: CreditsConfig = await getCreditsConfig(ctx.get('metaDb'))
		return ctx.json(toCreditsConfigResponse(config) as CreditsConfigResponse)
	} catch (error) {
		return mapConfigurationError(ctx, error, 'credits')
	}
}

export async function updateCreditsConfigHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, UpdateCreditsConfigApi.request)
	if (!request.success) {
		const error = UpdateCreditsConfigApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}

	try {
		const config: CreditsConfig = await updateCreditsConfig(ctx.get('metaDb'), {
			signupEnabled: request.data.signup_enabled,
			signupAmount: parseConfigCreditAmount(request.data.signup_amount),
			dailyCheckinEnabled: request.data.daily_checkin_enabled,
			dailyCheckinAmount: parseConfigCreditAmount(request.data.daily_checkin_amount),
			historyRetentionDays: request.data.history_retention_days,
			expectedVersion: request.data.expected_version,
			nowMs: Date.now()
		})
		return ctx.json(toCreditsConfigResponse(config) as CreditsConfigResponse)
	} catch (error) {
		return mapConfigurationError(ctx, error, 'credits')
	}
}

export async function getAffiliateConfigHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, GetAffiliateConfigApi.request)
	if (!request.success) {
		const error = GetAffiliateConfigApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}

	try {
		const config: AffiliateConfig = await getAffiliateConfig(ctx.get('metaDb'))
		return ctx.json(toAffiliateConfigResponse(config) as AffiliateConfigResponse)
	} catch (error) {
		return mapConfigurationError(ctx, error, 'affiliate')
	}
}

export async function updateAffiliateConfigHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, UpdateAffiliateConfigApi.request)
	if (!request.success) {
		const error = UpdateAffiliateConfigApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}

	try {
		const config: AffiliateConfig = await updateAffiliateConfig(ctx.get('metaDb'), {
			enabled: request.data.enabled,
			inviterCreditAmount: parseConfigCreditAmount(request.data.inviter_credit_amount),
			inviteeCreditAmount: parseConfigCreditAmount(request.data.invitee_credit_amount),
			expectedVersion: request.data.expected_version,
			nowMs: Date.now()
		})
		return ctx.json(toAffiliateConfigResponse(config) as AffiliateConfigResponse)
	} catch (error) {
		return mapConfigurationError(ctx, error, 'affiliate')
	}
}

export async function getPaymentConfigHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, GetPaymentConfigApi.request)
	if (!request.success) {
		const error = GetPaymentConfigApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	try {
		const config: PaymentConfigView = await getPaymentConfig(ctx.get('metaDb'))
		return ctx.json(toPaymentConfigResponse(config, ctx.env.APP_BASE_URL) as PaymentConfigResponse)
	} catch (error) {
		return mapPaymentConfigurationError(ctx, error)
	}
}

export async function updatePaymentConfigHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, UpdatePaymentConfigApi.request)
	if (!request.success) {
		const error = UpdatePaymentConfigApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	try {
		const config: PaymentConfigView = await updatePaymentConfig(
			ctx.get('metaDb'),
			ctx.env.CONFIG_ENCRYPTION_KEY,
			{
				enabled: request.data.enabled,
				defaultProvider: request.data.default_provider,
				providerCountryOverrides: request.data.country_provider_overrides,
				providers: {
					dodo: {
						testMode: request.data.dodo_test_mode,
						apiKey: request.data.dodo_api_key,
						webhookSecret: request.data.dodo_webhook_secret
					},
					creem: {
						testMode: request.data.creem_test_mode,
						apiKey: request.data.creem_api_key,
						webhookSecret: request.data.creem_webhook_secret
					}
				},
				expectedVersion: request.data.expected_version,
				nowMs: Date.now()
			}
		)
		return ctx.json(toPaymentConfigResponse(config, ctx.env.APP_BASE_URL) as PaymentConfigResponse)
	} catch (error) {
		return mapPaymentConfigurationError(ctx, error)
	}
}

export async function createPaymentProductHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, CreatePaymentProductApi.request)
	if (!request.success) {
		const error = CreatePaymentProductApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	try {
		const product: PaymentProduct = await createPaymentProduct(ctx.get('metaDb'), {
			...toPaymentProductInput(request.data),
			provider: request.data.provider,
			nowMs: Date.now()
		})
		return ctx.json(toPaymentProductResponse(product) as PaymentProductResponse)
	} catch (error) {
		return mapPaymentConfigurationError(ctx, error)
	}
}

export async function updatePaymentProductHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, UpdatePaymentProductApi.request)
	if (!request.success) {
		const error = UpdatePaymentProductApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	try {
		const product: PaymentProduct = await updatePaymentProduct(ctx.get('metaDb'), {
			...toPaymentProductInput(request.data),
			expectedVersion: request.data.expected_version,
			nowMs: Date.now()
		})
		return ctx.json(toPaymentProductResponse(product) as PaymentProductResponse)
	} catch (error) {
		return mapPaymentConfigurationError(ctx, error)
	}
}

export async function deletePaymentProductHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, DeletePaymentProductApi.request)
	if (!request.success) {
		const error = DeletePaymentProductApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	try {
		await deletePaymentProduct(ctx.get('metaDb'), {
			id: request.data.product_id,
			expectedVersion: request.data.expected_version
		})
		return ctx.json({ product_id: request.data.product_id })
	} catch (error) {
		return mapPaymentConfigurationError(ctx, error)
	}
}

export async function getAIConfigHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, GetAIConfigApi.request)
	if (!request.success) {
		const error = GetAIConfigApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	try {
		const config: AIConfigView = await getAIConfig(ctx.get('metaDb'))
		return ctx.json(toAIConfigResponse(config) as AIConfigResponse)
	} catch (error) {
		return mapAIConfigurationError(ctx, error)
	}
}

export async function updateAIConfigHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, UpdateAIConfigApi.request)
	if (!request.success) {
		const error = UpdateAIConfigApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	try {
		const input: UpdateAIConfigInput = {
			routing: {
				errorWeight: request.data.routing_error_weight,
				latencyWeight: request.data.routing_latency_weight,
				priceWeight: request.data.routing_price_weight
			},
			taskRetentionDays: request.data.task_retention_days,
			expectedVersion: request.data.expected_version,
			nowMs: Date.now()
		}
		const config: AIConfigView = await updateAIConfig(ctx.get('metaDb'), input)
		return ctx.json(toAIConfigResponse(config) as AIConfigResponse)
	} catch (error) {
		return mapAIConfigurationError(ctx, error)
	}
}

export async function createAIProviderHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, CreateAIProviderApi.request)
	if (!request.success) {
		const error = CreateAIProviderApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	try {
		const provider: AIProvider = await createAIProvider(
			ctx.get('metaDb'),
			ctx.env.CONFIG_ENCRYPTION_KEY,
			{
				id: request.data.id,
				name: request.data.name,
				type: request.data.type,
				baseUrl: request.data.base_url,
				models: request.data.models,
				priceMultiplier: request.data.price_multiplier,
				apiKey: request.data.api_key,
				enabled: request.data.enabled,
				nowMs: Date.now()
			}
		)
		return ctx.json(toAIProviderResponse(provider) as AIProviderResponse)
	} catch (error) {
		return mapAIConfigurationError(ctx, error)
	}
}

export async function updateAIProviderHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, UpdateAIProviderApi.request)
	if (!request.success) {
		const error = UpdateAIProviderApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	try {
		const provider: AIProvider = await updateAIProvider(
			ctx.get('metaDb'),
			ctx.env.CONFIG_ENCRYPTION_KEY,
			{
				id: request.data.id,
				name: request.data.name,
				type: request.data.type,
				baseUrl: request.data.base_url,
				models: request.data.models,
				priceMultiplier: request.data.price_multiplier,
				apiKey: request.data.api_key,
				enabled: request.data.enabled,
				expectedVersion: request.data.expected_version,
				nowMs: Date.now()
			}
		)
		return ctx.json(toAIProviderResponse(provider) as AIProviderResponse)
	} catch (error) {
		return mapAIConfigurationError(ctx, error)
	}
}

export async function deleteAIProviderHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, DeleteAIProviderApi.request)
	if (!request.success) {
		const error = DeleteAIProviderApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	try {
		await deleteAIProvider(ctx.get('metaDb'), {
			id: request.data.id,
			expectedVersion: request.data.expected_version
		})
		return ctx.json({ id: request.data.id })
	} catch (error) {
		return mapAIConfigurationError(ctx, error)
	}
}

function toAIConfigResponse(config: AIConfigView): AIConfigResponse {
	return {
		routing_error_weight: config.routing.errorWeight,
		routing_latency_weight: config.routing.latencyWeight,
		routing_price_weight: config.routing.priceWeight,
		task_retention_days: config.taskRetentionDays,
		providers: config.providers.map(toAIProviderResponse),
		version: config.version
	}
}

function toAIProviderResponse(provider: AIProvider): AIProviderResponse {
	return {
		id: provider.id,
		name: provider.name,
		type: provider.type as AIProviderResponse['type'],
		base_url: provider.baseUrl,
		models: provider.models,
		price_multiplier: provider.priceMultiplier,
		api_key_configured: true,
		enabled: provider.enabled,
		version: provider.version
	}
}

function mapAIConfigurationError(ctx: Context<ApiEnv>, error: unknown): Response {
	if (error instanceof ConfigStoreError) {
		return mapConfigurationError(ctx, error, 'ai')
	}
	if (!(error instanceof AIConfigError)) {
		throw error
	}
	switch (error.code) {
		case 'AI_PROVIDER_NOT_FOUND': {
			const response = GetAIConfigApi.errors.CONFIG_NOT_FOUND()
			return ctx.json(response.body, response.status)
		}
		case 'AI_PROVIDER_CONFLICT': {
			const response = GetAIConfigApi.errors.CONFIG_CONFLICT()
			return ctx.json(response.body, response.status)
		}
		case 'AI_CONFIG_INVALID':
		case 'AI_PROVIDER_CONFIG_INVALID': {
			const response = GetAIConfigApi.errors.INVALID_REQUEST(error.message)
			return ctx.json(response.body, response.status)
		}
	}
}

function toPaymentConfigResponse(config: PaymentConfigView, baseUrl: string): PaymentConfigResponse {
	return {
		enabled: config.enabled,
		default_provider: config.defaultProvider,
		country_provider_overrides: config.providerCountryOverrides,
		dodo: {
			test_mode: config.providers.dodo.testMode,
			api_key_configured: config.providers.dodo.apiKey !== null,
			webhook_secret_configured: config.providers.dodo.webhookSecret !== null,
			webhook_url: new URL('/api/webhook/dodo', baseUrl).toString()
		},
		creem: {
			test_mode: config.providers.creem.testMode,
			api_key_configured: config.providers.creem.apiKey !== null,
			webhook_secret_configured: config.providers.creem.webhookSecret !== null,
			webhook_url: new URL('/api/webhook/creem', baseUrl).toString()
		},
		products: config.products.map(toPaymentProductResponse),
		version: config.version
	}
}

function toPaymentProductResponse(product: PaymentProduct): PaymentProductResponse {
	return {
		product_id: product.id,
		type: product.type as 'one_time' | 'subscription',
		credits_amount: product.creditsAmount === null ? null : formatDecimal(product.creditsAmount),
		subscription_plan: product.subscriptionPlan,
		upgrade_rank: product.upgradeRank,
		period_credits_amount:
			product.periodCreditsAmount === null ? null : formatDecimal(product.periodCreditsAmount),
		provider: product.provider as PaymentProductResponse['provider'],
		test_mode: product.testMode,
		provider_product_id: product.providerProductId,
		version: product.version
	}
}

function toPaymentProductInput(product: {
	product_id: string
	type: 'one_time' | 'subscription'
	credits_amount: string | null
	subscription_plan: string | null
	upgrade_rank: number | null
	period_credits_amount: string | null
	provider_product_id: string
}): PaymentProductValues {
	return {
		id: product.product_id,
		type: product.type,
		creditsAmount:
			product.credits_amount === null ? null : parseConfigCreditAmount(product.credits_amount),
		subscriptionPlan: product.subscription_plan,
		upgradeRank: product.upgrade_rank,
		periodCreditsAmount:
			product.period_credits_amount === null
				? null
				: parseConfigCreditAmount(product.period_credits_amount),
		providerProductId: product.provider_product_id
	}
}

function mapPaymentConfigurationError(ctx: Context<ApiEnv>, error: unknown): Response {
	if (error instanceof ConfigStoreError) {
		return mapConfigurationError(ctx, error, 'payment')
	}
	if (!(error instanceof PaymentConfigError)) {
		throw error
	}
	switch (error.code) {
		case 'PAYMENT_PRODUCT_NOT_FOUND': {
			const response = GetPaymentConfigApi.errors.CONFIG_NOT_FOUND()
			return ctx.json(response.body, response.status)
		}
		case 'PAYMENT_PRODUCT_CONFLICT':
		case 'PAYMENT_PRODUCT_REFERENCED': {
			const response = GetPaymentConfigApi.errors.CONFIG_CONFLICT()
			return ctx.json(response.body, response.status)
		}
		case 'PAYMENT_PROVIDER_INVALID':
		case 'PAYMENT_PROVIDER_COUNTRY_OVERRIDES_INVALID':
		case 'PAYMENT_PROVIDER_CREDENTIALS_MISSING':
		case 'PAYMENT_PRODUCT_ENVIRONMENT_MISMATCH':
		case 'PAYMENT_PRODUCTS_INVALID': {
			const response = GetPaymentConfigApi.errors.INVALID_REQUEST(error.message)
			return ctx.json(response.body, response.status)
		}
	}
}

function toGeneralConfigResponse(config: GeneralConfig): GeneralConfigResponse {
	return {
		docs_enabled: config.docsEnabled,
		version: config.version
	}
}

function toAuthenticationConfigResponse(
	config: AuthenticationConfig,
	baseUrl: string
): AuthenticationConfigResponse {
	return {
		beta_code_enabled: config.betaCodeEnabled,
		registration_enabled: config.registrationEnabled,
		email_signup_domain_allowlist: config.emailSignupDomainAllowlist,
		email_require_verification: config.emailRequireVerification,
		email_user_action_cooldown_seconds: config.emailUserActionCooldownSeconds,
		turnstile_enabled: config.turnstile.enabled,
		google_auth_enabled: config.providers.google.enabled,
		google_client_id: config.providers.google.clientId,
		google_client_secret_configured: config.providers.google.clientSecret !== null,
		google_callback_url: new URL('/api/auth/callback/google', baseUrl).toString(),
		github_auth_enabled: config.providers.github.enabled,
		github_client_id: config.providers.github.clientId,
		github_client_secret_configured: config.providers.github.clientSecret !== null,
		github_callback_url: new URL('/api/auth/callback/github', baseUrl).toString(),
		linuxdo_auth_enabled: config.providers.linuxdo.enabled,
		linuxdo_client_id: config.providers.linuxdo.clientId,
		linuxdo_client_secret_configured: config.providers.linuxdo.clientSecret !== null,
		linuxdo_callback_url: new URL('/api/auth/oauth2/callback/linuxdo', baseUrl).toString(),
		version: config.version
	}
}

function toEmailConfigResponse(config: EmailConfig): EmailConfigResponse {
	return {
		provider: config.provider,
		resend_api_key_configured: config.resendApiKey !== null,
		version: config.version
	}
}

function toCreditsConfigResponse(config: CreditsConfig): CreditsConfigResponse {
	return {
		signup_enabled: config.signupEnabled,
		signup_amount: formatDecimal(config.signupAmount),
		daily_checkin_enabled: config.dailyCheckinEnabled,
		daily_checkin_amount: formatDecimal(config.dailyCheckinAmount),
		history_retention_days: config.historyRetentionDays,
		version: config.version
	}
}

function toAffiliateConfigResponse(config: AffiliateConfig): AffiliateConfigResponse {
	return {
		enabled: config.enabled,
		inviter_credit_amount: formatDecimal(config.inviterCreditAmount),
		invitee_credit_amount: formatDecimal(config.inviteeCreditAmount),
		version: config.version
	}
}

function parseConfigCreditAmount(raw: string): number {
	if (/^0+(?:\.0{1,6})?$/.test(raw)) {
		return 0
	}
	return parseDecimal(raw)
}

function mapConfigurationError(
	ctx: Context<ApiEnv>,
	error: unknown,
	domain: 'general' | 'authentication' | 'email' | 'credits' | 'affiliate' | 'payment' | 'ai'
): Response {
	if (!(error instanceof ConfigStoreError)) {
		throw error
	}

	switch (error.code) {
		case 'INVALID_UPDATE': {
			const response = GetGeneralConfigApi.errors.INVALID_REQUEST(error.message)
			return ctx.json(response.body, response.status)
		}
		case 'VERSION_CONFLICT': {
			const response = GetGeneralConfigApi.errors.CONFIG_CONFLICT()
			return ctx.json(response.body, response.status)
		}
		case 'SETTINGS_NOT_FOUND':
		case 'SETTINGS_INVALID': {
			logError(error, { domain })
			const response = GetGeneralConfigApi.errors.CONFIG_UNAVAILABLE()
			return ctx.json(response.body, response.status)
		}
	}
}
