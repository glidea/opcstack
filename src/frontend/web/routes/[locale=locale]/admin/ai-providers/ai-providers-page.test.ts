import { describe, expect, it } from 'vitest'
import type { AIProvider } from '$apiContract/configuration'
import {
	removeAIProvider,
	replaceAIProvider,
	resolveAIProviderDefaultBaseUrl,
	validateAIProviderForm
} from './ai-providers-page'

const provider: AIProvider = {
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
			baseUrl: 'https://generativelanguage.googleapis.com', models: ['gemini-2.5-flash-image'],
			priceMultiplier: '1', apiKeyValue: ''
		}

		expect(validateAIProviderForm({ ...input, editing: false, apiKeyAction: 'replace' } as Parameters<typeof validateAIProviderForm>[0])).toEqual({ apiKey: 'API key is required' })
		expect(validateAIProviderForm({ ...input, editing: true, apiKeyAction: 'keep' } as Parameters<typeof validateAIProviderForm>[0])).toEqual({})
	})

	it('requires a URL for every provider type', () => {
		const input = {
			editing: false,
			type: 'image_gemini',
			name: 'Gemini image provider',
			baseUrl: '',
			models: ['gpt-image-1'],
			priceMultiplier: '1',
			apiKeyAction: 'replace',
			apiKeyValue: 'secret'
		}

		expect(validateAIProviderForm(input as Parameters<typeof validateAIProviderForm>[0])).toEqual({ baseUrl: 'Valid base URL is required' })
	})

	it('provides an editable official Base URL for each provider type', () => {
		expect({
			openai: resolveAIProviderDefaultBaseUrl('image_openai'),
			gemini: resolveAIProviderDefaultBaseUrl('image_gemini'),
			seedream: resolveAIProviderDefaultBaseUrl('image_seedream'),
			aliyun: resolveAIProviderDefaultBaseUrl('image_aliyun'),
			seed: resolveAIProviderDefaultBaseUrl('tts_seed')
		}).toEqual({
			openai: 'https://api.openai.com/v1',
			gemini: 'https://generativelanguage.googleapis.com',
			seedream: 'https://ark.cn-beijing.volces.com/api/v3',
			aliyun: 'https://dashscope.aliyuncs.com/api/v1',
			seed: 'https://openspeech.bytedance.com/api/v3'
		})
	})
})
