export type PaymentProductFormValidationInput = {
	productId: string
	type: 'one_time' | 'subscription'
	creditsAmount: string
	subscriptionPlan: string
	upgradeRank: string
	periodCreditsAmount: string
	dodoProductId: string
	creemProductId: string
}

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

export function replaceConfigurationEntity<TEntity>(
	items: TEntity[],
	entity: TEntity,
	getId: (item: TEntity) => string
): TEntity[] {
	const entityId: string = getId(entity)
	const index: number = items.findIndex((item: TEntity): boolean => getId(item) === entityId)
	if (index === -1) {
		return [...items, entity]
	}
	return items.map((item: TEntity, itemIndex: number): TEntity => itemIndex === index ? entity : item)
}

export function removeConfigurationEntity<TEntity>(
	items: TEntity[],
	entityId: string,
	getId: (item: TEntity) => string
): TEntity[] {
	return items.filter((item: TEntity): boolean => getId(item) !== entityId)
}

export function validatePaymentProductForm(
	input: PaymentProductFormValidationInput
): Record<string, string> {
	const errors: Record<string, string> = {}
	if (input.productId.trim() === '') errors['productId'] = 'Product ID is required'
	if (input.type === 'one_time' && !isPositiveCreditAmount(input.creditsAmount)) {
		errors['creditsAmount'] = 'Enter a positive credit amount with at most six decimal places'
	}
	if (input.type === 'subscription') {
		if (input.subscriptionPlan.trim() === '') errors['subscriptionPlan'] = 'Subscription plan is required'
		const upgradeRank: number = Number(input.upgradeRank)
		if (!/^\d+$/.test(input.upgradeRank) || !Number.isInteger(upgradeRank) || upgradeRank < 0) {
			errors['upgradeRank'] = 'Upgrade rank must be a non-negative whole number'
		}
		if (!isPositiveCreditAmount(input.periodCreditsAmount)) {
			errors['periodCreditsAmount'] = 'Enter a positive credit amount with at most six decimal places'
		}
	}
	if (input.dodoProductId.trim() === '' && input.creemProductId.trim() === '') {
		errors['providerProductId'] = 'At least one provider product ID is required'
	}
	return errors
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

function isPositiveCreditAmount(value: string): boolean {
	if (!/^\d+(?:\.\d{1,6})?$/.test(value)) return false
	const [whole = '', fraction = '']: string[] = value.split('.')
	const units: number = Number(whole) * 1_000_000 + Number(fraction.padEnd(6, '0'))
	return Number.isSafeInteger(units) && units > 0
}
