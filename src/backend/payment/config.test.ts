import { describe, expect, test } from 'vitest'
import type { MetaDb } from '../db'
import type { PaymentSettingsDocument } from '../db/schema.meta'
import {
	createPaymentProduct,
	deletePaymentProduct,
	PaymentConfigError,
	PaymentProviderRouter,
	validatePaymentSettings
} from './config'

describe('Payment D1 configuration', (): void => {
	test('routes a country to its configured provider', (): void => {
		const router: PaymentProviderRouter = new PaymentProviderRouter({
			defaultProvider: 'creem',
			providerCountryOverrides: [{ country: 'CN', provider: 'dodo' }]
		})

		expect({ provider: router.select({ country: 'cn' }) }).toEqual({ provider: 'dodo' })
	})

	test('rejects enabling payment without provider credentials', (): void => {
		const settings: PaymentSettingsDocument = createPaymentSettings()
		settings.enabled = true
		settings.defaultProvider = 'dodo'

		expect((): void => validatePaymentSettings(settings, [createProductRow()])).toThrowError(
			new PaymentConfigError('PAYMENT_PROVIDER_CREDENTIALS_MISSING')
		)
	})

	test('rejects one-time products without credits', async (): Promise<void> => {
		await expect(
			createPaymentProduct({} as MetaDb, {
				id: 'credits-100',
				type: 'one_time',
				creditsAmount: null,
				subscriptionPlan: null,
				upgradeRank: null,
				periodCreditsAmount: null,
				dodoProductId: 'prod-1',
				creemProductId: null,
				nowMs: 1000
			})
		).rejects.toEqual(new PaymentConfigError('PAYMENT_PRODUCTS_INVALID'))
	})

	test('returns conflict when an active subscription references a product', async (): Promise<void> => {
		const db: MetaDb = {
			delete: (): Record<string, unknown> => ({
				where: (): Record<string, unknown> => ({
					returning: async (): Promise<unknown[]> => []
				})
			}),
			query: {
				paymentProduct: {
					findFirst: async (): Promise<unknown> => createProductRow()
				},
				userSubscription: {
					findFirst: async (): Promise<unknown> => ({ userId: 'user-1' })
				}
			}
		} as unknown as MetaDb

		await expect(
			deletePaymentProduct(db, { id: 'credits-100', expectedVersion: 1 })
		).rejects.toEqual(new PaymentConfigError('PAYMENT_PRODUCT_REFERENCED'))
	})
})

function createPaymentSettings(): PaymentSettingsDocument {
	return {
		enabled: false,
		defaultProvider: null,
		providerCountryOverrides: [],
		providers: {
			dodo: { testMode: true, apiKey: null, webhookSecret: null },
			creem: { testMode: true, apiKey: null, webhookSecret: null }
		}
	}
}

function createProductRow(): {
	id: string
	type: string
	creditsAmount: number
	subscriptionPlan: null
	upgradeRank: null
	periodCreditsAmount: null
	dodoProductId: string
	creemProductId: null
	version: number
	createdAt: number
	updatedAt: number
} {
	return {
		id: 'credits-100',
		type: 'one_time',
		creditsAmount: 100_000_000,
		subscriptionPlan: null,
		upgradeRank: null,
		periodCreditsAmount: null,
		dodoProductId: 'prod-1',
		creemProductId: null,
		version: 1,
		createdAt: 1000,
		updatedAt: 1000
	}
}
