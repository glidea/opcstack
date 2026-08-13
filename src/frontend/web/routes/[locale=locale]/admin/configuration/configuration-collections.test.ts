import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { AIProvider, PaymentProduct } from '$apiContract/configuration'
import {
	removeConfigurationEntity,
	replaceConfigurationEntity,
	validateAIProviderForm,
	validatePaymentProductForm
} from './configuration-collections'

const routeDirectory: string = fileURLToPath(new URL('.', import.meta.url))

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
			upgradeRank: 'Upgrade rank is required',
			periodCreditsAmount: 'Period credit amount is required',
			providerProductId: 'At least one provider product ID is required'
		})
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
})

describe('configuration collection interface', () => {
		it('implements independent sheets, conflict refresh, secret state, and delete confirmation', () => {
		const paymentSource: string = readFileSync(`${routeDirectory}PaymentConfigurationForm.svelte`, 'utf8')
		const aiSource: string = readFileSync(`${routeDirectory}AIConfigurationForm.svelte`, 'utf8')
		const productSource: string = readFileSync(`${routeDirectory}PaymentProductDialog.svelte`, 'utf8')
		const providerSource: string = readFileSync(`${routeDirectory}AIProviderDialog.svelte`, 'utf8')
		const combined: string = `${paymentSource}\n${aiSource}\n${productSource}\n${providerSource}`

		expect(combined).toContain('CONFIG_CONFLICT')
		expect(combined).toContain('AlertDialog')
			expect(productSource).toContain("$frontend/ui/sheet")
			expect(providerSource).toContain("$frontend/ui/sheet")
			expect(productSource).not.toContain("$frontend/ui/dialog")
			expect(providerSource).not.toContain("$frontend/ui/dialog")
		expect(combined).toContain('api_key_configured')
		expect(combined).toContain('Empty')
		})

		it('renders country provider overrides as rows and copies payment webhook URLs', () => {
			const paymentSource: string = readFileSync(`${routeDirectory}PaymentConfigurationForm.svelte`, 'utf8')

			expect(paymentSource).toContain('{#each countryOverrides as override, index}')
			expect(paymentSource).toContain('addCountryOverride')
			expect(paymentSource).toContain('removeCountryOverride')
			expect(paymentSource).toContain('copyWebhookUrl')
			expect(paymentSource).not.toContain('<Textarea id="payment-country-overrides"')
		})
	})
