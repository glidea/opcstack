import { createHmac, timingSafeEqual } from 'node:crypto'
import { Creem } from 'creem'
import type { PaymentEnv, PaymentProviderName } from './config'
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

type CreemServerIndex = 0 | 1

export interface CreemClientOptions {
	apiKey: string
	serverIdx: CreemServerIndex
}

type CreemMetadata = Record<string, unknown>

interface CreemProduct {
	id: string
	name: string
	description: string
	price: number
	currency: string
	billingType: 'recurring' | 'onetime'
}

interface CreemCheckout {
	id: string
	requestId?: string
	checkoutUrl?: string
	metadata?: CreemMetadata
	order?: {
		id?: string
		transaction?: string
		amount?: number
		currency?: string
	}
	product?: {
		id?: string
		price?: number
		currency?: string
	}
	subscription?: {
		id?: string
	}
}

interface CreemSubscription {
	id: string
	lastTransactionId?: string
	metadata?: CreemMetadata
	product?: {
		id?: string
		price?: number
		currency?: string
	}
	currentPeriodStartDate?: string
	currentPeriodEndDate?: string
}

type CreemWebhookEvent = {
	id: string
	eventType: string
	created_at: number
	object: Record<string, unknown>
}

export interface CreemClient {
	products: {
		get(productId: string): Promise<CreemProduct>
	}
	checkouts: {
		create(input: {
			requestId: string
			productId: string
			units: number
			customer: { email: string }
			successUrl: string
			metadata: Record<string, string>
		}): Promise<CreemCheckout>
	}
	subscriptions: {
		upgrade(
			subscriptionId: string,
			input: {
				productId: string
				updateBehavior: 'proration-charge-immediately' | 'proration-charge' | 'proration-none'
			}
		): Promise<CreemSubscription>
		cancel(
			subscriptionId: string,
			input: {
				mode: 'immediate' | 'scheduled'
				onExecute: 'cancel' | 'pause'
			}
		): Promise<CreemSubscription>
	}
}

export class CreemPaymentProvider implements PaymentProvider {
	public readonly name: PaymentProviderName = 'creem'
	private readonly client: CreemClient
	private readonly webhookSecret: string

	constructor(client: CreemClient, webhookSecret: string) {
		this.client = client
		this.webhookSecret = webhookSecret
	}

	async listProducts(input: ListProductsInput): Promise<ProviderProduct[]> {
		const products: CreemProduct[] = await Promise.all(
			input.providerProductIds.map((providerProductId: string) => {
				return this.client.products.get(providerProductId)
			})
		)

		return products.map((product: CreemProduct) => {
			return {
				providerProductId: product.id,
				name: product.name,
				description: product.description,
				priceAmount: product.price,
				currency: product.currency,
				billingMode: product.billingType === 'recurring' ? 'subscription' : 'one_time'
			}
		})
	}

	async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
		const checkout: CreemCheckout = await this.client.checkouts.create({
			requestId: input.checkoutOrderId,
			productId: input.providerProductId,
			units: 1,
			customer: {
				email: input.customerEmail
			},
			successUrl: input.returnUrl,
			metadata: {
				checkout_order_id: input.checkoutOrderId
			}
		})

		return {
			providerCheckoutSessionId: checkout.id,
			checkoutUrl: checkout.checkoutUrl ?? ''
		}
	}

	async changeSubscriptionPlan(
		input: ChangeSubscriptionPlanInput
	): Promise<ChangeSubscriptionPlanResult> {
		const subscription: CreemSubscription = await this.client.subscriptions.upgrade(
			input.providerSubscriptionId,
			{
				productId: input.providerProductId,
				updateBehavior: 'proration-charge-immediately'
			}
		)
		return {
			providerPaymentId: subscription.lastTransactionId ?? null
		}
	}

	async cancelSubscription(input: CancelSubscriptionInput): Promise<void> {
		await this.client.subscriptions.cancel(input.providerSubscriptionId, {
			mode: 'scheduled',
			onExecute: 'cancel'
		})
	}

	async unwrapWebhook(input: UnwrapWebhookInput): Promise<PaymentEvent> {
		const signature: string = input.headers.get('creem-signature') ?? ''
		if (!isCreemSignatureValid(input.rawBody, signature, this.webhookSecret)) {
			throw new Error('CREEM_WEBHOOK_SIGNATURE_INVALID')
		}

		const event: CreemWebhookEvent = JSON.parse(input.rawBody) as CreemWebhookEvent
		return mapCreemWebhookEvent(event)
	}
}

export function createCreemPaymentProviderFromEnv(
	env: PaymentEnv,
	createClient: (options: CreemClientOptions) => CreemClient = defaultCreateCreemClient
): CreemPaymentProvider {
	const apiKey: string = env.PAYMENT_CREEM_API_KEY ?? ''
	const webhookSecret: string = env.PAYMENT_CREEM_WEBHOOK_SECRET ?? ''
	const serverIdx: CreemServerIndex = resolveCreemServerIndex(env.PAYMENT_CREEM_TEST_MODE)

	const client: CreemClient = createClient({
		apiKey,
		serverIdx
	})

	return new CreemPaymentProvider(client, webhookSecret)
}

export function resolveCreemServerIndex(rawTestMode: string | undefined): CreemServerIndex {
	return rawTestMode === 'true' ? 1 : 0
}

function defaultCreateCreemClient(options: CreemClientOptions): CreemClient {
	return new Creem({
		apiKey: options.apiKey,
		serverIdx: options.serverIdx
	}) as unknown as CreemClient
}

function isCreemSignatureValid(rawBody: string, signature: string, secret: string): boolean {
	const normalizedSignature: string = signature.trim().toLowerCase()
	const computedSignature: string = createHmac('sha256', secret).update(rawBody).digest('hex')

	if (normalizedSignature.length !== computedSignature.length) {
		return false
	}

	return timingSafeEqual(
		Buffer.from(computedSignature, 'hex'),
		Buffer.from(normalizedSignature, 'hex')
	)
}

function mapCreemWebhookEvent(event: CreemWebhookEvent): PaymentEvent {
	const eventType: PaymentEventType = mapCreemEventType(event.eventType)
	const occurredAt: number = toUnixSecondsFromMillis(event.created_at)
	const object: Record<string, unknown> = event.object
	const webhookId: string = event.id

	if (event.eventType === 'checkout.completed') {
		const checkoutOrderId: string | null =
			readMetadataText(object['metadata'], 'checkout_order_id') ??
			readText(object['request_id']) ??
			null
		const providerSubscriptionId: string | null = readNestedText(object, ['subscription', 'id'])
		const providerPaymentId: string | null =
			readNestedText(object, ['order', 'transaction']) ?? readNestedText(object, ['order', 'id'])
		const amount: number | null =
			readNestedNumber(object, ['order', 'amount']) ?? readNestedNumber(object, ['product', 'price'])
		const currency: string | null =
			readNestedText(object, ['order', 'currency']) ?? readNestedText(object, ['product', 'currency'])

		return {
			provider: 'creem',
			webhookId,
			eventType,
			providerPaymentId,
			providerRefundId: null,
			providerDisputeId: null,
			providerSubscriptionId,
			checkoutOrderId,
			amount,
			currency,
			periodStart: null,
			periodEnd: null,
			occurredAt
		}
	}

	if (event.eventType === 'subscription.paid') {
		const checkoutOrderId: string | null =
			readMetadataText(object['metadata'], 'checkout_order_id') ?? null

		return {
			provider: 'creem',
			webhookId,
			eventType,
			providerPaymentId: readText(object['last_transaction_id']),
			providerRefundId: null,
			providerDisputeId: null,
			providerSubscriptionId: readText(object['id']),
			checkoutOrderId,
			amount: readNestedNumber(object, ['product', 'price']),
			currency: readNestedText(object, ['product', 'currency']),
			periodStart: toUnixSecondsFromDateText(readText(object['current_period_start_date'])),
			periodEnd: toUnixSecondsFromDateText(readText(object['current_period_end_date'])),
			occurredAt
		}
	}

	if (event.eventType === 'refund.created') {
		return {
			provider: 'creem',
			webhookId,
			eventType,
			providerPaymentId: readText(object['transaction']),
			providerRefundId: readText(object['id']),
			providerDisputeId: null,
			providerSubscriptionId: readText(object['subscription']),
			checkoutOrderId: readMetadataText(object['metadata'], 'checkout_order_id'),
			amount: readNumber(object['amount']),
			currency: readText(object['currency']),
			periodStart: null,
			periodEnd: null,
			occurredAt
		}
	}

	if (event.eventType === 'dispute.created') {
		return {
			provider: 'creem',
			webhookId,
			eventType,
			providerPaymentId: readText(object['transaction']),
			providerRefundId: null,
			providerDisputeId: readText(object['id']),
			providerSubscriptionId: readText(object['subscription']),
			checkoutOrderId: readMetadataText(object['metadata'], 'checkout_order_id'),
			amount: readNumber(object['amount']),
			currency: readText(object['currency']),
			periodStart: null,
			periodEnd: null,
			occurredAt
		}
	}

	if (
		event.eventType === 'subscription.canceled' ||
		event.eventType === 'subscription.scheduled_cancel' ||
		event.eventType === 'subscription.past_due' ||
		event.eventType === 'subscription.unpaid' ||
		event.eventType === 'subscription.expired'
	) {
		return {
			provider: 'creem',
			webhookId,
			eventType,
			providerPaymentId: readText(object['last_transaction_id']),
			providerRefundId: null,
			providerDisputeId: null,
			providerSubscriptionId: readText(object['id']),
			checkoutOrderId: readMetadataText(object['metadata'], 'checkout_order_id'),
			amount: readNestedNumber(object, ['product', 'price']),
			currency: readNestedText(object, ['product', 'currency']),
			periodStart: toUnixSecondsFromDateText(readText(object['current_period_start_date'])),
			periodEnd: toUnixSecondsFromDateText(readText(object['current_period_end_date'])),
			occurredAt
		}
	}

	throw new Error('CREEM_EVENT_TYPE_UNSUPPORTED')
}

function mapCreemEventType(rawEventType: string): PaymentEventType {
	if (rawEventType === 'checkout.completed') {
		return 'payment_succeeded'
	}
	if (rawEventType === 'subscription.paid') {
		return 'subscription_paid'
	}
	if (rawEventType === 'refund.created') {
		return 'refund_succeeded'
	}
	if (rawEventType === 'dispute.created') {
		return 'dispute_opened'
	}
	if (rawEventType === 'subscription.canceled' || rawEventType === 'subscription.scheduled_cancel') {
		return 'subscription_cancel_at_period_end'
	}
	if (rawEventType === 'subscription.past_due' || rawEventType === 'subscription.unpaid') {
		return 'subscription_past_due'
	}
	if (rawEventType === 'subscription.expired') {
		return 'subscription_ended'
	}
	throw new Error('CREEM_EVENT_TYPE_UNSUPPORTED')
}

function readMetadataText(value: unknown, key: string): string | null {
	if (typeof value !== 'object' || value === null) {
		return null
	}
	const metadata: Record<string, unknown> = value as Record<string, unknown>
	const field: unknown = metadata[key]
	return readText(field)
}

function readNestedText(value: unknown, path: string[]): string | null {
	let current: unknown = value
	for (const key of path) {
		if (typeof current !== 'object' || current === null) {
			return null
		}
		current = (current as Record<string, unknown>)[key]
	}
	return readText(current)
}

function readNestedNumber(value: unknown, path: string[]): number | null {
	let current: unknown = value
	for (const key of path) {
		if (typeof current !== 'object' || current === null) {
			return null
		}
		current = (current as Record<string, unknown>)[key]
	}
	return readNumber(current)
}

function readText(value: unknown): string | null {
	if (typeof value !== 'string') {
		return null
	}
	return value
}

function readNumber(value: unknown): number | null {
	if (typeof value !== 'number') {
		return null
	}
	return value
}

function toUnixSecondsFromDateText(value: string | null): number | null {
	if (value === null) {
		return null
	}
	return Math.floor(new Date(value).getTime() / 1000)
}

function toUnixSecondsFromMillis(value: number): number {
	return Math.floor(value / 1000)
}
