import DodoPayments from 'dodopayments'
import type { PaymentProviderName } from './config'
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
} from './provider'

type DodoEnvironment = 'live_mode' | 'test_mode'

export interface DodoClientOptions {
	bearerToken: string
	webhookKey: string
	environment: DodoEnvironment
}

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
					| 'prorated_immediately'
					| 'full_immediately'
					| 'difference_immediately'
					| 'do_not_bill'
				quantity: number
				on_payment_failure: 'prevent_change' | 'apply_change'
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
	public readonly name: PaymentProviderName = 'dodo'
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
				billingMode: product.is_recurring ? 'subscription' : 'one_time'
			}
		})
	}

	async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
		const session: DodoCheckoutSessionResponse = await this.client.checkoutSessions.create({
			product_cart: [{ product_id: input.providerProductId, quantity: 1 }],
			customer: { email: input.customerEmail },
			return_url: input.returnUrl,
			metadata: {
				checkout_order_id: input.checkoutOrderId
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
			proration_billing_mode: 'prorated_immediately',
			quantity: 1,
			on_payment_failure: 'prevent_change',
			metadata: {
				checkout_order_id: input.checkoutOrderId
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

export function createDodoPaymentProviderFromEnv(
	env: Record<string, string | undefined>,
	createClient: (options: DodoClientOptions) => DodoClient = defaultCreateDodoClient
): DodoPaymentProvider {
	const bearerToken: string = env['PAYMENT_DODO_API_KEY'] ?? ''
	const webhookKey: string = env['PAYMENT_DODO_WEBHOOK_SECRET'] ?? ''
	const environment: DodoEnvironment = resolveDodoEnvironment(env['PAYMENT_DODO_TEST_MODE'])

	const client: DodoClient = createClient({
		bearerToken,
		webhookKey,
		environment
	})

	return new DodoPaymentProvider(client, webhookKey)
}

export function resolveDodoEnvironment(rawTestMode: string | undefined): DodoEnvironment {
	return rawTestMode === 'true' ? 'test_mode' : 'live_mode'
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
	if (product.price.type === 'usage_based_price') {
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

	if (event.type === 'payment.succeeded' || event.type === 'payment.failed') {
		return {
			provider: 'dodo',
			webhookId,
			eventType,
			providerPaymentId: event.data.payment_id,
			providerRefundId: null,
			providerDisputeId: null,
			providerSubscriptionId: event.data.subscription_id ?? null,
			checkoutOrderId: event.data.metadata['checkout_order_id'] ?? null,
			amount: event.data.total_amount,
			currency: event.data.currency,
			periodStart: null,
			periodEnd: null,
			occurredAt
		}
	}

	if (event.type === 'refund.succeeded') {
		return {
			provider: 'dodo',
			webhookId,
			eventType,
			providerPaymentId: event.data.payment_id,
			providerRefundId: event.data.refund_id,
			providerDisputeId: null,
			providerSubscriptionId: null,
			checkoutOrderId: event.data.metadata['checkout_order_id'] ?? null,
			amount: event.data.amount ?? null,
			currency: event.data.currency ?? null,
			periodStart: null,
			periodEnd: null,
			occurredAt
		}
	}

	if (event.type === 'dispute.opened') {
		return {
			provider: 'dodo',
			webhookId,
			eventType,
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
	}

	if (
		event.type === 'subscription.active' ||
		event.type === 'subscription.renewed' ||
		event.type === 'subscription.cancelled' ||
		event.type === 'subscription.failed' ||
		event.type === 'subscription.expired'
	) {
		return {
			provider: 'dodo',
			webhookId,
			eventType,
			providerPaymentId: null,
			providerRefundId: null,
			providerDisputeId: null,
			providerSubscriptionId: event.data.subscription_id,
			checkoutOrderId: event.data.metadata['checkout_order_id'] ?? null,
			amount: event.data.recurring_pre_tax_amount,
			currency: event.data.currency,
			periodStart: toUnixSeconds(event.data.previous_billing_date),
			periodEnd: toUnixSeconds(event.data.next_billing_date),
			occurredAt
		}
	}

	throw new Error('DODO_EVENT_TYPE_UNSUPPORTED')
}

function mapDodoEventType(rawEventType: DodoWebhookEvent['type']): PaymentEventType {
	if (rawEventType === 'payment.succeeded') {
		return 'payment_succeeded'
	}
	if (rawEventType === 'payment.failed') {
		return 'payment_failed'
	}
	if (rawEventType === 'refund.succeeded') {
		return 'refund_succeeded'
	}
	if (rawEventType === 'dispute.opened') {
		return 'dispute_opened'
	}
	if (rawEventType === 'subscription.active' || rawEventType === 'subscription.renewed') {
		return 'subscription_paid'
	}
	if (rawEventType === 'subscription.cancelled') {
		return 'subscription_cancel_at_period_end'
	}
	if (rawEventType === 'subscription.failed') {
		return 'subscription_past_due'
	}
	if (rawEventType === 'subscription.expired') {
		return 'subscription_ended'
	}
	throw new Error('DODO_EVENT_TYPE_UNSUPPORTED')
}

function buildDodoWebhookId(event: DodoWebhookEvent): string {
	if (event.type === 'payment.succeeded' || event.type === 'payment.failed') {
		return `${event.type}:${event.data.payment_id}:${event.timestamp}`
	}
	if (event.type === 'refund.succeeded') {
		return `${event.type}:${event.data.refund_id}:${event.timestamp}`
	}
	if (event.type === 'dispute.opened') {
		return `${event.type}:${event.data.dispute_id}:${event.timestamp}`
	}
	if (
		event.type === 'subscription.active' ||
		event.type === 'subscription.renewed' ||
		event.type === 'subscription.cancelled' ||
		event.type === 'subscription.failed' ||
		event.type === 'subscription.expired'
	) {
		return `${event.type}:${event.data.subscription_id}:${event.timestamp}`
	}
	throw new Error('DODO_EVENT_TYPE_UNSUPPORTED')
}

function toUnixSeconds(raw: string): number {
	return Math.floor(new Date(raw).getTime() / 1000)
}
