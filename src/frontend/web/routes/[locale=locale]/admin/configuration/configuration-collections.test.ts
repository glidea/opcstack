import { describe, expect, it } from 'vitest'
import type { AIProvider, PaymentProduct } from '$apiContract/configuration'
import {
	removeConfigurationEntity,
	replaceConfigurationEntity,
	validateAIProviderForm,
	validatePaymentProductForm
} from './configuration-collections'

const oneTimeProduct: PaymentProduct = {
	product_id: 'credits-100',
	type: 'one_time',
	credits_amount: '100',
	subscription_plan: null,
	upgrade_rank: null,
	period_credits_amount: null,
	dodo_product_id: 'dodo-100',
	creem_product_id: null,
	version: 1
}

const imageProvider: AIProvider = {
	id: 'gemini-primary',
	type: 'image_gemini',
	name: 'Gemini primary',
	base_url: 'https://generativelanguage.googleapis.com',
	models: ['gemini-2.5-flash-image'],
	price_multiplier: 1,
	api_key_configured: true,
	enabled: true,
	version: 1
}

describe('configuration entity updates', () => {
	it('replaces only the saved payment product', () => {
		const sibling: PaymentProduct = { ...oneTimeProduct, product_id: 'credits-500' }
		const updated: PaymentProduct = { ...oneTimeProduct, credits_amount: '120', version: 2 }

		expect(
			replaceConfigurationEntity([oneTimeProduct, sibling], updated, (item: PaymentProduct): string => item.product_id)
		).toEqual([updated, sibling])
	})

	it('removes only the deleted AI provider', () => {
		const sibling: AIProvider = { ...imageProvider, id: 'gemini-backup' }

		expect(
			removeConfigurationEntity([imageProvider, sibling], imageProvider.id, (item: AIProvider): string => item.id)
		).toEqual([sibling])
	})
})

describe('configuration entity validation', () => {
	it('requires only the fields for the selected product type', () => {
		expect(validatePaymentProductForm({
			productId: 'monthly-pro',
			type: 'subscription',
			creditsAmount: '',
			subscriptionPlan: '',
			upgradeRank: '',
			periodCreditsAmount: '',
			dodoProductId: '',
			creemProductId: ''
		})).toEqual({
			subscriptionPlan: 'Subscription plan is required',
			upgradeRank: 'Upgrade rank must be a non-negative whole number',
			periodCreditsAmount: 'Enter a positive credit amount with at most six decimal places',
			providerProductId: 'At least one provider product ID is required'
		})
	})

	it('rejects invalid payment product numbers before submission', () => {
		expect(validatePaymentProductForm({
			productId: 'credits-100',
			type: 'one_time',
			creditsAmount: '0',
			subscriptionPlan: '',
			upgradeRank: '',
			periodCreditsAmount: '',
			dodoProductId: 'prod-100',
			creemProductId: ''
		})).toEqual({ creditsAmount: 'Enter a positive credit amount with at most six decimal places' })

		expect(validatePaymentProductForm({
			productId: 'monthly-pro',
			type: 'subscription',
			creditsAmount: '',
			subscriptionPlan: 'pro',
			upgradeRank: '1.5',
			periodCreditsAmount: '100',
			dodoProductId: 'prod-pro',
			creemProductId: ''
		})).toEqual({ upgradeRank: 'Upgrade rank must be a non-negative whole number' })
	})

	it('requires a new provider secret but lets edits keep the configured secret', () => {
		const baseInput = {
			id: 'gemini-primary',
			type: 'image_gemini',
			name: 'Gemini primary',
			baseUrl: 'https://generativelanguage.googleapis.com',
			models: 'gemini-2.5-flash-image',
			priceMultiplier: '1',
			apiKeyValue: ''
		}

		expect(validateAIProviderForm({ ...baseInput, editing: false, apiKeyAction: 'replace' })).toEqual({ apiKey: 'API key is required' })
		expect(validateAIProviderForm({ ...baseInput, editing: true, apiKeyAction: 'keep' })).toEqual({})
	})

	it('rejects a non-finite provider price multiplier', () => {
		expect(validateAIProviderForm({
			editing: false,
			id: 'gemini-primary',
			type: 'image_gemini',
			name: 'Gemini primary',
			baseUrl: 'https://generativelanguage.googleapis.com',
			models: 'gemini-2.5-flash-image',
			priceMultiplier: 'not-a-number',
			apiKeyAction: 'replace',
			apiKeyValue: 'secret'
		})).toEqual({ priceMultiplier: 'Price multiplier must be greater than zero' })
	})
})
