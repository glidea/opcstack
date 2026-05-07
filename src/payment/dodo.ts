import DodoPayments from 'dodopayments'
import { PAYMENT_PROVIDER_DODO, type PaymentProviderName } from './config'
import {
	PAYMENT_BILLING_MODE_ONE_TIME,
	PAYMENT_BILLING_MODE_SUBSCRIPTION,
	PAYMENT_EVENT_TYPE_DISPUTE_OPENED,
	PAYMENT_EVENT_TYPE_PAYMENT_FAILED,
	PAYMENT_EVENT_TYPE_PAYMENT_SUCCEEDED,
	PAYMENT_EVENT_TYPE_REFUND_SUCCEEDED,
	PAYMENT_EVENT_TYPE_SUBSCRIPTION_CANCEL_AT_PERIOD_END,
	PAYMENT_EVENT_TYPE_SUBSCRIPTION_ENDED,
	PAYMENT_EVENT_TYPE_SUBSCRIPTION_PAID,
	PAYMENT_EVENT_TYPE_SUBSCRIPTION_PAST_DUE
} from './contract'
import type {
	CancelSubscriptionInput,
	ChangeSubscriptionPlanInput,
	ChangeSubscriptionPlanResult,
	CreateCheckoutInput,
	CreateCheckoutResult,
	ListProductsInput,
	PaymentEvent,
	PaymentEventType,
	PaymentProvider,
	ProviderProduct,
	UnwrapWebhookInput
} from './contract'

const DODO_ENV_LIVE_MODE = 'live_mode'
const DODO_ENV_TEST_MODE = 'test_mode'
const DODO_PRORATION_BILLING_MODE_PRORATED_IMMEDIATELY = 'prorated_immediately'
const DODO_ON_PAYMENT_FAILURE_PREVENT_CHANGE = 'prevent_change'
const DODO_PRICE_TYPE_USAGE_BASED = 'usage_based_price'

const DODO_EVENT_PAYMENT_SUCCEEDED = 'payment.succeeded'
const DODO_EVENT_PAYMENT_FAILED = 'payment.failed'
const DODO_EVENT_REFUND_SUCCEEDED = 'refund.succeeded'
const DODO_EVENT_DISPUTE_OPENED = 'dispute.opened'
const DODO_EVENT_SUBSCRIPTION_ACTIVE = 'subscription.active'
const DODO_EVENT_SUBSCRIPTION_RENEWED = 'subscription.renewed'
const DODO_EVENT_SUBSCRIPTION_CANCELLED = 'subscription.cancelled'
const DODO_EVENT_SUBSCRIPTION_FAILED = 'subscription.failed'
const DODO_EVENT_SUBSCRIPTION_EXPIRED = 'subscription.expired'
const DODO_METADATA_CHECKOUT_ORDER_ID = 'checkout_order_id'
const DODO_ERROR_EVENT_TYPE_UNSUPPORTED = 'DODO_EVENT_TYPE_UNSUPPORTED'

export interface DodoClientOptions {
	bearerToken: string
	webhookKey: string
	environment: DodoEnvironment
}

type DodoEnvironment = typeof DODO_ENV_LIVE_MODE | typeof DODO_ENV_TEST_MODE
type DodoProduct = DodoPayments.Product
type DodoCheckoutSessionResponse = DodoPayments.CheckoutSessionResponse
type DodoSubscription = DodoPayments.Subscription
type DodoWebhookEvent = DodoPayments.UnwrapWebhookEvent

export interface DodoClient {
	products: {
		retrieve(productId: string): Promise<DodoProduct>
	}
	checkoutSessions: {
		create(input: {
			product_cart: Array<{ product_id: string; quantity: number }>
			customer: { email: string }
			return_url: string
			metadata: Record<string, string>
		}): Promise<DodoCheckoutSessionResponse>
	}
	subscriptions: {
		changePlan(
			subscriptionId: string,
			input: {
				product_id: string
				proration_billing_mode:
				| typeof DODO_PRORATION_BILLING_MODE_PRORATED_IMMEDIATELY
				| 'full_immediately'
				| 'difference_immediately'
				| 'do_not_bill'
				quantity: number
				on_payment_failure: typeof DODO_ON_PAYMENT_FAILURE_PREVENT_CHANGE | 'apply_change'
				metadata: Record<string, string>
			}
		): Promise<void>
		update(
			subscriptionId: string,
			input: {
				cancel_at_next_billing_date: boolean
			}
		): Promise<DodoSubscription>
	}
	webhooks: {
		unwrap(
			body: string,
			input: {
				headers: Record<string, string>
				key: string
			}
		): DodoWebhookEvent
	}
}

export class DodoPaymentProvider implements PaymentProvider {
	public readonly name: PaymentProviderName = PAYMENT_PROVIDER_DODO
	private readonly client: DodoClient
	private readonly webhookSecret: string

	constructor(client: DodoClient, webhookSecret: string) {
		this.client = client
		this.webhookSecret = webhookSecret
	}

	async listProducts(input: ListProductsInput): Promise<ProviderProduct[]> {
		const products: DodoProduct[] = await Promise.all(
			input.providerProductIds.map((providerProductId: string) => {
				return this.client.products.retrieve(providerProductId)
			})
		)

		return products.map((product: DodoProduct) => {
			const priceAmount: number = toDodoPriceAmount(product)
			const currency: string = toDodoCurrency(product)
			return {
				providerProductId: product.product_id,
				name: product.name ?? '',
				description: product.description ?? null,
				priceAmount,
				currency,
				billingMode: product.is_recurring
					? PAYMENT_BILLING_MODE_SUBSCRIPTION
					: PAYMENT_BILLING_MODE_ONE_TIME
			}
		})
	}

	async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
		const session: DodoCheckoutSessionResponse = await this.client.checkoutSessions.create({
			product_cart: [{ product_id: input.providerProductId, quantity: 1 }],
			customer: { email: input.customerEmail },
			return_url: input.returnUrl,
			metadata: {
				[DODO_METADATA_CHECKOUT_ORDER_ID]: input.checkoutOrderId
			}
		})

		return {
			providerCheckoutSessionId: session.session_id,
			checkoutUrl: session.checkout_url ?? ''
		}
	}

	async changeSubscriptionPlan(
		input: ChangeSubscriptionPlanInput
	): Promise<ChangeSubscriptionPlanResult> {
		await this.client.subscriptions.changePlan(input.providerSubscriptionId, {
			product_id: input.providerProductId,
			proration_billing_mode: DODO_PRORATION_BILLING_MODE_PRORATED_IMMEDIATELY,
			quantity: 1,
			on_payment_failure: DODO_ON_PAYMENT_FAILURE_PREVENT_CHANGE,
			metadata: {
				[DODO_METADATA_CHECKOUT_ORDER_ID]: input.checkoutOrderId
			}
		})

		return {
			providerPaymentId: null
		}
	}

	async cancelSubscription(input: CancelSubscriptionInput): Promise<void> {
		await this.client.subscriptions.update(input.providerSubscriptionId, {
			cancel_at_next_billing_date: true
		})
	}

	async unwrapWebhook(input: UnwrapWebhookInput): Promise<PaymentEvent> {
		const webhookEvent: DodoWebhookEvent = this.client.webhooks.unwrap(input.rawBody, {
			headers: toRecordHeaders(input.headers),
			key: this.webhookSecret
		})
		return mapDodoWebhookEvent(webhookEvent)
	}
}

export function newDodoPayment(
	env: Env,
	createClient: (options: DodoClientOptions) => DodoClient = defaultCreateDodoClient
): DodoPaymentProvider {
	const bearerToken: string = env.PAYMENT_DODO_API_KEY
	const webhookKey: string = env.PAYMENT_DODO_WEBHOOK_SECRET
	const environment: DodoEnvironment = resolveDodoEnvironment(env.PAYMENT_DODO_TEST_MODE)

	const client: DodoClient = createClient({
		bearerToken,
		webhookKey,
		environment
	})

	return new DodoPaymentProvider(client, webhookKey)
}

export function resolveDodoEnvironment(rawTestMode: string | undefined): DodoEnvironment {
	return rawTestMode === 'true' ? DODO_ENV_TEST_MODE : DODO_ENV_LIVE_MODE
}

function defaultCreateDodoClient(options: DodoClientOptions): DodoClient {
	return new DodoPayments({
		bearerToken: options.bearerToken,
		webhookKey: options.webhookKey,
		environment: options.environment
	}) as unknown as DodoClient
}

function toRecordHeaders(headers: Headers): Record<string, string> {
	const result: Record<string, string> = {}
	headers.forEach((value: string, key: string) => {
		result[key] = value
	})
	return result
}

function toDodoPriceAmount(product: DodoProduct): number {
	if (product.price.type === DODO_PRICE_TYPE_USAGE_BASED) {
		return product.price.fixed_price
	}
	return product.price.price
}

function toDodoCurrency(product: DodoProduct): string {
	return product.price.currency
}

function mapDodoWebhookEvent(event: DodoWebhookEvent): PaymentEvent {
	const eventType: PaymentEventType = mapDodoEventType(event.type)
	const webhookId: string = buildDodoWebhookId(event)
	const occurredAt: number = toUnixSeconds(event.timestamp)

	switch (event.type) {
		case DODO_EVENT_PAYMENT_SUCCEEDED:
		case DODO_EVENT_PAYMENT_FAILED:
			return {
				provider: PAYMENT_PROVIDER_DODO,
				webhookId,
				type: eventType,
				providerPaymentId: event.data.payment_id,
				providerRefundId: null,
				providerDisputeId: null,
				providerSubscriptionId: event.data.subscription_id ?? null,
				checkoutOrderId: event.data.metadata[DODO_METADATA_CHECKOUT_ORDER_ID] ?? null,
				amount: event.data.total_amount,
				currency: event.data.currency,
				periodStart: null,
				periodEnd: null,
				occurredAt
			}
		case DODO_EVENT_REFUND_SUCCEEDED:
			return {
				provider: PAYMENT_PROVIDER_DODO,
				webhookId,
				type: eventType,
				providerPaymentId: event.data.payment_id,
				providerRefundId: event.data.refund_id,
				providerDisputeId: null,
				providerSubscriptionId: null,
				checkoutOrderId: event.data.metadata[DODO_METADATA_CHECKOUT_ORDER_ID] ?? null,
				amount: event.data.amount ?? null,
				currency: event.data.currency ?? null,
				periodStart: null,
				periodEnd: null,
				occurredAt
			}
		case DODO_EVENT_DISPUTE_OPENED:
			return {
				provider: PAYMENT_PROVIDER_DODO,
				webhookId,
				type: eventType,
				providerPaymentId: event.data.payment_id,
				providerRefundId: null,
				providerDisputeId: event.data.dispute_id,
				providerSubscriptionId: null,
				checkoutOrderId: null,
				amount: Number(event.data.amount),
				currency: event.data.currency,
				periodStart: null,
				periodEnd: null,
				occurredAt
			}
		case DODO_EVENT_SUBSCRIPTION_ACTIVE:
		case DODO_EVENT_SUBSCRIPTION_RENEWED:
		case DODO_EVENT_SUBSCRIPTION_CANCELLED:
		case DODO_EVENT_SUBSCRIPTION_FAILED:
		case DODO_EVENT_SUBSCRIPTION_EXPIRED:
			return {
				provider: PAYMENT_PROVIDER_DODO,
				webhookId,
				type: eventType,
				providerPaymentId: null,
				providerRefundId: null,
				providerDisputeId: null,
				providerSubscriptionId: event.data.subscription_id,
				checkoutOrderId: event.data.metadata[DODO_METADATA_CHECKOUT_ORDER_ID] ?? null,
				amount: event.data.recurring_pre_tax_amount,
				currency: event.data.currency,
				periodStart: toUnixSeconds(event.data.previous_billing_date),
				periodEnd: toUnixSeconds(event.data.next_billing_date),
				occurredAt
			}
		default:
			throw new Error(DODO_ERROR_EVENT_TYPE_UNSUPPORTED)
	}
}

function mapDodoEventType(rawEventType: DodoWebhookEvent['type']): PaymentEventType {
	switch (rawEventType) {
		case DODO_EVENT_PAYMENT_SUCCEEDED:
			return PAYMENT_EVENT_TYPE_PAYMENT_SUCCEEDED
		case DODO_EVENT_PAYMENT_FAILED:
			return PAYMENT_EVENT_TYPE_PAYMENT_FAILED
		case DODO_EVENT_REFUND_SUCCEEDED:
			return PAYMENT_EVENT_TYPE_REFUND_SUCCEEDED
		case DODO_EVENT_DISPUTE_OPENED:
			return PAYMENT_EVENT_TYPE_DISPUTE_OPENED
		case DODO_EVENT_SUBSCRIPTION_ACTIVE:
		case DODO_EVENT_SUBSCRIPTION_RENEWED:
			return PAYMENT_EVENT_TYPE_SUBSCRIPTION_PAID
		case DODO_EVENT_SUBSCRIPTION_CANCELLED:
			return PAYMENT_EVENT_TYPE_SUBSCRIPTION_CANCEL_AT_PERIOD_END
		case DODO_EVENT_SUBSCRIPTION_FAILED:
			return PAYMENT_EVENT_TYPE_SUBSCRIPTION_PAST_DUE
		case DODO_EVENT_SUBSCRIPTION_EXPIRED:
			return PAYMENT_EVENT_TYPE_SUBSCRIPTION_ENDED
		default:
			throw new Error(DODO_ERROR_EVENT_TYPE_UNSUPPORTED)
	}
}

function buildDodoWebhookId(event: DodoWebhookEvent): string {
	switch (event.type) {
		case DODO_EVENT_PAYMENT_SUCCEEDED:
		case DODO_EVENT_PAYMENT_FAILED:
			return `${event.type}:${event.data.payment_id}:${event.timestamp}`
		case DODO_EVENT_REFUND_SUCCEEDED:
			return `${event.type}:${event.data.refund_id}:${event.timestamp}`
		case DODO_EVENT_DISPUTE_OPENED:
			return `${event.type}:${event.data.dispute_id}:${event.timestamp}`
		case DODO_EVENT_SUBSCRIPTION_ACTIVE:
		case DODO_EVENT_SUBSCRIPTION_RENEWED:
		case DODO_EVENT_SUBSCRIPTION_CANCELLED:
		case DODO_EVENT_SUBSCRIPTION_FAILED:
		case DODO_EVENT_SUBSCRIPTION_EXPIRED:
			return `${event.type}:${event.data.subscription_id}:${event.timestamp}`
		default:
			throw new Error(DODO_ERROR_EVENT_TYPE_UNSUPPORTED)
	}
}

function toUnixSeconds(raw: string): number {
	return Math.floor(new Date(raw).getTime() / 1000)
}
