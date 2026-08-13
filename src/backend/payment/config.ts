import { and, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { MetaDb } from '../db'
import {
	paymentProduct,
	userSubscription,
	type PaymentProduct,
	type PaymentSettingsDocument
} from '../db/schema.meta'
import {
	readSystemSettingsSnapshot,
	updateSystemSettingsDomain
} from '../config'
import { decryptConfigSecret, mutateConfigSecret, type SecretMutation } from '../config/crypto'

export const PAYMENT_PROVIDER_DODO = 'dodo'
export const PAYMENT_PROVIDER_CREEM = 'creem'

export type PaymentProviderName = typeof PAYMENT_PROVIDER_DODO | typeof PAYMENT_PROVIDER_CREEM
export type PaymentProductType = 'one_time' | 'subscription'

export interface PaymentProviderCountryOverride {
	country: string
	provider: PaymentProviderName
}

export interface PaymentProductConfig {
	productId: string
	provider: PaymentProviderName
	providerProductId: string
	type: PaymentProductType
	creditsAmount: number | null
	subscriptionPlan: string | null
	upgradeRank: number | null
	periodCreditsAmount: number | null
}

export interface PaymentProviderRuntimeConfig {
	testMode: boolean
	apiKey: string
	webhookSecret: string
}

export interface PaymentConfig {
	enabled: boolean
	providers: PaymentProviderName[]
	defaultProvider: PaymentProviderName | null
	providerCountryOverrides: PaymentProviderCountryOverride[]
	products: PaymentProductConfig[]
}

export interface PaymentRuntimeConfig extends PaymentConfig {
	providerConfigs: Partial<Record<PaymentProviderName, PaymentProviderRuntimeConfig>>
}

export type PaymentConfigErrorCode =
	| 'PAYMENT_PROVIDER_INVALID'
	| 'PAYMENT_PROVIDER_COUNTRY_OVERRIDES_INVALID'
	| 'PAYMENT_PROVIDER_CREDENTIALS_MISSING'
	| 'PAYMENT_PRODUCTS_INVALID'
	| 'PAYMENT_PRODUCT_NOT_FOUND'
	| 'PAYMENT_PRODUCT_CONFLICT'
	| 'PAYMENT_PRODUCT_ENVIRONMENT_MISMATCH'
	| 'PAYMENT_PRODUCT_REFERENCED'

export class PaymentConfigError extends Error {
	public readonly code: PaymentConfigErrorCode

	constructor(code: PaymentConfigErrorCode, message?: string) {
		super(message ?? paymentConfigErrorMessage(code))
		this.name = 'PaymentConfigError'
		this.code = code
	}
}

function paymentConfigErrorMessage(code: PaymentConfigErrorCode): string {
	switch (code) {
		case 'PAYMENT_PROVIDER_INVALID':
			return 'Payment provider config is invalid'
		case 'PAYMENT_PROVIDER_COUNTRY_OVERRIDES_INVALID':
			return 'Payment provider country overrides are invalid'
		case 'PAYMENT_PROVIDER_CREDENTIALS_MISSING':
			return 'Payment provider credentials are missing'
		case 'PAYMENT_PRODUCTS_INVALID':
			return 'Payment product is invalid'
		case 'PAYMENT_PRODUCT_NOT_FOUND':
			return 'Payment product was not found'
		case 'PAYMENT_PRODUCT_CONFLICT':
			return 'Payment product has changed'
		case 'PAYMENT_PRODUCT_ENVIRONMENT_MISMATCH':
			return 'Payment product belongs to another provider environment'
		case 'PAYMENT_PRODUCT_REFERENCED':
			return 'Payment product is referenced by an effective subscription'
	}
}

export interface SelectPaymentProviderInput {
	country: string | null
}

export class PaymentProviderRouter {
	private readonly defaultProvider: PaymentProviderName | null
	private readonly providerByCountry: Map<string, PaymentProviderName>

	constructor(config: {
		defaultProvider: PaymentProviderName | null
		providerCountryOverrides: PaymentProviderCountryOverride[]
	}) {
		this.defaultProvider = config.defaultProvider
		this.providerByCountry = new Map<string, PaymentProviderName>()
		for (const item of config.providerCountryOverrides) {
			this.providerByCountry.set(item.country, item.provider)
		}
	}

	select(input: SelectPaymentProviderInput): PaymentProviderName {
		const country: string = input.country?.trim().toUpperCase() ?? ''
		const provider: PaymentProviderName | null =
			this.providerByCountry.get(country) ?? this.defaultProvider
		if (provider === null) {
			throw new PaymentConfigError('PAYMENT_PROVIDER_INVALID')
		}
		return provider
	}
}

export interface PaymentConfigView extends PaymentSettingsDocument {
	products: PaymentProduct[]
	version: number
}

export interface UpdatePaymentConfigInput {
	enabled: boolean
	defaultProvider: PaymentProviderName | null
	providerCountryOverrides: PaymentProviderCountryOverride[]
	providers: {
		dodo: PaymentProviderUpdate
		creem: PaymentProviderUpdate
	}
	expectedVersion: number
	nowMs: number
}

export interface PaymentProviderUpdate {
	testMode: boolean
	apiKey: SecretMutation
	webhookSecret: SecretMutation
}

export interface PaymentProductValues {
	id: string
	type: PaymentProductType
	creditsAmount: number | null
	subscriptionPlan: string | null
	upgradeRank: number | null
	periodCreditsAmount: number | null
	providerProductId: string
}

export interface CreatePaymentProductInput extends PaymentProductValues {
	provider: PaymentProviderName
	nowMs: number
}

export interface UpdatePaymentProductInput extends PaymentProductValues {
	expectedVersion: number
	nowMs: number
}

export async function getPaymentConfig(db: MetaDb): Promise<PaymentConfigView> {
	const settings = await readSystemSettingsSnapshot(db)
	const values: PaymentSettingsDocument = parsePaymentSettings(settings.paymentConfig)
	const products: PaymentProduct[] = await db.query.paymentProduct.findMany()
	return { ...values, products, version: settings.paymentVersion }
}

export async function updatePaymentConfig(
	db: MetaDb,
	encryptionKey: string,
	input: UpdatePaymentConfigInput
): Promise<PaymentConfigView> {
	const current: PaymentConfigView = await getPaymentConfig(db)
	const values: PaymentSettingsDocument = parsePaymentSettings({
		enabled: input.enabled,
		defaultProvider: input.defaultProvider,
		providerCountryOverrides: input.providerCountryOverrides,
		providers: {
			dodo: await mutateProvider(encryptionKey, current.providers.dodo, input.providers.dodo),
			creem: await mutateProvider(encryptionKey, current.providers.creem, input.providers.creem)
		}
	})
	validatePaymentSettings(values, current.products)
	const settings = await updateSystemSettingsDomain(db, {
		domain: 'payment',
		expectedVersion: input.expectedVersion,
		values,
		nowMs: input.nowMs
	})
	return {
		...parsePaymentSettings(settings.paymentConfig),
		products: current.products,
		version: settings.paymentVersion
	}
}

export async function getPaymentRuntimeConfig(
	db: MetaDb,
	encryptionKey: string
): Promise<PaymentRuntimeConfig> {
	const view: PaymentConfigView = await getPaymentConfig(db)
	validatePaymentSettings(view, view.products)
	const providerConfigs: Partial<Record<PaymentProviderName, PaymentProviderRuntimeConfig>> = {}
	const providers: PaymentProviderName[] = []
	for (const provider of [PAYMENT_PROVIDER_DODO, PAYMENT_PROVIDER_CREEM] as const) {
		const config = view.providers[provider]
		if (config.apiKey === null || config.webhookSecret === null) {
			continue
		}
		providerConfigs[provider] = {
			testMode: config.testMode,
			apiKey: await decryptConfigSecret(encryptionKey, config.apiKey),
			webhookSecret: await decryptConfigSecret(encryptionKey, config.webhookSecret)
		}
		providers.push(provider)
	}
	return {
		enabled: view.enabled,
		defaultProvider: view.defaultProvider,
		providerCountryOverrides: view.providerCountryOverrides,
		providers,
		providerConfigs,
		products: view.products
			.filter((product: PaymentProduct): boolean => {
				return view.providers[product.provider as PaymentProviderName].testMode === product.testMode
			})
			.map(toRuntimeProduct)
	}
}

export function validatePaymentSettings(
	settings: PaymentSettingsDocument,
	products: PaymentProduct[]
): void {
	parsePaymentSettings(settings)
	if (!settings.enabled) {
		return
	}
	if (settings.defaultProvider === null) {
		throw new PaymentConfigError('PAYMENT_PROVIDER_INVALID')
	}
	const selected: PaymentProviderName[] = [settings.defaultProvider]
	for (const override of settings.providerCountryOverrides) {
		if (!selected.includes(override.provider)) {
			selected.push(override.provider)
		}
	}
	for (const provider of selected) {
		const credentials = settings.providers[provider]
		if (credentials.apiKey === null || credentials.webhookSecret === null) {
			throw new PaymentConfigError('PAYMENT_PROVIDER_CREDENTIALS_MISSING')
		}
		const hasProduct: boolean = products.some((product: PaymentProduct): boolean => {
			return product.provider === provider && product.testMode === credentials.testMode
		})
		if (!hasProduct) {
			throw new PaymentConfigError('PAYMENT_PROVIDER_INVALID')
		}
	}
}

export async function createPaymentProduct(
	db: MetaDb,
	input: CreatePaymentProductInput
): Promise<PaymentProduct> {
	validatePaymentProduct(input)
	const settings = await readSystemSettingsSnapshot(db)
	const paymentSettings: PaymentSettingsDocument = parsePaymentSettings(settings.paymentConfig)
	const providerSettings = paymentSettings.providers[input.provider]
	if (providerSettings.apiKey === null || providerSettings.webhookSecret === null) {
		throw new PaymentConfigError('PAYMENT_PROVIDER_CREDENTIALS_MISSING')
	}
	const rows: PaymentProduct[] = await db
		.insert(paymentProduct)
		.values({
			id: input.id,
			provider: input.provider,
			testMode: providerSettings.testMode,
			providerProductId: input.providerProductId,
			type: input.type,
			creditsAmount: input.creditsAmount,
			subscriptionPlan: input.subscriptionPlan,
			upgradeRank: input.upgradeRank,
			periodCreditsAmount: input.periodCreditsAmount,
			version: 1,
			createdAt: input.nowMs,
			updatedAt: input.nowMs
		})
		.onConflictDoNothing()
		.returning()
	const row: PaymentProduct | undefined = rows[0]
	if (!row) {
		throw new PaymentConfigError('PAYMENT_PRODUCT_CONFLICT')
	}
	return row
}

export async function updatePaymentProduct(
	db: MetaDb,
	input: UpdatePaymentProductInput
): Promise<PaymentProduct> {
	validatePaymentProduct(input)
	const existing: PaymentProduct | undefined = await db.query.paymentProduct.findFirst({
		where: eq(paymentProduct.id, input.id)
	})
	if (!existing) {
		throw new PaymentConfigError('PAYMENT_PRODUCT_NOT_FOUND')
	}
	if (existing.version !== input.expectedVersion) {
		throw new PaymentConfigError('PAYMENT_PRODUCT_CONFLICT')
	}
	const settings = await readSystemSettingsSnapshot(db)
	const paymentSettings: PaymentSettingsDocument = parsePaymentSettings(settings.paymentConfig)
	const providerSettings = paymentSettings.providers[existing.provider as PaymentProviderName]
	if (providerSettings.apiKey === null || providerSettings.webhookSecret === null) {
		throw new PaymentConfigError('PAYMENT_PROVIDER_CREDENTIALS_MISSING')
	}
	if (providerSettings.testMode !== existing.testMode) {
		throw new PaymentConfigError('PAYMENT_PRODUCT_ENVIRONMENT_MISMATCH')
	}
	const rows: PaymentProduct[] = await db
		.update(paymentProduct)
		.set({
			providerProductId: input.providerProductId,
			type: input.type,
			creditsAmount: input.creditsAmount,
			subscriptionPlan: input.subscriptionPlan,
			upgradeRank: input.upgradeRank,
			periodCreditsAmount: input.periodCreditsAmount,
			version: sql`${paymentProduct.version} + 1`,
			updatedAt: input.nowMs
		})
		.where(and(eq(paymentProduct.id, input.id), eq(paymentProduct.version, input.expectedVersion)))
		.returning()
	const row: PaymentProduct | undefined = rows[0]
	if (row) {
		return row
	}
	throw new PaymentConfigError('PAYMENT_PRODUCT_CONFLICT')
}

export async function deletePaymentProduct(
	db: MetaDb,
	input: { id: string; expectedVersion: number }
): Promise<void> {
	const existing: PaymentProduct | undefined = await db.query.paymentProduct.findFirst({
		where: eq(paymentProduct.id, input.id)
	})
	if (!existing) {
		throw new PaymentConfigError('PAYMENT_PRODUCT_NOT_FOUND')
	}
	if (existing.version !== input.expectedVersion) {
		throw new PaymentConfigError('PAYMENT_PRODUCT_CONFLICT')
	}
	const referenced = await db.query.userSubscription.findFirst({
		columns: { userId: true },
		where: and(
			eq(userSubscription.productId, input.id),
			inArray(userSubscription.status, ['active', 'cancel_at_period_end', 'past_due'])
		)
	})
	if (referenced) {
		throw new PaymentConfigError('PAYMENT_PRODUCT_REFERENCED')
	}
	const rows: PaymentProduct[] = await db
		.delete(paymentProduct)
		.where(and(eq(paymentProduct.id, input.id), eq(paymentProduct.version, input.expectedVersion)))
		.returning()
	if (rows.length === 0) {
		throw new PaymentConfigError('PAYMENT_PRODUCT_CONFLICT')
	}
}

function parsePaymentSettings(value: unknown): PaymentSettingsDocument {
	const result: z.ZodSafeParseResult<PaymentSettingsDocument> = PaymentSettingsSchema.safeParse(value)
	if (!result.success) {
		throw new PaymentConfigError('PAYMENT_PROVIDER_INVALID')
	}
	return result.data
}

function validatePaymentProduct(input: PaymentProductValues & { nowMs: number }): void {
	const result = PaymentProductInputSchema.safeParse(input)
	if (!result.success) {
		throw new PaymentConfigError('PAYMENT_PRODUCTS_INVALID')
	}
	if (input.type === 'one_time') {
		if (
			input.creditsAmount === null ||
			input.creditsAmount <= 0 ||
			input.subscriptionPlan !== null ||
			input.upgradeRank !== null ||
			input.periodCreditsAmount !== null
		) {
			throw new PaymentConfigError('PAYMENT_PRODUCTS_INVALID')
		}
		return
	}
	if (
		input.creditsAmount !== null ||
		input.subscriptionPlan === null ||
		input.upgradeRank === null ||
		input.periodCreditsAmount === null ||
		input.periodCreditsAmount <= 0
	) {
		throw new PaymentConfigError('PAYMENT_PRODUCTS_INVALID')
	}
}

function toRuntimeProduct(row: PaymentProduct): PaymentProductConfig {
	return {
		productId: row.id,
		provider: row.provider as PaymentProviderName,
		providerProductId: row.providerProductId,
		type: row.type as PaymentProductType,
		creditsAmount: row.creditsAmount,
		subscriptionPlan: row.subscriptionPlan,
		upgradeRank: row.upgradeRank,
		periodCreditsAmount: row.periodCreditsAmount
	}
}

async function mutateProvider(
	encryptionKey: string,
	current: PaymentSettingsDocument['providers']['dodo'],
	input: PaymentProviderUpdate
): Promise<PaymentSettingsDocument['providers']['dodo']> {
	return {
		testMode: input.testMode,
		apiKey: await mutateConfigSecret(encryptionKey, current.apiKey, input.apiKey),
		webhookSecret: await mutateConfigSecret(
			encryptionKey,
			current.webhookSecret,
			input.webhookSecret
		)
	}
}

const EncryptedSecretSchema = z.object({ ciphertext: z.string().min(1), iv: z.string().min(1) })
const ProviderSchema = z.object({
	testMode: z.boolean(),
	apiKey: EncryptedSecretSchema.nullable(),
	webhookSecret: EncryptedSecretSchema.nullable()
})
const PaymentSettingsSchema = z.object({
	enabled: z.boolean(),
	defaultProvider: z.enum(['dodo', 'creem']).nullable(),
	providerCountryOverrides: z
		.array(
			z.object({
				country: z.string().trim().length(2).transform((value: string): string => value.toUpperCase()),
				provider: z.enum(['dodo', 'creem'])
			})
		)
		.refine(
			(items: PaymentProviderCountryOverride[]): boolean =>
				new Set(items.map((item: PaymentProviderCountryOverride): string => item.country)).size ===
				items.length
		),
	providers: z.object({ dodo: ProviderSchema, creem: ProviderSchema })
})
const PaymentProductInputSchema = z.object({
	id: z.string().trim().min(1),
	provider: z.enum(['dodo', 'creem']).optional(),
	providerProductId: z.string().trim().min(1),
	type: z.enum(['one_time', 'subscription']),
	creditsAmount: z.number().int().positive().safe().nullable(),
	subscriptionPlan: z.string().trim().min(1).nullable(),
	upgradeRank: z.number().int().nonnegative().nullable(),
	periodCreditsAmount: z.number().int().positive().safe().nullable(),
	nowMs: z.number().int().nonnegative()
})
