import { and, desc, eq, sql, type SQL } from 'drizzle-orm'
import type { AppDb } from '../db'
import { checkoutOrder, paymentTransaction, paymentWebhookEvent, userSubscription } from '../db/schema'
import { user } from '../db/schema.auth'
import {
	CREDIT_TRANSACTION_TYPE_PAYMENT_PURCHASE,
	CREDIT_TRANSACTION_TYPE_PAYMENT_REFUND,
	CreditsService
} from '../credits'
import {
	parsePaymentConfig,
	PaymentProviderRouter,
	type PaymentConfig,
	type PaymentProductConfig,
	type PaymentProviderName
} from './config'
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
	PAYMENT_EVENT_TYPE_SUBSCRIPTION_PAST_DUE,
	type PaymentBillingMode,
	type PaymentEvent,
	type PaymentProvider
} from './contract'
import { logInfo, logWarn } from '../lib/log'
import { newDodoPayment } from './dodo'
import { newCreemPayment } from './creem'

export * from './config'
export * from './contract'
export * from './dodo'
export * from './creem'

const CHECKOUT_ORDER_TYPE_CREDITS_PURCHASE = 'credits_purchase'
const CHECKOUT_ORDER_TYPE_SUBSCRIPTION_INITIAL = 'subscription_initial'
const CHECKOUT_ORDER_TYPE_SUBSCRIPTION_UPGRADE = 'subscription_upgrade'
const CHECKOUT_ORDER_STATUS_PENDING = 'pending'
const CHECKOUT_ORDER_STATUS_COMPLETED = 'completed'
const CHECKOUT_ORDER_STATUS_FAILED = 'failed'

const PAYMENT_TRANSACTION_TYPE_CREDITS_PURCHASE = 'credits_purchase'
const PAYMENT_TRANSACTION_TYPE_SUBSCRIPTION_INITIAL = 'subscription_initial'
const PAYMENT_TRANSACTION_TYPE_SUBSCRIPTION_UPGRADE = 'subscription_upgrade'
const PAYMENT_TRANSACTION_TYPE_SUBSCRIPTION_RENEWAL = 'subscription_renewal'
const PAYMENT_TRANSACTION_STATUS_PAID = 'paid'
const PAYMENT_TRANSACTION_STATUS_REFUNDED = 'refunded'
const PAYMENT_TRANSACTION_STATUS_DISPUTED = 'disputed'

const SUBSCRIPTION_PLAN_FREE = 'free'
const SUBSCRIPTION_STATUS_ACTIVE = 'active'
const SUBSCRIPTION_STATUS_CANCEL_AT_PERIOD_END = 'cancel_at_period_end'
const SUBSCRIPTION_STATUS_PAST_DUE = 'past_due'

const PAYMENT_CREDIT_SOURCE_TRANSACTION = 'payment_transaction'
const PAYMENT_CREDIT_SOURCE_REFUND = 'payment_refund'

const SUBSCRIPTION_GRACE_MS = 2 * 60 * 60 * 1000
const CHECKOUT_ORDER_ID_PARAM = 'checkout_order_id'

type PaymentTransactionRow = typeof paymentTransaction.$inferSelect
type CheckoutOrderRow = typeof checkoutOrder.$inferSelect

export type PaymentProviderMap = Record<PaymentProviderName, PaymentProvider>

export interface ListPaymentProductsInput {
	country: string | null
}

export interface PaymentProductItem {
	productId: string
	type: PaymentBillingMode
	name: string
	description: string | null
	priceAmount: number
	currency: string
	creditsAmount: number | null
	subscriptionPlan: string | null
	upgradeRank: number | null
	periodCreditsAmount: number | null
}

export interface CreatePaymentCheckoutInput {
	userId: string
	productId: string
	returnPath: string | null
	country: string | null
	appDomain: string
}

export interface CreatePaymentCheckoutResult {
	checkoutOrderId: string
	checkoutUrl: string
}

export interface GetSubscriptionInput {
	userId: string
	nowMs?: number
}

export interface SubscriptionView {
	productId: string
	status: string
	currentPeriodStart: number
	currentPeriodEnd: number
	canceledAt: number | null
}

export interface GetSubscriptionResult {
	subscriptionPlan: string
	subscription: SubscriptionView | null
}

export interface CancelSubscriptionRequest {
	userId: string
	nowMs?: number
}

export interface CancelSubscriptionResult {
	status: string
	currentPeriodEnd: number
	canceledAt: number
}

export interface UpgradeSubscriptionRequest {
	userId: string
	productId: string
	nowMs?: number
}

export interface UpgradeSubscriptionResult {
	status: typeof CHECKOUT_ORDER_STATUS_PENDING
}

export interface ListPaymentTransactionsInput {
	userId: string
	page: number
	pageSize: number
	type?: string
	status?: string
}

export interface ListAdminPaymentTransactionsInput {
	page: number
	pageSize: number
	userId?: string
	type?: string
	status?: string
}

export interface PaymentTransactionItem {
	id: string
	userId: string
	type: string
	status: string
	productId: string
	amount: number
	currency: string
	creditsGranted: number
	paidAt: number | null
	refundedAt: number | null
	disputedAt: number | null
	createdAt: number
}

export interface ListPaymentTransactionsResult {
	items: PaymentTransactionItem[]
	total: number
}

export class PaymentServiceError extends Error {
	public readonly code: string

	constructor(code: string) {
		super(code)
		this.code = code
	}
}

export class PaymentService {
	private readonly db: AppDb
	private readonly config: PaymentConfig
	private readonly providerRouter: PaymentProviderRouter
	private readonly providers: PaymentProviderMap

	constructor(
		db: AppDb,
		config: PaymentConfig,
		providerRouter: PaymentProviderRouter,
		providers: PaymentProviderMap
	) {
		this.db = db
		this.config = config
		this.providerRouter = providerRouter
		this.providers = providers
	}

	async listPaymentProducts(input: ListPaymentProductsInput): Promise<PaymentProductItem[]> {
		if (!this.config.enabled) {
			return []
		}

		const providerName = this.providerRouter.select({
			country: input.country
		})
		const provider = this.getProvider(providerName)
		const providerProductIds: string[] = this.config.products.map((item) => {
			return this.getProviderProductId(item, providerName)
		})

		const providerProducts = await provider.listProducts({
			providerProductIds
		})
		const providerProductById = new Map<string, (typeof providerProducts)[number]>()
		for (const row of providerProducts) {
			providerProductById.set(row.providerProductId, row)
		}

		return this.config.products.map((row) => {
			const providerProductId = this.getProviderProductId(row, providerName)
			const providerProduct = providerProductById.get(providerProductId)
			if (!providerProduct) {
				throw new PaymentServiceError('PAYMENT_PROVIDER_PRODUCT_NOT_FOUND')
			}

			const expectedType: PaymentBillingMode =
				row.subscriptionPlan === null
					? PAYMENT_BILLING_MODE_ONE_TIME
					: PAYMENT_BILLING_MODE_SUBSCRIPTION
			if (providerProduct.billingMode !== expectedType) {
				throw new PaymentServiceError('PAYMENT_PRODUCT_TYPE_MISMATCH')
			}

			return {
				productId: row.productId,
				type: providerProduct.billingMode,
				name: providerProduct.name,
				description: providerProduct.description,
				priceAmount: providerProduct.priceAmount,
				currency: providerProduct.currency,
				creditsAmount: row.creditsAmount,
				subscriptionPlan: row.subscriptionPlan,
				upgradeRank: row.upgradeRank,
				periodCreditsAmount: row.periodCreditsAmount
			}
		})
	}

	async createPaymentCheckout(input: CreatePaymentCheckoutInput): Promise<CreatePaymentCheckoutResult> {
		if (!this.config.enabled) {
			throw new PaymentServiceError('PAYMENT_DISABLED')
		}

		const product = this.getProduct(input.productId)
		const providerName = this.providerRouter.select({
			country: input.country
		})
		const providerProductId = this.getProviderProductId(product, providerName)

		const checkoutOrderId = crypto.randomUUID()
		const checkoutType =
			product.subscriptionPlan === null
				? CHECKOUT_ORDER_TYPE_CREDITS_PURCHASE
				: CHECKOUT_ORDER_TYPE_SUBSCRIPTION_INITIAL
		await this.db.insert(checkoutOrder).values({
			id: checkoutOrderId,
			userId: input.userId,
			type: checkoutType,
			status: CHECKOUT_ORDER_STATUS_PENDING,
			productId: product.productId,
			provider: providerName,
			providerProductId,
			providerCheckoutSessionId: null,
			providerPaymentId: null,
			checkoutUrl: null
		})

		const provider = this.getProvider(providerName)
		const customerEmail = await this.getUserEmail(input.userId)
		const returnPath = normalizeReturnPath(input.returnPath)
		const returnUrl = buildReturnUrl(input.appDomain, returnPath, checkoutOrderId)
		const created = await provider.createCheckout({
			checkoutOrderId,
			providerProductId,
			customerEmail,
			returnUrl
		})

		await this.db
			.update(checkoutOrder)
			.set({
				providerCheckoutSessionId: created.providerCheckoutSessionId,
				checkoutUrl: created.checkoutUrl,
				updatedAt: Date.now()
			})
			.where(eq(checkoutOrder.id, checkoutOrderId))

		return {
			checkoutOrderId,
			checkoutUrl: created.checkoutUrl
		}
	}

	async getSubscription(input: GetSubscriptionInput): Promise<GetSubscriptionResult> {
		const nowMs = input.nowMs ?? Date.now()
		const row = await this.db.query.userSubscription.findFirst({
			where: eq(userSubscription.userId, input.userId)
		})
		if (!row) {
			return {
				subscriptionPlan: SUBSCRIPTION_PLAN_FREE,
				subscription: null
			}
		}

		const isInCurrentPeriod = nowMs <= row.currentPeriodEnd
		const isInGrace =
			row.status === SUBSCRIPTION_STATUS_ACTIVE &&
			nowMs <= row.currentPeriodEnd + SUBSCRIPTION_GRACE_MS

		return {
			subscriptionPlan: isInCurrentPeriod || isInGrace ? row.subscriptionPlan : SUBSCRIPTION_PLAN_FREE,
			subscription: {
				productId: row.productId,
				status: row.status,
				currentPeriodStart: row.currentPeriodStart,
				currentPeriodEnd: row.currentPeriodEnd,
				canceledAt: row.canceledAt
			}
		}
	}

	async cancelSubscription(input: CancelSubscriptionRequest): Promise<CancelSubscriptionResult> {
		const nowMs = input.nowMs ?? Date.now()
		const row = await this.db.query.userSubscription.findFirst({
			where: eq(userSubscription.userId, input.userId)
		})
		if (!row) {
			throw new PaymentServiceError('SUBSCRIPTION_NOT_FOUND')
		}
		if (row.status === SUBSCRIPTION_STATUS_CANCEL_AT_PERIOD_END) {
			throw new PaymentServiceError('SUBSCRIPTION_ALREADY_CANCELED')
		}

		const provider = this.getProvider(row.provider as PaymentProviderName)
		await provider.cancelSubscription({
			providerSubscriptionId: row.providerSubscriptionId
		})

		await this.db
			.update(userSubscription)
			.set({
				status: SUBSCRIPTION_STATUS_CANCEL_AT_PERIOD_END,
				canceledAt: nowMs,
				updatedAt: nowMs
			})
			.where(eq(userSubscription.userId, input.userId))

		return {
			status: SUBSCRIPTION_STATUS_CANCEL_AT_PERIOD_END,
			currentPeriodEnd: row.currentPeriodEnd,
			canceledAt: nowMs
		}
	}

	async upgradeSubscription(input: UpgradeSubscriptionRequest): Promise<UpgradeSubscriptionResult> {
		if (!this.config.enabled) {
			throw new PaymentServiceError('PAYMENT_DISABLED')
		}

		const nowMs = input.nowMs ?? Date.now()
		const row = await this.db.query.userSubscription.findFirst({
			where: eq(userSubscription.userId, input.userId)
		})
		if (!row) {
			throw new PaymentServiceError('SUBSCRIPTION_NOT_FOUND')
		}
		if (nowMs > row.currentPeriodEnd + SUBSCRIPTION_GRACE_MS) {
			throw new PaymentServiceError('SUBSCRIPTION_NOT_ACTIVE')
		}

		const currentProduct = this.getProduct(row.productId)
		const targetProduct = this.getProduct(input.productId)
		if (targetProduct.subscriptionPlan === null || targetProduct.upgradeRank === null) {
			throw new PaymentServiceError('SUBSCRIPTION_TARGET_INVALID')
		}
		if (currentProduct.subscriptionPlan === null || currentProduct.upgradeRank === null) {
			throw new PaymentServiceError('SUBSCRIPTION_CURRENT_INVALID')
		}
		if (targetProduct.upgradeRank <= currentProduct.upgradeRank) {
			throw new PaymentServiceError('SUBSCRIPTION_UPGRADE_NOT_ALLOWED')
		}

		const providerName = row.provider as PaymentProviderName
		const provider = this.getProvider(providerName)
		const providerProductId = this.getProviderProductId(targetProduct, providerName)
		const checkoutOrderId = crypto.randomUUID()

		await this.db.insert(checkoutOrder).values({
			id: checkoutOrderId,
			userId: row.userId,
			type: CHECKOUT_ORDER_TYPE_SUBSCRIPTION_UPGRADE,
			status: CHECKOUT_ORDER_STATUS_PENDING,
			productId: targetProduct.productId,
			provider: providerName,
			providerProductId,
			providerCheckoutSessionId: null,
			providerPaymentId: null,
			checkoutUrl: null
		})

		const changed = await provider.changeSubscriptionPlan({
			checkoutOrderId,
			providerSubscriptionId: row.providerSubscriptionId,
			providerProductId
		})

		await this.db
			.update(checkoutOrder)
			.set({
				providerPaymentId: changed.providerPaymentId,
				updatedAt: Date.now()
			})
			.where(eq(checkoutOrder.id, checkoutOrderId))

		return {
			status: CHECKOUT_ORDER_STATUS_PENDING
		}
	}

	async listPaymentTransactions(
		input: ListPaymentTransactionsInput
	): Promise<ListPaymentTransactionsResult> {
		const conditions: SQL[] = [eq(paymentTransaction.userId, input.userId)]
		if (input.type) {
			conditions.push(eq(paymentTransaction.type, input.type))
		}
		if (input.status) {
			conditions.push(eq(paymentTransaction.status, input.status))
		}
		const whereCondition = and(...conditions)
		const totalRows = await this.db
			.select({
				total: sql<number>`count(*)`
			})
			.from(paymentTransaction)
			.where(whereCondition)

		const rows = await this.db
			.select()
			.from(paymentTransaction)
			.where(whereCondition)
			.orderBy(desc(paymentTransaction.createdAt))
			.limit(input.pageSize)
			.offset((input.page - 1) * input.pageSize)

		return {
			items: rows.map((row) => {
				return toPaymentTransactionItem(row)
			}),
			total: Number(totalRows[0]?.total ?? 0)
		}
	}

	async listAdminPaymentTransactions(
		input: ListAdminPaymentTransactionsInput
	): Promise<ListPaymentTransactionsResult> {
		const conditions: SQL[] = []
		if (input.userId) {
			conditions.push(eq(paymentTransaction.userId, input.userId))
		}
		if (input.type) {
			conditions.push(eq(paymentTransaction.type, input.type))
		}
		if (input.status) {
			conditions.push(eq(paymentTransaction.status, input.status))
		}
		const whereCondition = conditions.length > 0 ? and(...conditions) : undefined
		const totalRows = await this.db
			.select({
				total: sql<number>`count(*)`
			})
			.from(paymentTransaction)
			.where(whereCondition)

		const rows = await this.db
			.select()
			.from(paymentTransaction)
			.where(whereCondition)
			.orderBy(desc(paymentTransaction.createdAt))
			.limit(input.pageSize)
			.offset((input.page - 1) * input.pageSize)

		return {
			items: rows.map((row) => {
				return toPaymentTransactionItem(row)
			}),
			total: Number(totalRows[0]?.total ?? 0)
		}
	}

	async processWebhook(
		providerName: PaymentProviderName,
		rawBody: string,
		headers: Headers
	): Promise<void> {
		const provider = this.getProvider(providerName)
		const event = await provider.unwrapWebhook({
			rawBody,
			headers
		})
		logInfo('Payment webhook received', toPaymentEventLog(event))

		const existingEvent = await this.db.query.paymentWebhookEvent.findFirst({
			where: and(
				eq(paymentWebhookEvent.provider, event.provider),
				eq(paymentWebhookEvent.webhookId, event.webhookId)
			)
		})
		if (existingEvent) {
			logInfo('Payment webhook deduplicated', toPaymentEventLog(event))
			return
		}

		const processed = await this.processPaymentEvent(event)
		if (!processed) {
			return
		}

		await this.db.insert(paymentWebhookEvent).values({
			id: crypto.randomUUID(),
			provider: event.provider,
			webhookId: event.webhookId,
			eventType: event.type,
			processedAt: Date.now()
		})
	}

	private async processPaymentEvent(event: PaymentEvent): Promise<boolean> {
		switch (event.type) {
			case PAYMENT_EVENT_TYPE_PAYMENT_SUCCEEDED:
				return this.handlePaymentSucceeded(event)
			case PAYMENT_EVENT_TYPE_PAYMENT_FAILED:
				return this.handlePaymentFailed(event)
			case PAYMENT_EVENT_TYPE_SUBSCRIPTION_PAID:
				return this.handleSubscriptionPaid(event)
			case PAYMENT_EVENT_TYPE_REFUND_SUCCEEDED:
				return this.handleRefundSucceeded(event)
			case PAYMENT_EVENT_TYPE_DISPUTE_OPENED:
				return this.handleDisputeOpened(event)
			case PAYMENT_EVENT_TYPE_SUBSCRIPTION_CANCEL_AT_PERIOD_END:
				return this.handleSubscriptionStatusEvent(event, SUBSCRIPTION_STATUS_CANCEL_AT_PERIOD_END)
			case PAYMENT_EVENT_TYPE_SUBSCRIPTION_PAST_DUE:
			case PAYMENT_EVENT_TYPE_SUBSCRIPTION_ENDED:
				return this.handleSubscriptionStatusEvent(event, SUBSCRIPTION_STATUS_PAST_DUE)
		}
	}

	private async handlePaymentSucceeded(event: PaymentEvent): Promise<boolean> {
		if (event.checkoutOrderId === null) {
			logPaymentIgnored(event, {
				reason: 'missing_checkout_order_id'
			})
			return false
		}
		const order = await this.db.query.checkoutOrder.findFirst({
			where: eq(checkoutOrder.id, event.checkoutOrderId)
		})
		if (!order) {
			logPaymentIgnored(event, {
				reason: 'checkout_order_not_found'
			})
			return false
		}

		if (order.type === CHECKOUT_ORDER_TYPE_CREDITS_PURCHASE) {
			return this.applyCreditsPurchase(order, event)
		}

		logPaymentIgnored(event, {
			checkout_order_id: order.id,
			reason: 'subscription_payment_succeeded_ignored'
		})
		return true
	}

	private async handlePaymentFailed(event: PaymentEvent): Promise<boolean> {
		if (event.checkoutOrderId === null) {
			logPaymentIgnored(event, {
				reason: 'missing_checkout_order_id'
			})
			return false
		}

		const order = await this.db.query.checkoutOrder.findFirst({
			where: eq(checkoutOrder.id, event.checkoutOrderId)
		})
		if (!order) {
			logPaymentIgnored(event, {
				reason: 'checkout_order_not_found'
			})
			return false
		}
		if (order.status !== CHECKOUT_ORDER_STATUS_PENDING) {
			logPaymentIgnored(event, {
				checkout_order_id: order.id,
				reason: 'checkout_order_not_pending'
			})
			return true
		}

		const nowMs = normalizeEventTimeMs(event.occurredAt)
		await this.db
			.update(checkoutOrder)
			.set({
				status: CHECKOUT_ORDER_STATUS_FAILED,
				providerPaymentId: event.providerPaymentId,
				updatedAt: nowMs
			})
			.where(eq(checkoutOrder.id, order.id))
		logPaymentStateTransition(event, {
			checkout_order_id: order.id,
			user_id: order.userId,
			from_status: order.status,
			to_status: CHECKOUT_ORDER_STATUS_FAILED
		})
		return true
	}

	private async handleSubscriptionPaid(event: PaymentEvent): Promise<boolean> {
		const checkout =
			event.checkoutOrderId === null
				? null
				: await this.db.query.checkoutOrder.findFirst({
					where: eq(checkoutOrder.id, event.checkoutOrderId)
				})

		if (checkout) {
			switch (checkout.type) {
				case CHECKOUT_ORDER_TYPE_SUBSCRIPTION_INITIAL:
					return this.applySubscriptionInitial(checkout, event)
				case CHECKOUT_ORDER_TYPE_SUBSCRIPTION_UPGRADE:
					return this.applySubscriptionUpgrade(checkout, event)
			}
		}

		return this.applySubscriptionRenewal(event)
	}

	private async handleRefundSucceeded(event: PaymentEvent): Promise<boolean> {
		if (event.providerPaymentId === null || event.providerRefundId === null) {
			logPaymentIgnored(event, {
				reason: 'missing_refund_identity'
			})
			return false
		}

		const row = await this.findPaymentTransactionByProviderPaymentId(
			event.provider,
			event.providerPaymentId
		)
		if (!row) {
			logPaymentIgnored(event, {
				reason: 'payment_transaction_not_found'
			})
			return false
		}

		const nowMs = normalizeEventTimeMs(event.occurredAt)
		await this.db
			.update(paymentTransaction)
			.set({
				status: PAYMENT_TRANSACTION_STATUS_REFUNDED,
				providerRefundId: event.providerRefundId,
				refundedAt: nowMs,
				updatedAt: nowMs
			})
			.where(eq(paymentTransaction.id, row.id))
		logPaymentStateTransition(event, {
			transaction_id: row.id,
			user_id: row.userId,
			from_status: row.status,
			to_status: PAYMENT_TRANSACTION_STATUS_REFUNDED
		})

		if (row.creditsGranted > 0 && row.creditsReversedAt === null) {
			const credits = new CreditsService(this.db)
			await credits.deduct({
				userId: row.userId,
				type: CREDIT_TRANSACTION_TYPE_PAYMENT_REFUND,
				amount: row.creditsGranted,
				sourceType: PAYMENT_CREDIT_SOURCE_REFUND,
				sourceId: `${event.provider}:${event.providerRefundId}`,
				description: 'Reverse credits for refunded payment'
			})
			await this.db
				.update(paymentTransaction)
				.set({
					creditsReversedAt: nowMs,
					updatedAt: nowMs
				})
				.where(eq(paymentTransaction.id, row.id))
		}
		return true
	}

	private async handleDisputeOpened(event: PaymentEvent): Promise<boolean> {
		if (event.providerPaymentId === null || event.providerDisputeId === null) {
			logPaymentIgnored(event, {
				reason: 'missing_dispute_identity'
			})
			return false
		}

		const row = await this.findPaymentTransactionByProviderPaymentId(
			event.provider,
			event.providerPaymentId
		)
		if (!row) {
			logPaymentIgnored(event, {
				reason: 'payment_transaction_not_found'
			})
			return false
		}

		const nowMs = normalizeEventTimeMs(event.occurredAt)
		await this.db
			.update(paymentTransaction)
			.set({
				status: PAYMENT_TRANSACTION_STATUS_DISPUTED,
				providerDisputeId: event.providerDisputeId,
				disputedAt: nowMs,
				updatedAt: nowMs
			})
			.where(eq(paymentTransaction.id, row.id))
		logPaymentStateTransition(event, {
			transaction_id: row.id,
			user_id: row.userId,
			from_status: row.status,
			to_status: PAYMENT_TRANSACTION_STATUS_DISPUTED
		})
		return true
	}

	private async handleSubscriptionStatusEvent(event: PaymentEvent, nextStatus: string): Promise<boolean> {
		if (event.providerSubscriptionId === null) {
			logPaymentIgnored(event, {
				reason: 'missing_provider_subscription_id'
			})
			return false
		}
		const row = await this.db.query.userSubscription.findFirst({
			where: and(
				eq(userSubscription.provider, event.provider),
				eq(userSubscription.providerSubscriptionId, event.providerSubscriptionId)
			)
		})
		if (!row) {
			logPaymentIgnored(event, {
				reason: 'subscription_not_found'
			})
			return false
		}

		const nowMs = normalizeEventTimeMs(event.occurredAt)
		await this.db
			.update(userSubscription)
			.set({
				status: nextStatus,
				currentPeriodStart: event.periodStart ? normalizeEventTimeMs(event.periodStart) : row.currentPeriodStart,
				currentPeriodEnd: event.periodEnd ? normalizeEventTimeMs(event.periodEnd) : row.currentPeriodEnd,
				updatedAt: nowMs
			})
			.where(eq(userSubscription.userId, row.userId))
		logPaymentStateTransition(event, {
			user_id: row.userId,
			from_status: row.status,
			to_status: nextStatus
		})
		return true
	}

	private async applyCreditsPurchase(order: CheckoutOrderRow, event: PaymentEvent): Promise<boolean> {
		if (event.providerPaymentId === null || event.amount === null || event.currency === null) {
			logPaymentIgnored(event, {
				checkout_order_id: order.id,
				reason: 'missing_payment_fields'
			})
			return false
		}

		const product = this.getProduct(order.productId)
		const nowMs = normalizeEventTimeMs(event.occurredAt)
		const creditsGranted = product.creditsAmount ?? 0
		const transaction = await this.ensurePaymentTransaction({
			event,
			userId: order.userId,
			checkoutOrderId: order.id,
			subscriptionId: null,
			type: PAYMENT_TRANSACTION_TYPE_CREDITS_PURCHASE,
			productId: order.productId,
			amount: event.amount,
			currency: event.currency,
			creditsGranted,
			paidAt: nowMs
		})

		if (creditsGranted > 0) {
			const credits = new CreditsService(this.db)
			await credits.grant({
				userId: order.userId,
				type: CREDIT_TRANSACTION_TYPE_PAYMENT_PURCHASE,
				amount: creditsGranted,
				sourceType: PAYMENT_CREDIT_SOURCE_TRANSACTION,
				sourceId: transaction.id,
				description: 'Grant credits for payment purchase'
			})
		}

		await this.db
			.update(checkoutOrder)
			.set({
				status: CHECKOUT_ORDER_STATUS_COMPLETED,
				providerPaymentId: event.providerPaymentId,
				updatedAt: nowMs
			})
			.where(eq(checkoutOrder.id, order.id))
		logPaymentStateTransition(event, {
			checkout_order_id: order.id,
			transaction_id: transaction.id,
			user_id: order.userId,
			from_status: order.status,
			to_status: CHECKOUT_ORDER_STATUS_COMPLETED,
			credits_granted: creditsGranted
		})
		return true
	}

	private async ensurePaymentTransaction(input: {
		event: PaymentEvent
		userId: string
		checkoutOrderId: string | null
		subscriptionId: string | null
		type: string
		productId: string
		amount: number
		currency: string
		creditsGranted: number
		paidAt: number
	}): Promise<PaymentTransactionRow> {
		const providerPaymentId = input.event.providerPaymentId
		if (providerPaymentId === null) {
			throw new PaymentServiceError('PAYMENT_PROVIDER_PAYMENT_ID_MISSING')
		}

		const existing = await this.findPaymentTransactionByProviderPaymentId(
			input.event.provider,
			providerPaymentId
		)
		if (existing) {
			return existing
		}

		const transactionId = crypto.randomUUID()
		await this.db.insert(paymentTransaction).values({
			id: transactionId,
			userId: input.userId,
			checkoutOrderId: input.checkoutOrderId,
			subscriptionId: input.subscriptionId,
			type: input.type,
			status: PAYMENT_TRANSACTION_STATUS_PAID,
			productId: input.productId,
			provider: input.event.provider,
			providerPaymentId,
			providerRefundId: null,
			providerDisputeId: null,
			amount: input.amount,
			currency: input.currency,
			creditsGranted: input.creditsGranted,
			creditsReversedAt: null,
			paidAt: input.paidAt,
			refundedAt: null,
			disputedAt: null
		}).onConflictDoNothing({
			target: [paymentTransaction.provider, paymentTransaction.providerPaymentId]
		})

		const row = await this.findPaymentTransactionByProviderPaymentId(input.event.provider, providerPaymentId)
		if (!row) {
			throw new PaymentServiceError('PAYMENT_TRANSACTION_NOT_FOUND')
		}
		return row
	}

	private async findPaymentTransactionByProviderPaymentId(
		provider: PaymentProviderName,
		providerPaymentId: string
	): Promise<PaymentTransactionRow | undefined> {
		return this.db.query.paymentTransaction.findFirst({
			where: and(
				eq(paymentTransaction.provider, provider),
				eq(paymentTransaction.providerPaymentId, providerPaymentId)
			)
		})
	}

	private async applySubscriptionInitial(order: CheckoutOrderRow, event: PaymentEvent): Promise<boolean> {
		if (event.providerSubscriptionId === null || event.providerPaymentId === null) {
			logPaymentIgnored(event, {
				checkout_order_id: order.id,
				reason: 'missing_subscription_payment_identity'
			})
			return false
		}

		const product = this.getProduct(order.productId)
		if (product.subscriptionPlan === null || product.periodCreditsAmount === null) {
			throw new PaymentServiceError('SUBSCRIPTION_PRODUCT_INVALID')
		}

		const nowMs = normalizeEventTimeMs(event.occurredAt)
		const periodStart = event.periodStart ? normalizeEventTimeMs(event.periodStart) : nowMs
		const periodEnd = event.periodEnd ? normalizeEventTimeMs(event.periodEnd) : nowMs
		const transaction = await this.ensurePaymentTransaction({
			event,
			userId: order.userId,
			checkoutOrderId: order.id,
			subscriptionId: order.userId,
			type: PAYMENT_TRANSACTION_TYPE_SUBSCRIPTION_INITIAL,
			productId: order.productId,
			amount: event.amount ?? 0,
			currency: event.currency ?? '',
			creditsGranted: product.periodCreditsAmount,
			paidAt: nowMs
		})

		await this.db
			.insert(userSubscription)
			.values({
				userId: order.userId,
				provider: event.provider,
				providerSubscriptionId: event.providerSubscriptionId,
				productId: product.productId,
				subscriptionPlan: product.subscriptionPlan,
				periodCreditsAmount: product.periodCreditsAmount,
				currentPeriodStart: periodStart,
				currentPeriodEnd: periodEnd,
				status: SUBSCRIPTION_STATUS_ACTIVE,
				canceledAt: null
			})
			.onConflictDoUpdate({
				target: userSubscription.userId,
				set: {
					provider: event.provider,
					providerSubscriptionId: event.providerSubscriptionId,
					productId: product.productId,
					subscriptionPlan: product.subscriptionPlan,
					periodCreditsAmount: product.periodCreditsAmount,
					currentPeriodStart: periodStart,
					currentPeriodEnd: periodEnd,
					status: SUBSCRIPTION_STATUS_ACTIVE,
					canceledAt: null,
					updatedAt: nowMs
				}
			})

		const credits = new CreditsService(this.db)
		await credits.grant({
			userId: order.userId,
			type: CREDIT_TRANSACTION_TYPE_PAYMENT_PURCHASE,
			amount: product.periodCreditsAmount,
			sourceType: PAYMENT_CREDIT_SOURCE_TRANSACTION,
			sourceId: transaction.id,
			description: 'Grant credits for initial subscription period'
		})

		await this.db
			.update(checkoutOrder)
			.set({
				status: CHECKOUT_ORDER_STATUS_COMPLETED,
				providerPaymentId: event.providerPaymentId,
				updatedAt: nowMs
			})
			.where(eq(checkoutOrder.id, order.id))
		logPaymentStateTransition(event, {
			checkout_order_id: order.id,
			transaction_id: transaction.id,
			user_id: order.userId,
			from_status: order.status,
			to_status: CHECKOUT_ORDER_STATUS_COMPLETED,
			subscription_status: SUBSCRIPTION_STATUS_ACTIVE,
			credits_granted: product.periodCreditsAmount
		})
		return true
	}

	private async applySubscriptionRenewal(event: PaymentEvent): Promise<boolean> {
		if (event.providerSubscriptionId === null || event.providerPaymentId === null) {
			logPaymentIgnored(event, {
				reason: 'missing_subscription_payment_identity'
			})
			return false
		}

		const sub = await this.db.query.userSubscription.findFirst({
			where: and(
				eq(userSubscription.provider, event.provider),
				eq(userSubscription.providerSubscriptionId, event.providerSubscriptionId)
			)
		})
		if (!sub) {
			logPaymentIgnored(event, {
				reason: 'subscription_not_found'
			})
			return false
		}

		const nowMs = normalizeEventTimeMs(event.occurredAt)
		const periodEnd = event.periodEnd ? normalizeEventTimeMs(event.periodEnd) : sub.currentPeriodEnd
		const transaction = await this.ensurePaymentTransaction({
			event,
			userId: sub.userId,
			checkoutOrderId: null,
			subscriptionId: sub.userId,
			type: PAYMENT_TRANSACTION_TYPE_SUBSCRIPTION_RENEWAL,
			productId: sub.productId,
			amount: event.amount ?? 0,
			currency: event.currency ?? '',
			creditsGranted: sub.periodCreditsAmount,
			paidAt: periodEnd
		})

		const credits = new CreditsService(this.db)
		await credits.grant({
			userId: sub.userId,
			type: CREDIT_TRANSACTION_TYPE_PAYMENT_PURCHASE,
			amount: sub.periodCreditsAmount,
			sourceType: PAYMENT_CREDIT_SOURCE_TRANSACTION,
			sourceId: transaction.id,
			description: 'Grant credits for subscription renewal'
		})

		await this.db
			.update(userSubscription)
			.set({
				currentPeriodStart: event.periodStart
					? normalizeEventTimeMs(event.periodStart)
					: sub.currentPeriodStart,
				currentPeriodEnd: periodEnd,
				status: SUBSCRIPTION_STATUS_ACTIVE,
				canceledAt: null,
				updatedAt: nowMs
			})
			.where(eq(userSubscription.userId, sub.userId))
		logPaymentStateTransition(event, {
			transaction_id: transaction.id,
			user_id: sub.userId,
			from_status: sub.status,
			to_status: SUBSCRIPTION_STATUS_ACTIVE,
			credits_granted: sub.periodCreditsAmount
		})
		return true
	}

	private async applySubscriptionUpgrade(order: CheckoutOrderRow, event: PaymentEvent): Promise<boolean> {
		if (event.providerSubscriptionId === null || event.providerPaymentId === null) {
			logPaymentIgnored(event, {
				checkout_order_id: order.id,
				reason: 'missing_subscription_payment_identity'
			})
			return false
		}
		const sub = await this.db.query.userSubscription.findFirst({
			where: eq(userSubscription.userId, order.userId)
		})
		if (!sub) {
			throw new PaymentServiceError('SUBSCRIPTION_NOT_FOUND')
		}

		const currentProduct = this.getProduct(sub.productId)
		const targetProduct = this.getProduct(order.productId)
		if (
			currentProduct.periodCreditsAmount === null ||
			targetProduct.periodCreditsAmount === null ||
			targetProduct.subscriptionPlan === null
		) {
			throw new PaymentServiceError('SUBSCRIPTION_PRODUCT_INVALID')
		}

		const nowMs = normalizeEventTimeMs(event.occurredAt)
		const creditsDiff = Math.max(targetProduct.periodCreditsAmount - currentProduct.periodCreditsAmount, 0)
		const transaction = await this.ensurePaymentTransaction({
			event,
			userId: sub.userId,
			checkoutOrderId: order.id,
			subscriptionId: sub.userId,
			type: PAYMENT_TRANSACTION_TYPE_SUBSCRIPTION_UPGRADE,
			productId: targetProduct.productId,
			amount: event.amount ?? 0,
			currency: event.currency ?? '',
			creditsGranted: creditsDiff,
			paidAt: nowMs
		})

		if (creditsDiff > 0) {
			const credits = new CreditsService(this.db)
			await credits.grant({
				userId: sub.userId,
				type: CREDIT_TRANSACTION_TYPE_PAYMENT_PURCHASE,
				amount: creditsDiff,
				sourceType: PAYMENT_CREDIT_SOURCE_TRANSACTION,
				sourceId: transaction.id,
				description: 'Grant credits diff for subscription upgrade'
			})
		}

		await this.db
			.update(userSubscription)
			.set({
				productId: targetProduct.productId,
				subscriptionPlan: targetProduct.subscriptionPlan,
				periodCreditsAmount: targetProduct.periodCreditsAmount,
				currentPeriodStart: event.periodStart
					? normalizeEventTimeMs(event.periodStart)
					: sub.currentPeriodStart,
				currentPeriodEnd: event.periodEnd ? normalizeEventTimeMs(event.periodEnd) : sub.currentPeriodEnd,
				status: SUBSCRIPTION_STATUS_ACTIVE,
				canceledAt: null,
				updatedAt: nowMs
			})
			.where(eq(userSubscription.userId, sub.userId))

		await this.db
			.update(checkoutOrder)
			.set({
				status: CHECKOUT_ORDER_STATUS_COMPLETED,
				providerPaymentId: event.providerPaymentId,
				updatedAt: nowMs
			})
			.where(eq(checkoutOrder.id, order.id))
		logPaymentStateTransition(event, {
			checkout_order_id: order.id,
			transaction_id: transaction.id,
			user_id: sub.userId,
			from_status: sub.status,
			to_status: SUBSCRIPTION_STATUS_ACTIVE,
			credits_granted: creditsDiff
		})
		return true
	}

	private getProvider(name: PaymentProviderName): PaymentProvider {
		const provider = this.providers[name]
		if (!provider) {
			throw new PaymentServiceError('PAYMENT_PROVIDER_NOT_AVAILABLE')
		}
		return provider
	}

	private getProduct(productId: string): PaymentProductConfig {
		const row = this.config.products.find((item) => item.productId === productId)
		if (!row) {
			throw new PaymentServiceError('PAYMENT_PRODUCT_NOT_FOUND')
		}
		return row
	}

	private getProviderProductId(product: PaymentProductConfig, provider: PaymentProviderName): string {
		const providerProductId = product.providerProductIds[provider]
		if (!providerProductId) {
			throw new PaymentServiceError('PAYMENT_PROVIDER_PRODUCT_ID_MISSING')
		}
		return providerProductId
	}

	private async getUserEmail(userId: string): Promise<string> {
		const row = await this.db.query.user.findFirst({
			columns: {
				email: true
			},
			where: eq(user.id, userId)
		})
		if (!row) {
			throw new PaymentServiceError('PAYMENT_USER_NOT_FOUND')
		}
		return row.email
	}
}

export function newPaymentService(
	db: AppDb,
	env: Env
): PaymentService {
	const config = parsePaymentConfig(env)
	const providerRouter = new PaymentProviderRouter({
		defaultProvider: config.defaultProvider,
		providerCountryOverrides: config.providerCountryOverrides
	})

	const providers: PaymentProviderMap = {
		dodo: newDodoPayment(env),
		creem: newCreemPayment(env)
	}

	return new PaymentService(db, config, providerRouter, providers)
}

function normalizeReturnPath(returnPath: string | null): string {
	const path = (returnPath ?? '/').trim()
	if (!path.startsWith('/')) {
		throw new PaymentServiceError('PAYMENT_RETURN_PATH_INVALID')
	}
	if (path.startsWith('//')) {
		throw new PaymentServiceError('PAYMENT_RETURN_PATH_INVALID')
	}
	return path
}

function buildReturnUrl(appDomain: string, returnPath: string, checkoutOrderId: string): string {
	const base = appDomain.startsWith('http://') || appDomain.startsWith('https://')
		? appDomain
		: `${getDefaultProtocol(appDomain)}://${appDomain}`
	const url = new URL(returnPath, base)
	if (checkoutOrderId.length > 0) {
		url.searchParams.set(CHECKOUT_ORDER_ID_PARAM, checkoutOrderId)
	}
	return url.toString()
}

function getDefaultProtocol(appDomain: string): string {
	if (appDomain === 'localhost' || appDomain.startsWith('localhost:')) {
		return 'http'
	}
	if (appDomain === '127.0.0.1' || appDomain.startsWith('127.0.0.1:')) {
		return 'http'
	}
	return 'https'
}

function toPaymentEventLog(event: PaymentEvent): Record<string, unknown> {
	return {
		provider: event.provider,
		webhook_id: event.webhookId,
		event_type: event.type,
		checkout_order_id: event.checkoutOrderId,
		provider_payment_id: event.providerPaymentId,
		provider_refund_id: event.providerRefundId,
		provider_dispute_id: event.providerDisputeId,
		provider_subscription_id: event.providerSubscriptionId
	}
}

function logPaymentIgnored(
	event: PaymentEvent,
	fields: Record<string, unknown>
): void {
	const reason = typeof fields['reason'] === 'string' ? fields['reason'] : 'payment_event_ignored'
	logWarn(reason, {
		...toPaymentEventLog(event),
		...fields
	})
}

function logPaymentStateTransition(
	event: PaymentEvent,
	fields: Record<string, unknown>
): void {
	logInfo('Payment state transition', {
		...toPaymentEventLog(event),
		...fields
	})
}

function normalizeEventTimeMs(value: number): number {
	return value < 1_000_000_000_000 ? value * 1000 : value
}

function toPaymentTransactionItem(
	row: typeof paymentTransaction.$inferSelect
): PaymentTransactionItem {
	return {
		id: row.id,
		userId: row.userId,
		type: row.type,
		status: row.status,
		productId: row.productId,
		amount: row.amount,
		currency: row.currency,
		creditsGranted: row.creditsGranted,
		paidAt: row.paidAt,
		refundedAt: row.refundedAt,
		disputedAt: row.disputedAt,
		createdAt: row.createdAt
	}
}
