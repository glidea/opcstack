import { parseDecimal } from '../lib/decimal'

export const PAYMENT_PROVIDER_DODO = 'dodo'
export const PAYMENT_PROVIDER_CREEM = 'creem'

export type PaymentProviderName = typeof PAYMENT_PROVIDER_DODO | typeof PAYMENT_PROVIDER_CREEM

export interface PaymentProviderCountryOverride {
	country: string
	provider: PaymentProviderName
}

export interface PaymentProductConfig {
	productId: string
	creditsAmount: number | null
	subscriptionPlan: string | null
	upgradeRank: number | null
	periodCreditsAmount: number | null
	providerProductIds: Partial<Record<PaymentProviderName, string>>
}

export interface PaymentConfig {
	enabled: boolean
	providers: PaymentProviderName[]
	defaultProvider: PaymentProviderName
	providerCountryOverrides: PaymentProviderCountryOverride[]
	products: PaymentProductConfig[]
}

export class PaymentConfigError extends Error {
	public readonly code: string

	constructor(code: string) {
		super(code)
		this.code = code
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
	const providers = parseProviders(env.PAYMENT_PROVIDERS)
	const defaultProvider = parseDefaultProvider(env.PAYMENT_DEFAULT_PROVIDER, providers)
	const providerCountryOverrides = parseCountryOverrides(
		env.PAYMENT_PROVIDER_COUNTRY_OVERRIDES,
		providers
	)
	const products = parseProducts(env.PAYMENT_PRODUCTS)

	return {
		enabled: String(env.PAYMENT_ENABLED) === 'true',
		providers,
		defaultProvider,
		providerCountryOverrides,
		products
	}
}

function parseProviders(raw: string): PaymentProviderName[] {
	const providers = raw
		.split(';')
		.map((item) => item.trim())
		.filter((item) => item !== '')
		.map((item) => toProviderName(item))

	if (providers.length === 0) {
		throw new PaymentConfigError('PAYMENT_PROVIDERS_INVALID')
	}

	return providers
}

function parseDefaultProvider(
	raw: string,
	providers: PaymentProviderName[]
): PaymentProviderName {
	const value = toProviderName(raw.trim())
	if (!providers.includes(value)) {
		throw new PaymentConfigError('PAYMENT_DEFAULT_PROVIDER_INVALID')
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
		credits_amount?: string
		subscription_plan?: string
		upgrade_rank?: number
		period_credits_amount?: string
		provider_product_ids?: Record<string, string>
	}>
	const products: PaymentProductConfig[] = []

	for (const item of value) {
		const productId = String(item.product_id ?? '').trim()
		if (productId === '') {
			throw new PaymentConfigError('PAYMENT_PRODUCTS_INVALID')
		}

		const providerProductIds = parseProviderProductIds(item.provider_product_ids)

		products.push({
			productId,
			creditsAmount: toNullableCreditUnits(item.credits_amount),
			subscriptionPlan: toNullableText(item.subscription_plan),
			upgradeRank: toNullableInt(item.upgrade_rank),
			periodCreditsAmount: toNullableCreditUnits(item.period_credits_amount),
			providerProductIds
		})
	}

	return products
}

function parseProviderProductIds(
	input: Record<string, string> | undefined
): Partial<Record<PaymentProviderName, string>> {
	const source = input ?? {}
	const result: Partial<Record<PaymentProviderName, string>> = {}
	for (const key in source) {
		const provider = toProviderName(key)
		const value = source[key]?.trim() ?? ''
		if (value === '') {
			throw new PaymentConfigError('PAYMENT_PRODUCTS_INVALID')
		}
		result[provider] = value
	}
	return result
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

function toNullableText(value: string | undefined): string | null {
	if (value === undefined) {
		return null
	}
	const text = value.trim()
	if (text === '') {
		return null
	}
	return text
}
