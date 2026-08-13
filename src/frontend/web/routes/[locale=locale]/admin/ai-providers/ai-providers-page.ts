import type { AIProvider } from '$apiContract/configuration'

export type AIProviderFormValidationInput = {
	editing: boolean
	id: string
	type: string
	name: string
	baseUrl: string
	models: string
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
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.id)) errors['id'] = 'Use lowercase letters, numbers, and hyphens'
	if (input.type.trim() === '') errors['type'] = 'Provider type is required'
	if (input.name.trim() === '') errors['name'] = 'Name is required'
	try {
		new URL(input.baseUrl)
	} catch {
		errors['baseUrl'] = 'Valid base URL is required'
	}
	if (input.models.split('\n').every((model: string): boolean => model.trim() === '')) errors['models'] = 'At least one model is required'
	const priceMultiplier: number = Number(input.priceMultiplier)
	if (!Number.isFinite(priceMultiplier) || priceMultiplier <= 0) errors['priceMultiplier'] = 'Price multiplier must be greater than zero'
	if ((!input.editing || input.apiKeyAction === 'replace') && input.apiKeyValue.trim() === '') errors['apiKey'] = 'API key is required'
	return errors
}
