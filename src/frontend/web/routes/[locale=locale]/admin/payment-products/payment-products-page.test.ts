import { describe, expect, it } from 'vitest'
import type { PaymentProduct } from '$apiContract/configuration'
import {
	findRemotePaymentProduct,
	removePaymentProduct,
	replacePaymentProduct,
	validatePaymentProductForm
} from './payment-products-page'

const product: PaymentProduct = {
	product_id: 'credits-100',
	provider: 'dodo',
	test_mode: true,
	provider_product_id: 'prod_100',
	type: 'one_time',
	credits_amount: '100',
	subscription_plan: null,
	upgrade_rank: null,
	period_credits_amount: null,
	version: 1
}

describe('payment product workspace', () => {
	it('replaces and removes products by internal product ID', () => {
		const sibling: PaymentProduct = { ...product, product_id: 'credits-500' }
		const updated: PaymentProduct = { ...product, credits_amount: '120', version: 2 }

		expect(replacePaymentProduct([product, sibling], updated)).toEqual([updated, sibling])
		expect(removePaymentProduct([product, sibling], product.product_id)).toEqual([sibling])
	})

	it('validates only local entitlement fields', () => {
		expect(validatePaymentProductForm({
			type: 'subscription',
			creditsAmount: '',
			subscriptionPlan: '',
			upgradeRank: '',
			periodCreditsAmount: ''
		})).toEqual({
			subscriptionPlan: 'Subscription plan is required',
			upgradeRank: 'Upgrade rank must be a non-negative whole number',
			periodCreditsAmount: 'Enter a positive credit amount with at most six decimal places'
		})
	})

	it('matches a product only in the provider current environment', () => {
		const catalog = {
			provider: 'dodo' as const,
			environment: 'test' as const,
			items: [{
				provider_product_id: 'prod_100',
				name: '100 credits',
				description: null,
				price_amount: 500,
				currency: 'USD',
				type: 'one_time' as const
			}]
		}

		expect(findRemotePaymentProduct(product, catalog)?.name).toBe('100 credits')
		expect(findRemotePaymentProduct({ ...product, test_mode: false }, catalog)).toBeUndefined()
	})
})
