import type { PaymentProduct } from '$apiContract/configuration'

export type PaymentProductFormValidationInput = {
	productId: string
	type: 'one_time' | 'subscription'
	creditsAmount: string
	subscriptionPlan: string
	upgradeRank: string
	periodCreditsAmount: string
	providerProductId: string
}

export function replacePaymentProduct(items: PaymentProduct[], product: PaymentProduct): PaymentProduct[] {
	const index: number = items.findIndex((item: PaymentProduct): boolean => item.product_id === product.product_id)
	if (index === -1) {
		return [...items, product]
	}
	return items.map((item: PaymentProduct, itemIndex: number): PaymentProduct => itemIndex === index ? product : item)
}

export function removePaymentProduct(items: PaymentProduct[], productId: string): PaymentProduct[] {
	return items.filter((item: PaymentProduct): boolean => item.product_id !== productId)
}

export function validatePaymentProductForm(input: PaymentProductFormValidationInput): Record<string, string> {
	const errors: Record<string, string> = {}
	if (input.productId.trim() === '') errors['productId'] = 'Product ID is required'
	if (input.providerProductId.trim() === '') errors['providerProductId'] = 'Provider product ID is required'
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
	return errors
}

function isPositiveCreditAmount(value: string): boolean {
	if (!/^\d+(?:\.\d{1,6})?$/.test(value)) return false
	const [whole = '', fraction = '']: string[] = value.split('.')
	const units: number = Number(whole) * 1_000_000 + Number(fraction.padEnd(6, '0'))
	return Number.isSafeInteger(units) && units > 0
}
