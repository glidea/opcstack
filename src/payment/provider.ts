import type { PaymentProviderName } from './config'

export type PaymentBillingMode = 'one_time' | 'subscription'

export interface ListProductsInput {
	providerProductIds: string[]
}

export interface ProviderProduct {
	providerProductId: string
	name: string
	description: string | null
	priceAmount: number
	currency: string
	billingMode: PaymentBillingMode
}

export interface CreateCheckoutInput {
	checkoutOrderId: string
	providerProductId: string
	customerEmail: string
	returnUrl: string
}

export interface CreateCheckoutResult {
	providerCheckoutSessionId: string
	checkoutUrl: string
}

export interface ChangeSubscriptionPlanInput {
	checkoutOrderId: string
	providerSubscriptionId: string
	providerProductId: string
}

export interface ChangeSubscriptionPlanResult {
	providerPaymentId: string | null
}

export interface CancelSubscriptionInput {
	providerSubscriptionId: string
}

export interface UnwrapWebhookInput {
	rawBody: string
	headers: Headers
}

export type PaymentEventType =
	| 'payment_succeeded'
	| 'payment_failed'
	| 'refund_succeeded'
	| 'dispute_opened'
	| 'subscription_paid'
	| 'subscription_cancel_at_period_end'
	| 'subscription_past_due'
	| 'subscription_ended'

export interface PaymentEvent {
	provider: PaymentProviderName
	webhookId: string
	eventType: PaymentEventType
	providerPaymentId: string | null
	providerRefundId: string | null
	providerDisputeId: string | null
	providerSubscriptionId: string | null
	checkoutOrderId: string | null
	amount: number | null
	currency: string | null
	periodStart: number | null
	periodEnd: number | null
	occurredAt: number
}

export interface PaymentProvider {
	readonly name: PaymentProviderName

	listProducts(input: ListProductsInput): Promise<ProviderProduct[]>
	createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>
	changeSubscriptionPlan(input: ChangeSubscriptionPlanInput): Promise<ChangeSubscriptionPlanResult>
	cancelSubscription(input: CancelSubscriptionInput): Promise<void>
	unwrapWebhook(input: UnwrapWebhookInput): Promise<PaymentEvent>
}
