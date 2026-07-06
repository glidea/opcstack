import { parseDecimal } from '../lib/decimal'

export const PAYMENT_PROVIDER_DODO = 'dodo'
export const PAYMENT_PROVIDER_CREEM = 'creem'

export type PaymentProviderName = typeof PAYMENT_PROVIDER_DODO | typeof PAYMENT_PROVIDER_CREEM
export type PaymentProductType = 'one_time' | 'subscription'

export interface PaymentProviderCountryOverride {
	country: string
	provider: PaymentProviderName
}

export interface RemotePaymentProviderProductConfig {
	kind: 'remote_product'
	productId: string
}

export interface InlinePaymentProviderProductConfig {
	kind: 'inline_product'
	name: string
	description: string | null
	amount: number
	currency: string
	payType: string | null
	productCode: string | null
}

export type PaymentProviderProductConfig =
	| RemotePaymentProviderProductConfig
	| InlinePaymentProviderProductConfig

export interface PaymentProductConfig {
	productId: string
	type: PaymentProductType
	creditsAmount: number | null
	subscriptionPlan: string | null
	upgradeRank: number | null
	periodCreditsAmount: number | null
	providers: Partial<Record<PaymentProviderName, PaymentProviderProductConfig>>
}

export interface PaymentConfig {
	enabled: boolean
	providers: PaymentProviderName[]
	defaultProvider: PaymentProviderName
	providerCountryOverrides: PaymentProviderCountryOverride[]
	products: PaymentProductConfig[]
}

export type PaymentConfigErrorCode =
	| 'PAYMENT_PROVIDER_INVALID'
	| 'PAYMENT_PROVIDER_COUNTRY_OVERRIDES_INVALID'
	| 'PAYMENT_PRODUCTS_INVALID'

export class PaymentConfigError extends Error {
	public readonly code: PaymentConfigErrorCode

	constructor(code: PaymentConfigErrorCode, message?: string) {
		super(message ?? paymentConfigErrorMessage(code))
		this.code = code
	}
}

function paymentConfigErrorMessage(code: PaymentConfigErrorCode): string {
	switch (code) {
		case 'PAYMENT_PROVIDER_INVALID':
			return 'Payment provider config is invalid'
		case 'PAYMENT_PROVIDER_COUNTRY_OVERRIDES_INVALID':
			return 'Payment provider country overrides are invalid'
		case 'PAYMENT_PRODUCTS_INVALID':
			return 'Payment products config is invalid'
	}
}

export interface SelectPaymentProviderInput {
	country: string | null
}

export class PaymentProviderRouter {
	private readonly defaultProvider: PaymentProviderName
	private readonly providerByCountry: Map<string, PaymentProviderName>

	constructor(config: {
		defaultProvider: PaymentProviderName
		providerCountryOverrides: PaymentProviderCountryOverride[]
	}) {
		this.defaultProvider = config.defaultProvider
		this.providerByCountry = new Map<string, PaymentProviderName>()

		for (const item of config.providerCountryOverrides) {
			this.providerByCountry.set(item.country, item.provider)
		}
	}

	select(input: SelectPaymentProviderInput): PaymentProviderName {
		if (!input.country) {
			return this.defaultProvider
		}

		const country = input.country.trim().toUpperCase()
		if (country === '') {
			return this.defaultProvider
		}

		return this.providerByCountry.get(country) ?? this.defaultProvider
	}
}

export function parsePaymentConfig(env: Env): PaymentConfig {
	const enabled = String(env.PAYMENT_ENABLED) === 'true'
	const products = parseProducts(env.PAYMENT_PRODUCTS)
	const providers = collectProviders(products)
	if (!enabled && providers.length === 0) {
		return {
			enabled,
			providers,
			defaultProvider: toProviderName(env.PAYMENT_PROVIDER),
			providerCountryOverrides: [],
			products
		}
	}

	const defaultProvider = parseDefaultProvider(env.PAYMENT_PROVIDER, providers)
	const providerCountryOverrides = parseCountryOverrides(
		env.PAYMENT_PROVIDER_COUNTRY_OVERRIDES,
		providers
	)

	return {
		enabled,
		providers,
		defaultProvider,
		providerCountryOverrides,
		products
	}
}

function parseDefaultProvider(
	raw: string,
	providers: PaymentProviderName[]
): PaymentProviderName {
	const value = toProviderName(raw.trim())
	if (!providers.includes(value)) {
		throw new PaymentConfigError('PAYMENT_PROVIDER_INVALID')
	}
	return value
}

function parseCountryOverrides(
	raw: string,
	providers: PaymentProviderName[]
): PaymentProviderCountryOverride[] {
	if (raw.trim() === '') {
		return []
	}

	const value = JSON.parse(raw) as Array<{ country?: string; provider?: string }>
	const result: PaymentProviderCountryOverride[] = []
	for (const item of value) {
		const country = String(item.country ?? '').trim().toUpperCase()
		const provider = toProviderName(String(item.provider ?? ''))
		if (country === '') {
			throw new PaymentConfigError('PAYMENT_PROVIDER_COUNTRY_OVERRIDES_INVALID')
		}
		if (!providers.includes(provider)) {
			throw new PaymentConfigError('PAYMENT_PROVIDER_COUNTRY_OVERRIDES_INVALID')
		}
		result.push({
			country,
			provider
		})
	}

	return result
}

function parseProducts(raw: string): PaymentProductConfig[] {
	if (raw.trim() === '') {
		return []
	}

	const value = JSON.parse(raw) as Array<{
		product_id?: string
		type?: string
		credits_amount?: string
		subscription_plan?: string
		upgrade_rank?: number
		period_credits_amount?: string
		providers?: Record<string, unknown>
	}>
	const products: PaymentProductConfig[] = []

	for (const item of value) {
		const productId = String(item.product_id ?? '').trim()
		if (productId === '') {
			throw new PaymentConfigError('PAYMENT_PRODUCTS_INVALID')
		}

		products.push({
			productId,
			type: parseProductType(item.type),
			creditsAmount: toNullableCreditUnits(item.credits_amount),
			subscriptionPlan: toNullableText(item.subscription_plan),
			upgradeRank: toNullableInt(item.upgrade_rank),
			periodCreditsAmount: toNullableCreditUnits(item.period_credits_amount),
			providers: parseProductProviders(item.providers)
		})
	}

	return products
}

function parseProductProviders(
	input: Record<string, unknown> | undefined
): Partial<Record<PaymentProviderName, PaymentProviderProductConfig>> {
	const source = input ?? {}
	const result: Partial<Record<PaymentProviderName, PaymentProviderProductConfig>> = {}
	for (const key in source) {
		const provider = toProviderName(key)
		const value = source[key]
		if (!isRecord(value)) {
			throw new PaymentConfigError('PAYMENT_PRODUCTS_INVALID')
		}
		result[provider] = parseProviderProductConfig(value)
	}
	return result
}

function parseProviderProductConfig(input: Record<string, unknown>): PaymentProviderProductConfig {
	const kind = String(input['kind'] ?? '').trim()
	switch (kind) {
		case 'remote_product':
			return {
				kind,
				productId: requireText(input['product_id'])
			}
		case 'inline_product':
			return {
				kind,
				name: requireText(input['name']),
				description: toNullableText(input['description']),
				amount: requireInt(input['amount']),
				currency: requireText(input['currency']).toUpperCase(),
				payType: toNullableText(input['pay_type']),
				productCode: toNullableText(input['product_code'])
			}
		default:
			throw new PaymentConfigError('PAYMENT_PRODUCTS_INVALID')
	}
}

function collectProviders(products: PaymentProductConfig[]): PaymentProviderName[] {
	const providers: PaymentProviderName[] = []
	for (const product of products) {
		for (const key in product.providers) {
			const provider = toProviderName(key)
			if (!providers.includes(provider)) {
				providers.push(provider)
			}
		}
	}
	return providers
}

function parseProductType(value: string | undefined): PaymentProductType {
	switch (value) {
		case 'one_time':
		case 'subscription':
			return value
		default:
			throw new PaymentConfigError('PAYMENT_PRODUCTS_INVALID')
	}
}

function toProviderName(raw: string): PaymentProviderName {
	const value = raw.trim().toLowerCase()
	if (value !== PAYMENT_PROVIDER_DODO && value !== PAYMENT_PROVIDER_CREEM) {
		throw new PaymentConfigError('PAYMENT_PROVIDER_INVALID')
	}
	return value
}

function toNullableInt(value: number | undefined): number | null {
	if (value === undefined) {
		return null
	}
	if (!Number.isInteger(value)) {
		throw new PaymentConfigError('PAYMENT_PRODUCTS_INVALID')
	}
	return value
}

function requireInt(value: unknown): number {
	if (!Number.isInteger(value)) {
		throw new PaymentConfigError('PAYMENT_PRODUCTS_INVALID')
	}
	return value as number
}

function requireText(value: unknown): string {
	const text = String(value ?? '').trim()
	if (text === '') {
		throw new PaymentConfigError('PAYMENT_PRODUCTS_INVALID')
	}
	return text
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toNullableCreditUnits(value: string | undefined): number | null {
	if (value === undefined) {
		return null
	}
	try {
		return parseDecimal(value)
	} catch {
		throw new PaymentConfigError('PAYMENT_PRODUCTS_INVALID')
	}
}

function toNullableText(value: unknown): string | null {
	if (value === undefined) {
		return null
	}
	const text = String(value).trim()
	if (text === '') {
		return null
	}
	return text
}
