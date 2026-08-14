import type { AIProvider, AIProviderType } from '$apiContract/configuration'

export type AIProviderFormValidationInput = {
	editing: boolean
	type: AIProviderType
	name: string
	baseUrl: string
	models: string[]
	priceMultiplier: string
	apiKeyAction: 'keep' | 'replace'
	apiKeyValue: string
}

export function replaceAIProvider(items: AIProvider[], provider: AIProvider): AIProvider[] {
	const index: number = items.findIndex((item: AIProvider): boolean => item.id === provider.id)
	if (index === -1) {
		return [...items, provider]
	}
	return items.map((item: AIProvider, itemIndex: number): AIProvider => itemIndex === index ? provider : item)
}

export function removeAIProvider(items: AIProvider[], providerId: string): AIProvider[] {
	return items.filter((item: AIProvider): boolean => item.id !== providerId)
}

export function validateAIProviderForm(input: AIProviderFormValidationInput): Record<string, string> {
	const errors: Record<string, string> = {}
	if (input.name.trim() === '') errors['name'] = 'Name is required'
	try {
		new URL(input.baseUrl)
	} catch {
		errors['baseUrl'] = 'Valid base URL is required'
	}
	if (input.models.length === 0) errors['models'] = 'At least one model is required'
	const priceMultiplier: number = Number(input.priceMultiplier)
	if (!Number.isFinite(priceMultiplier) || priceMultiplier <= 0) errors['priceMultiplier'] = 'Price multiplier must be greater than zero'
	if ((!input.editing || input.apiKeyAction === 'replace') && input.apiKeyValue.trim() === '') errors['apiKey'] = 'API key is required'
	return errors
}

export function resolveAIProviderDefaultBaseUrl(type: AIProviderType): string {
	switch (type) {
		case 'chat_openai':
		case 'image_openai':
			return 'https://api.openai.com/v1'
		case 'image_gemini':
		case 'tts_gemini':
			return 'https://generativelanguage.googleapis.com'
		case 'image_seedream':
		case 'video_seedance':
			return 'https://ark.cn-beijing.volces.com/api/v3'
		case 'image_aliyun':
			return 'https://dashscope.aliyuncs.com/api/v1'
		case 'tts_seed':
		case 'realtime_doubao':
			return 'https://openspeech.bytedance.com/api/v3'
	}
}
