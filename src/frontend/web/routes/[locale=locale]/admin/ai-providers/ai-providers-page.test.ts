import { describe, expect, it } from 'vitest'
import type { AIProvider } from '$apiContract/configuration'
import { removeAIProvider, replaceAIProvider, validateAIProviderForm } from './ai-providers-page'

const provider: AIProvider = {
	id: 'gemini-primary',
	type: 'image_gemini',
	name: 'Gemini primary',
	base_url: null,
	models: ['gemini-2.5-flash-image'],
	price_multiplier: 1,
	api_key_configured: true,
	enabled: true,
	version: 1
}

describe('AI provider workspace', () => {
	it('replaces and removes providers by ID', () => {
		const sibling: AIProvider = { ...provider, id: 'gemini-backup' }
		const updated: AIProvider = { ...provider, enabled: false, version: 2 }

		expect(replaceAIProvider([provider, sibling], updated)).toEqual([updated, sibling])
		expect(removeAIProvider([provider, sibling], provider.id)).toEqual([sibling])
	})

	it('requires a secret for creation and allows an edit to keep it', () => {
		const input = {
			type: 'image_gemini', name: 'Gemini primary',
			baseUrl: '', models: ['gemini-2.5-flash-image'],
			priceMultiplier: '1', apiKeyValue: ''
		}

		expect(validateAIProviderForm({ ...input, editing: false, apiKeyAction: 'replace' } as Parameters<typeof validateAIProviderForm>[0])).toEqual({ apiKey: 'API key is required' })
		expect(validateAIProviderForm({ ...input, editing: true, apiKeyAction: 'keep' } as Parameters<typeof validateAIProviderForm>[0])).toEqual({})
	})

	it('requires a URL only for OpenAI-compatible provider types', () => {
		const input = {
			editing: false,
			type: 'image_openai',
			name: 'Compatible image provider',
			baseUrl: '',
			models: ['gpt-image-1'],
			priceMultiplier: '1',
			apiKeyAction: 'replace',
			apiKeyValue: 'secret'
		}

		expect(validateAIProviderForm(input as Parameters<typeof validateAIProviderForm>[0])).toEqual({ baseUrl: 'Valid base URL is required' })
	})
})
