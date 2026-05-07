import { createHmac, timingSafeEqual } from 'node:crypto'
import { Creem } from 'creem'
import { PAYMENT_PROVIDER_CREEM, type PaymentProviderName } from './config'
import {
	PAYMENT_BILLING_MODE_ONE_TIME,
	PAYMENT_BILLING_MODE_SUBSCRIPTION,
	PAYMENT_EVENT_TYPE_DISPUTE_OPENED,
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

const CREEM_PRODUCTION_SERVER_INDEX = 0
const CREEM_TEST_SERVER_INDEX = 1
const CREEM_BILLING_TYPE_RECURRING = 'recurring'
const CREEM_BILLING_TYPE_ONETIME = 'onetime'
const CREEM_UPDATE_BEHAVIOR_PRORATION_CHARGE_IMMEDIATELY = 'proration-charge-immediately'
const CREEM_CANCEL_MODE_SCHEDULED = 'scheduled'
const CREEM_CANCEL_EXECUTE_CANCEL = 'cancel'
const CREEM_SIGNATURE_HEADER = 'creem-signature'
const CREEM_SIGNATURE_ALGORITHM = 'sha256'
const CREEM_SIGNATURE_ENCODING = 'hex'

const CREEM_EVENT_CHECKOUT_COMPLETED = 'checkout.completed'
const CREEM_EVENT_SUBSCRIPTION_PAID = 'subscription.paid'
const CREEM_EVENT_REFUND_CREATED = 'refund.created'
const CREEM_EVENT_DISPUTE_CREATED = 'dispute.created'
const CREEM_EVENT_SUBSCRIPTION_CANCELED = 'subscription.canceled'
const CREEM_EVENT_SUBSCRIPTION_SCHEDULED_CANCEL = 'subscription.scheduled_cancel'
const CREEM_EVENT_SUBSCRIPTION_PAST_DUE = 'subscription.past_due'
const CREEM_EVENT_SUBSCRIPTION_UNPAID = 'subscription.unpaid'
const CREEM_EVENT_SUBSCRIPTION_EXPIRED = 'subscription.expired'
const CREEM_METADATA_CHECKOUT_ORDER_ID = 'checkout_order_id'
const CREEM_ERROR_EVENT_TYPE_UNSUPPORTED = 'CREEM_EVENT_TYPE_UNSUPPORTED'

type CreemServerIndex = typeof CREEM_PRODUCTION_SERVER_INDEX | typeof CREEM_TEST_SERVER_INDEX

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
	billingType: typeof CREEM_BILLING_TYPE_RECURRING | typeof CREEM_BILLING_TYPE_ONETIME
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
				updateBehavior:
				| typeof CREEM_UPDATE_BEHAVIOR_PRORATION_CHARGE_IMMEDIATELY
				| 'proration-charge'
				| 'proration-none'
			}
		): Promise<CreemSubscription>
		cancel(
			subscriptionId: string,
			input: {
				mode: 'immediate' | typeof CREEM_CANCEL_MODE_SCHEDULED
				onExecute: typeof CREEM_CANCEL_EXECUTE_CANCEL | 'pause'
			}
		): Promise<CreemSubscription>
	}
}

export class CreemPaymentProvider implements PaymentProvider {
	public readonly name: PaymentProviderName = PAYMENT_PROVIDER_CREEM
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
				billingMode:
					product.billingType === CREEM_BILLING_TYPE_RECURRING
						? PAYMENT_BILLING_MODE_SUBSCRIPTION
						: PAYMENT_BILLING_MODE_ONE_TIME
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
				[CREEM_METADATA_CHECKOUT_ORDER_ID]: input.checkoutOrderId
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
				updateBehavior: CREEM_UPDATE_BEHAVIOR_PRORATION_CHARGE_IMMEDIATELY
			}
		)
		return {
			providerPaymentId: subscription.lastTransactionId ?? null
		}
	}

	async cancelSubscription(input: CancelSubscriptionInput): Promise<void> {
		await this.client.subscriptions.cancel(input.providerSubscriptionId, {
			mode: CREEM_CANCEL_MODE_SCHEDULED,
			onExecute: CREEM_CANCEL_EXECUTE_CANCEL
		})
	}

	async unwrapWebhook(input: UnwrapWebhookInput): Promise<PaymentEvent> {
		const signature: string = input.headers.get(CREEM_SIGNATURE_HEADER) ?? ''
		if (!isCreemSignatureValid(input.rawBody, signature, this.webhookSecret)) {
			throw new Error('CREEM_WEBHOOK_SIGNATURE_INVALID')
		}

		const event: CreemWebhookEvent = JSON.parse(input.rawBody) as CreemWebhookEvent
		return mapCreemWebhookEvent(event)
	}
}

export function newCreemPayment(
	env: Env,
	createClient: (options: CreemClientOptions) => CreemClient = defaultCreateCreemClient
): CreemPaymentProvider {
	const apiKey: string = env.PAYMENT_CREEM_API_KEY
	const webhookSecret: string = env.PAYMENT_CREEM_WEBHOOK_SECRET
	const serverIdx: CreemServerIndex = resolveCreemServerIndex(env.PAYMENT_CREEM_TEST_MODE)

	const client: CreemClient = createClient({
		apiKey,
		serverIdx
	})

	return new CreemPaymentProvider(client, webhookSecret)
}

export function resolveCreemServerIndex(rawTestMode: string | undefined): CreemServerIndex {
	return rawTestMode === 'true' ? CREEM_TEST_SERVER_INDEX : CREEM_PRODUCTION_SERVER_INDEX
}

function defaultCreateCreemClient(options: CreemClientOptions): CreemClient {
	return new Creem({
		apiKey: options.apiKey,
		serverIdx: options.serverIdx
	}) as unknown as CreemClient
}

function isCreemSignatureValid(rawBody: string, signature: string, secret: string): boolean {
	const normalizedSignature: string = signature.trim().toLowerCase()
	const computedSignature: string = createHmac(CREEM_SIGNATURE_ALGORITHM, secret)
		.update(rawBody)
		.digest(CREEM_SIGNATURE_ENCODING)

	if (normalizedSignature.length !== computedSignature.length) {
		return false
	}

	return timingSafeEqual(
		Buffer.from(computedSignature, CREEM_SIGNATURE_ENCODING),
		Buffer.from(normalizedSignature, CREEM_SIGNATURE_ENCODING)
	)
}

function mapCreemWebhookEvent(event: CreemWebhookEvent): PaymentEvent {
	const eventType: PaymentEventType = mapCreemEventType(event.eventType)
	const occurredAt: number = toUnixSecondsFromMillis(event.created_at)
	const object: Record<string, unknown> = event.object
	const webhookId: string = event.id

	switch (event.eventType) {
		case CREEM_EVENT_CHECKOUT_COMPLETED: {
			const checkoutOrderId: string | null =
				readMetadataText(object['metadata'], CREEM_METADATA_CHECKOUT_ORDER_ID) ??
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
				provider: PAYMENT_PROVIDER_CREEM,
				webhookId,
				type: eventType,
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
		case CREEM_EVENT_SUBSCRIPTION_PAID: {
			const checkoutOrderId: string | null =
				readMetadataText(object['metadata'], CREEM_METADATA_CHECKOUT_ORDER_ID) ?? null

			return {
				provider: PAYMENT_PROVIDER_CREEM,
				webhookId,
				type: eventType,
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
		case CREEM_EVENT_REFUND_CREATED:
			return {
				provider: PAYMENT_PROVIDER_CREEM,
				webhookId,
				type: eventType,
				providerPaymentId: readText(object['transaction']),
				providerRefundId: readText(object['id']),
				providerDisputeId: null,
				providerSubscriptionId: readText(object['subscription']),
				checkoutOrderId: readMetadataText(object['metadata'], CREEM_METADATA_CHECKOUT_ORDER_ID),
				amount: readNumber(object['amount']),
				currency: readText(object['currency']),
				periodStart: null,
				periodEnd: null,
				occurredAt
			}
		case CREEM_EVENT_DISPUTE_CREATED:
			return {
				provider: PAYMENT_PROVIDER_CREEM,
				webhookId,
				type: eventType,
				providerPaymentId: readText(object['transaction']),
				providerRefundId: null,
				providerDisputeId: readText(object['id']),
				providerSubscriptionId: readText(object['subscription']),
				checkoutOrderId: readMetadataText(object['metadata'], CREEM_METADATA_CHECKOUT_ORDER_ID),
				amount: readNumber(object['amount']),
				currency: readText(object['currency']),
				periodStart: null,
				periodEnd: null,
				occurredAt
			}
		case CREEM_EVENT_SUBSCRIPTION_CANCELED:
		case CREEM_EVENT_SUBSCRIPTION_SCHEDULED_CANCEL:
		case CREEM_EVENT_SUBSCRIPTION_PAST_DUE:
		case CREEM_EVENT_SUBSCRIPTION_UNPAID:
		case CREEM_EVENT_SUBSCRIPTION_EXPIRED:
			return {
				provider: PAYMENT_PROVIDER_CREEM,
				webhookId,
				type: eventType,
				providerPaymentId: readText(object['last_transaction_id']),
				providerRefundId: null,
				providerDisputeId: null,
				providerSubscriptionId: readText(object['id']),
				checkoutOrderId: readMetadataText(object['metadata'], CREEM_METADATA_CHECKOUT_ORDER_ID),
				amount: readNestedNumber(object, ['product', 'price']),
				currency: readNestedText(object, ['product', 'currency']),
				periodStart: toUnixSecondsFromDateText(readText(object['current_period_start_date'])),
				periodEnd: toUnixSecondsFromDateText(readText(object['current_period_end_date'])),
				occurredAt
			}
		default:
			throw new Error(CREEM_ERROR_EVENT_TYPE_UNSUPPORTED)
	}
}

function mapCreemEventType(rawEventType: string): PaymentEventType {
	switch (rawEventType) {
		case CREEM_EVENT_CHECKOUT_COMPLETED:
			return PAYMENT_EVENT_TYPE_PAYMENT_SUCCEEDED
		case CREEM_EVENT_SUBSCRIPTION_PAID:
			return PAYMENT_EVENT_TYPE_SUBSCRIPTION_PAID
		case CREEM_EVENT_REFUND_CREATED:
			return PAYMENT_EVENT_TYPE_REFUND_SUCCEEDED
		case CREEM_EVENT_DISPUTE_CREATED:
			return PAYMENT_EVENT_TYPE_DISPUTE_OPENED
		case CREEM_EVENT_SUBSCRIPTION_CANCELED:
		case CREEM_EVENT_SUBSCRIPTION_SCHEDULED_CANCEL:
			return PAYMENT_EVENT_TYPE_SUBSCRIPTION_CANCEL_AT_PERIOD_END
		case CREEM_EVENT_SUBSCRIPTION_PAST_DUE:
		case CREEM_EVENT_SUBSCRIPTION_UNPAID:
			return PAYMENT_EVENT_TYPE_SUBSCRIPTION_PAST_DUE
		case CREEM_EVENT_SUBSCRIPTION_EXPIRED:
			return PAYMENT_EVENT_TYPE_SUBSCRIPTION_ENDED
		default:
			throw new Error(CREEM_ERROR_EVENT_TYPE_UNSUPPORTED)
	}
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
