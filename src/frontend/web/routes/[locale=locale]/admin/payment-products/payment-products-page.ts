import type {
	ListRemotePaymentProductsResponse,
	PaymentProduct,
	RemotePaymentProduct
} from '$apiContract/configuration'

export type PaymentProductFormValidationInput = {
	type: 'one_time' | 'subscription'
	creditsAmount: string
	subscriptionPlan: string
	upgradeRank: string
	periodCreditsAmount: string
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

export function findRemotePaymentProduct(
	product: PaymentProduct,
	catalog: ListRemotePaymentProductsResponse | undefined
): RemotePaymentProduct | undefined {
	if (catalog === undefined) return undefined
	if ((catalog.environment === 'test') !== product.test_mode) return undefined
	return catalog.items.find((item: RemotePaymentProduct): boolean => {
		return item.provider_product_id === product.provider_product_id
	})
}

function isPositiveCreditAmount(value: string): boolean {
	if (!/^\d+(?:\.\d{1,6})?$/.test(value)) return false
	const [whole = '', fraction = '']: string[] = value.split('.')
	const units: number = Number(whole) * 1_000_000 + Number(fraction.padEnd(6, '0'))
	return Number.isSafeInteger(units) && units > 0
}
