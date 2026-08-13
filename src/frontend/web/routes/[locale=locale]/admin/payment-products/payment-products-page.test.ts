import { describe, expect, it } from 'vitest'
import type { PaymentProduct } from '$apiContract/configuration'
import { removePaymentProduct, replacePaymentProduct, validatePaymentProductForm } from './payment-products-page'

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

	it('requires one provider product ID and fields for the selected product type', () => {
		expect(validatePaymentProductForm({
			productId: 'monthly-pro',
			type: 'subscription',
			creditsAmount: '',
			subscriptionPlan: '',
			upgradeRank: '',
			periodCreditsAmount: '',
			providerProductId: ''
		})).toEqual({
			providerProductId: 'Provider product ID is required',
			subscriptionPlan: 'Subscription plan is required',
			upgradeRank: 'Upgrade rank must be a non-negative whole number',
			periodCreditsAmount: 'Enter a positive credit amount with at most six decimal places'
		})
	})
})
