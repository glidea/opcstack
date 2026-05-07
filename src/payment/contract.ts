import type { PaymentProviderName } from './config'

export const PAYMENT_BILLING_MODE_ONE_TIME = 'one_time'
export const PAYMENT_BILLING_MODE_SUBSCRIPTION = 'subscription'

export const PAYMENT_EVENT_TYPE_PAYMENT_SUCCEEDED = 'payment_succeeded'
export const PAYMENT_EVENT_TYPE_PAYMENT_FAILED = 'payment_failed'
export const PAYMENT_EVENT_TYPE_REFUND_SUCCEEDED = 'refund_succeeded'
export const PAYMENT_EVENT_TYPE_DISPUTE_OPENED = 'dispute_opened'
export const PAYMENT_EVENT_TYPE_SUBSCRIPTION_PAID = 'subscription_paid'
export const PAYMENT_EVENT_TYPE_SUBSCRIPTION_CANCEL_AT_PERIOD_END =
	'subscription_cancel_at_period_end'
export const PAYMENT_EVENT_TYPE_SUBSCRIPTION_PAST_DUE = 'subscription_past_due'
export const PAYMENT_EVENT_TYPE_SUBSCRIPTION_ENDED = 'subscription_ended'

export type PaymentBillingMode =
	| typeof PAYMENT_BILLING_MODE_ONE_TIME
	| typeof PAYMENT_BILLING_MODE_SUBSCRIPTION

export type PaymentEventType =
	| typeof PAYMENT_EVENT_TYPE_PAYMENT_SUCCEEDED
	| typeof PAYMENT_EVENT_TYPE_PAYMENT_FAILED
	| typeof PAYMENT_EVENT_TYPE_REFUND_SUCCEEDED
	| typeof PAYMENT_EVENT_TYPE_DISPUTE_OPENED
	| typeof PAYMENT_EVENT_TYPE_SUBSCRIPTION_PAID
	| typeof PAYMENT_EVENT_TYPE_SUBSCRIPTION_CANCEL_AT_PERIOD_END
	| typeof PAYMENT_EVENT_TYPE_SUBSCRIPTION_PAST_DUE
	| typeof PAYMENT_EVENT_TYPE_SUBSCRIPTION_ENDED

export interface PaymentProvider {
	readonly name: PaymentProviderName

	listProducts(input: ListProductsInput): Promise<ProviderProduct[]>
	createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>
	changeSubscriptionPlan(input: ChangeSubscriptionPlanInput): Promise<ChangeSubscriptionPlanResult>
	cancelSubscription(input: CancelSubscriptionInput): Promise<void>
	unwrapWebhook(input: UnwrapWebhookInput): Promise<PaymentEvent>
}

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

export interface PaymentEvent {
	provider: PaymentProviderName
	webhookId: string
	type: PaymentEventType
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
