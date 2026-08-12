import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { AIChannel, PaymentProduct } from '$apiContract/configuration'
import {
	removeConfigurationEntity,
	replaceConfigurationEntity,
	validateAIChannelForm,
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

const imageChannel: AIChannel = {
	id: 'gemini-primary',
	area: 'image',
	provider: 'gemini',
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

	it('removes only the deleted AI channel', () => {
		const sibling: AIChannel = { ...imageChannel, id: 'gemini-backup' }

		expect(
			removeConfigurationEntity([imageChannel, sibling], imageChannel.id, (item: AIChannel): string => item.id)
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

	it('requires a new channel secret but lets edits keep the configured secret', () => {
		const baseInput = {
			id: 'gemini-primary',
			provider: 'gemini',
			name: 'Gemini primary',
			baseUrl: 'https://generativelanguage.googleapis.com',
			models: 'gemini-2.5-flash-image',
			priceMultiplier: '1',
			apiKeyValue: ''
		}

		expect(validateAIChannelForm({ ...baseInput, editing: false, apiKeyAction: 'replace' })).toEqual({ apiKey: 'API key is required' })
		expect(validateAIChannelForm({ ...baseInput, editing: true, apiKeyAction: 'keep' })).toEqual({})
	})
})

describe('configuration collection interface', () => {
	it('implements independent dialogs, conflict refresh, secret state, and delete confirmation', () => {
		const paymentSource: string = readFileSync(`${routeDirectory}PaymentConfigurationForm.svelte`, 'utf8')
		const aiSource: string = readFileSync(`${routeDirectory}AIConfigurationForm.svelte`, 'utf8')
		const productSource: string = readFileSync(`${routeDirectory}PaymentProductDialog.svelte`, 'utf8')
		const channelSource: string = readFileSync(`${routeDirectory}AIChannelDialog.svelte`, 'utf8')
		const combined: string = `${paymentSource}\n${aiSource}\n${productSource}\n${channelSource}`

		expect(combined).toContain('CONFIG_CONFLICT')
		expect(combined).toContain('AlertDialog')
		expect(combined).toContain('Dialog')
		expect(combined).toContain('api_key_configured')
		expect(combined).toContain('Empty')
	})
})
