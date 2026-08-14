import { describe, expect, test } from 'vitest'
import { CreateAIProviderRequestSchema } from './configuration'

describe('AI provider configuration contract', (): void => {
	test('accepts an official provider without a caller-provided ID', (): void => {
		const result = CreateAIProviderRequestSchema.safeParse({
			name: 'Google Gemini image',
			type: 'image_gemini',
			base_url: 'https://generativelanguage.googleapis.com',
			models: ['gemini-2.5-flash-image'],
			price_multiplier: 1,
			api_key: 'secret',
			enabled: true
		})

		expect(result.success).toBe(true)
	})

	test('rejects a caller-provided provider ID', (): void => {
		const result = CreateAIProviderRequestSchema.safeParse({
			id: 'caller-owned-id',
			name: 'Google Gemini image',
			type: 'image_gemini',
			base_url: 'https://generativelanguage.googleapis.com',
			models: ['gemini-2.5-flash-image'],
			price_multiplier: 1,
			api_key: 'secret',
			enabled: true
		})

		expect(result.success).toBe(false)
	})

	test('rejects a provider without a Base URL', (): void => {
		const result = CreateAIProviderRequestSchema.safeParse({
			name: 'Google Gemini image',
			type: 'image_gemini',
			base_url: null,
			models: ['gemini-2.5-flash-image'],
			price_multiplier: 1,
			api_key: 'secret',
			enabled: true
		})

		expect({ success: result.success }).toEqual({ success: false })
	})
})
