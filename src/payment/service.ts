import { and, desc, eq, sql, type SQL } from 'drizzle-orm'
import type { AppDb } from '../db'
import { checkoutOrder, paymentTransaction, paymentWebhookEvent, userSubscription } from '../db/schema'
import { user } from '../db/schema.auth'
import { CreditsService } from '../credits'
import {
	parsePaymentConfig,
	PaymentProviderRouter,
	type PaymentConfig,
	type PaymentProductConfig,
	type PaymentProviderName
} from './config'
import { createDodoPaymentProviderFromEnv } from './dodo'
import { createCreemPaymentProviderFromEnv } from './creem'
import type { PaymentBillingMode, PaymentEvent, PaymentProvider } from './provider'

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
	status: 'pending'
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
				row.subscriptionPlan === null ? 'one_time' : 'subscription'
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
		const provider = this.getProvider(providerName)
		const returnPath = normalizeReturnPath(input.returnPath)
		const returnUrl = buildReturnUrl(input.appDomain, returnPath, '')
		const nowMs = Date.now()
		const checkoutOrderId = crypto.randomUUID()
		const checkoutType = product.subscriptionPlan === null ? 'credits_purchase' : 'subscription_initial'
		const customerEmail = await this.getUserEmail(input.userId)

		await this.db.insert(checkoutOrder).values({
			id: checkoutOrderId,
			userId: input.userId,
			type: checkoutType,
			status: 'pending',
			productId: product.productId,
			provider: providerName,
			providerProductId,
			providerCheckoutSessionId: null,
			providerPaymentId: null,
			checkoutUrl: null,
			createdAt: nowMs,
			updatedAt: nowMs
		})

		const finalReturnUrl = buildReturnUrl(input.appDomain, returnPath, checkoutOrderId)
		const created = await provider.createCheckout({
			checkoutOrderId,
			providerProductId,
			customerEmail,
			returnUrl: finalReturnUrl
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
				subscriptionPlan: 'free',
				subscription: null
			}
		}

		const graceMs = 2 * 60 * 60 * 1000
		const isInCurrentPeriod = nowMs <= row.currentPeriodEnd
		const isInGrace = row.status === 'active' && nowMs <= row.currentPeriodEnd + graceMs

		return {
			subscriptionPlan: isInCurrentPeriod || isInGrace ? row.subscriptionPlan : 'free',
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
		if (row.status === 'cancel_at_period_end') {
			throw new PaymentServiceError('SUBSCRIPTION_ALREADY_CANCELED')
		}

		const provider = this.getProvider(row.provider as PaymentProviderName)
		await provider.cancelSubscription({
			providerSubscriptionId: row.providerSubscriptionId
		})

		await this.db
			.update(userSubscription)
			.set({
				status: 'cancel_at_period_end',
				canceledAt: nowMs,
				updatedAt: nowMs
			})
			.where(eq(userSubscription.userId, input.userId))

		return {
			status: 'cancel_at_period_end',
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
		if (nowMs > row.currentPeriodEnd + 2 * 60 * 60 * 1000) {
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
			type: 'subscription_upgrade',
			status: 'pending',
			productId: targetProduct.productId,
			provider: providerName,
			providerProductId,
			providerCheckoutSessionId: null,
			providerPaymentId: null,
			checkoutUrl: null,
			createdAt: nowMs,
			updatedAt: nowMs
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
			status: 'pending'
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

		const existingEvent = await this.db.query.paymentWebhookEvent.findFirst({
			where: and(
				eq(paymentWebhookEvent.provider, event.provider),
				eq(paymentWebhookEvent.webhookId, event.webhookId)
			)
		})
		if (existingEvent) {
			return
		}

		await this.processPaymentEvent(event)

		await this.db.insert(paymentWebhookEvent).values({
			id: crypto.randomUUID(),
			provider: event.provider,
			webhookId: event.webhookId,
			eventType: event.eventType,
			processedAt: Date.now()
		})
	}

	private async processPaymentEvent(event: PaymentEvent): Promise<void> {
		if (event.eventType === 'payment_succeeded') {
			await this.handlePaymentSucceeded(event)
			return
		}
		if (event.eventType === 'subscription_paid') {
			await this.handleSubscriptionPaid(event)
			return
		}
		if (event.eventType === 'refund_succeeded') {
			await this.handleRefundSucceeded(event)
			return
		}
		if (event.eventType === 'dispute_opened') {
			await this.handleDisputeOpened(event)
			return
		}
		if (event.eventType === 'subscription_cancel_at_period_end') {
			await this.handleSubscriptionStatusEvent(event, 'cancel_at_period_end')
			return
		}
		if (event.eventType === 'subscription_past_due' || event.eventType === 'subscription_ended') {
			await this.handleSubscriptionStatusEvent(event, 'past_due')
			return
		}
	}

	private async handlePaymentSucceeded(event: PaymentEvent): Promise<void> {
		if (event.checkoutOrderId === null) {
			return
		}
		const order = await this.db.query.checkoutOrder.findFirst({
			where: eq(checkoutOrder.id, event.checkoutOrderId)
		})
		if (!order || order.status !== 'pending') {
			return
		}

		if (order.type === 'credits_purchase') {
			await this.applyCreditsPurchase(order, event)
			return
		}
		if (order.type === 'subscription_initial' && event.providerSubscriptionId !== null) {
			await this.applySubscriptionInitial(order, event)
			return
		}
	}

	private async handleSubscriptionPaid(event: PaymentEvent): Promise<void> {
		const pendingOrder =
			event.checkoutOrderId === null
				? null
				: await this.db.query.checkoutOrder.findFirst({
						where: and(
							eq(checkoutOrder.id, event.checkoutOrderId),
							eq(checkoutOrder.status, 'pending')
						)
					})

		if (pendingOrder && pendingOrder.type === 'subscription_initial') {
			await this.applySubscriptionInitial(pendingOrder, event)
			return
		}
		if (pendingOrder && pendingOrder.type === 'subscription_upgrade') {
			await this.applySubscriptionUpgrade(pendingOrder, event)
			return
		}

		await this.applySubscriptionRenewal(event)
	}

	private async handleRefundSucceeded(event: PaymentEvent): Promise<void> {
		if (event.providerPaymentId === null || event.providerRefundId === null) {
			return
		}

		const duplicated = await this.db.query.paymentTransaction.findFirst({
			where: and(
				eq(paymentTransaction.provider, event.provider),
				eq(paymentTransaction.providerRefundId, event.providerRefundId)
			)
		})
		if (duplicated) {
			return
		}

		const row = await this.db.query.paymentTransaction.findFirst({
			where: and(
				eq(paymentTransaction.provider, event.provider),
				eq(paymentTransaction.providerPaymentId, event.providerPaymentId)
			)
		})
		if (!row) {
			return
		}

		const nowMs = normalizeEventTimeMs(event.occurredAt)
		await this.db
			.update(paymentTransaction)
			.set({
				status: 'refunded',
				providerRefundId: event.providerRefundId,
				refundedAt: nowMs,
				updatedAt: nowMs
			})
			.where(eq(paymentTransaction.id, row.id))

		if (row.creditsGranted > 0 && row.creditsReversedAt === null) {
			const credits = new CreditsService(this.db)
			await credits.deduct({
				userId: row.userId,
				amount: row.creditsGranted,
				sourceType: 'payment_refund',
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
	}

	private async handleDisputeOpened(event: PaymentEvent): Promise<void> {
		if (event.providerPaymentId === null || event.providerDisputeId === null) {
			return
		}

		const duplicated = await this.db.query.paymentTransaction.findFirst({
			where: and(
				eq(paymentTransaction.provider, event.provider),
				eq(paymentTransaction.providerDisputeId, event.providerDisputeId)
			)
		})
		if (duplicated) {
			return
		}

		const row = await this.db.query.paymentTransaction.findFirst({
			where: and(
				eq(paymentTransaction.provider, event.provider),
				eq(paymentTransaction.providerPaymentId, event.providerPaymentId)
			)
		})
		if (!row) {
			return
		}

		const nowMs = normalizeEventTimeMs(event.occurredAt)
		await this.db
			.update(paymentTransaction)
			.set({
				status: 'disputed',
				providerDisputeId: event.providerDisputeId,
				disputedAt: nowMs,
				updatedAt: nowMs
			})
			.where(eq(paymentTransaction.id, row.id))
	}

	private async handleSubscriptionStatusEvent(event: PaymentEvent, nextStatus: string): Promise<void> {
		if (event.providerSubscriptionId === null) {
			return
		}
		const row = await this.db.query.userSubscription.findFirst({
			where: and(
				eq(userSubscription.provider, event.provider),
				eq(userSubscription.providerSubscriptionId, event.providerSubscriptionId)
			)
		})
		if (!row) {
			return
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
	}

	private async applyCreditsPurchase(
		order: typeof checkoutOrder.$inferSelect,
		event: PaymentEvent
	): Promise<void> {
		if (event.providerPaymentId === null || event.amount === null || event.currency === null) {
			return
		}
		const duplicated = await this.db.query.paymentTransaction.findFirst({
			where: and(
				eq(paymentTransaction.provider, event.provider),
				eq(paymentTransaction.providerPaymentId, event.providerPaymentId)
			)
		})
		if (duplicated) {
			return
		}

		const product = this.getProduct(order.productId)
		const nowMs = normalizeEventTimeMs(event.occurredAt)
		const creditsGranted = product.creditsAmount ?? 0
		const transactionId = crypto.randomUUID()

		await this.db.insert(paymentTransaction).values({
			id: transactionId,
			userId: order.userId,
			checkoutOrderId: order.id,
			subscriptionId: null,
			type: 'credits_purchase',
			status: 'paid',
			productId: order.productId,
			provider: event.provider,
			providerPaymentId: event.providerPaymentId,
			providerRefundId: null,
			providerDisputeId: null,
			amount: event.amount,
			currency: event.currency,
			creditsGranted,
			creditsReversedAt: null,
			paidAt: nowMs,
			refundedAt: null,
			disputedAt: null,
			createdAt: nowMs,
			updatedAt: nowMs
		})

		if (creditsGranted > 0) {
			const credits = new CreditsService(this.db)
			await credits.grant({
				userId: order.userId,
				type: 'manual_grant',
				amount: creditsGranted,
				sourceType: 'payment_transaction',
				sourceId: transactionId,
				description: 'Grant credits for payment purchase'
			})
		}

		await this.db
			.update(checkoutOrder)
			.set({
				status: 'completed',
				providerPaymentId: event.providerPaymentId,
				updatedAt: nowMs
			})
			.where(eq(checkoutOrder.id, order.id))
	}

	private async applySubscriptionInitial(
		order: typeof checkoutOrder.$inferSelect,
		event: PaymentEvent
	): Promise<void> {
		if (event.providerSubscriptionId === null) {
			return
		}
		if (event.providerPaymentId !== null) {
			const duplicated = await this.db.query.paymentTransaction.findFirst({
				where: and(
					eq(paymentTransaction.provider, event.provider),
					eq(paymentTransaction.providerPaymentId, event.providerPaymentId)
				)
			})
			if (duplicated) {
				return
			}
		}

		const product = this.getProduct(order.productId)
		if (product.subscriptionPlan === null || product.periodCreditsAmount === null) {
			throw new PaymentServiceError('SUBSCRIPTION_PRODUCT_INVALID')
		}

		const nowMs = normalizeEventTimeMs(event.occurredAt)
		const periodStart = event.periodStart ? normalizeEventTimeMs(event.periodStart) : nowMs
		const periodEnd = event.periodEnd ? normalizeEventTimeMs(event.periodEnd) : nowMs
		const transactionId = crypto.randomUUID()

		await this.db.insert(paymentTransaction).values({
			id: transactionId,
			userId: order.userId,
			checkoutOrderId: order.id,
			subscriptionId: order.userId,
			type: 'subscription_initial',
			status: 'paid',
			productId: order.productId,
			provider: event.provider,
			providerPaymentId: event.providerPaymentId,
			providerRefundId: null,
			providerDisputeId: null,
			amount: event.amount ?? 0,
			currency: event.currency ?? '',
			creditsGranted: product.periodCreditsAmount,
			creditsReversedAt: null,
			paidAt: nowMs,
			refundedAt: null,
			disputedAt: null,
			createdAt: nowMs,
			updatedAt: nowMs
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
				status: 'active',
				canceledAt: null,
				createdAt: nowMs,
				updatedAt: nowMs
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
					status: 'active',
					canceledAt: null,
					updatedAt: nowMs
				}
			})

		const credits = new CreditsService(this.db)
		await credits.grant({
			userId: order.userId,
			type: 'manual_grant',
			amount: product.periodCreditsAmount,
			sourceType: 'payment_transaction',
			sourceId: transactionId,
			description: 'Grant credits for initial subscription period'
		})

		await this.db
			.update(checkoutOrder)
			.set({
				status: 'completed',
				providerPaymentId: event.providerPaymentId,
				updatedAt: nowMs
			})
			.where(eq(checkoutOrder.id, order.id))
	}

	private async applySubscriptionRenewal(event: PaymentEvent): Promise<void> {
		if (event.providerSubscriptionId === null) {
			return
		}

		const sub = await this.db.query.userSubscription.findFirst({
			where: and(
				eq(userSubscription.provider, event.provider),
				eq(userSubscription.providerSubscriptionId, event.providerSubscriptionId)
			)
		})
		if (!sub) {
			return
		}

		if (event.providerPaymentId !== null) {
			const duplicated = await this.db.query.paymentTransaction.findFirst({
				where: and(
					eq(paymentTransaction.provider, event.provider),
					eq(paymentTransaction.providerPaymentId, event.providerPaymentId)
				)
			})
			if (duplicated) {
				return
			}
		}

		const nowMs = normalizeEventTimeMs(event.occurredAt)
		const periodEnd = event.periodEnd ? normalizeEventTimeMs(event.periodEnd) : sub.currentPeriodEnd
		const maybeDuplicated = await this.db.query.paymentTransaction.findFirst({
			where: and(
				eq(paymentTransaction.subscriptionId, sub.userId),
				eq(paymentTransaction.type, 'subscription_renewal'),
				eq(paymentTransaction.paidAt, periodEnd)
			)
		})
		if (maybeDuplicated) {
			return
		}

		const transactionId = crypto.randomUUID()
		await this.db.insert(paymentTransaction).values({
			id: transactionId,
			userId: sub.userId,
			checkoutOrderId: null,
			subscriptionId: sub.userId,
			type: 'subscription_renewal',
			status: 'paid',
			productId: sub.productId,
			provider: event.provider,
			providerPaymentId: event.providerPaymentId,
			providerRefundId: null,
			providerDisputeId: null,
			amount: event.amount ?? 0,
			currency: event.currency ?? '',
			creditsGranted: sub.periodCreditsAmount,
			creditsReversedAt: null,
			paidAt: periodEnd,
			refundedAt: null,
			disputedAt: null,
			createdAt: nowMs,
			updatedAt: nowMs
		})

		const credits = new CreditsService(this.db)
		await credits.grant({
			userId: sub.userId,
			type: 'manual_grant',
			amount: sub.periodCreditsAmount,
			sourceType: 'payment_transaction',
			sourceId: transactionId,
			description: 'Grant credits for subscription renewal'
		})

		await this.db
			.update(userSubscription)
			.set({
				currentPeriodStart: event.periodStart
					? normalizeEventTimeMs(event.periodStart)
					: sub.currentPeriodStart,
				currentPeriodEnd: periodEnd,
				status: 'active',
				canceledAt: null,
				updatedAt: nowMs
			})
			.where(eq(userSubscription.userId, sub.userId))
	}

	private async applySubscriptionUpgrade(
		order: typeof checkoutOrder.$inferSelect,
		event: PaymentEvent
	): Promise<void> {
		if (event.providerSubscriptionId === null) {
			return
		}
		const sub = await this.db.query.userSubscription.findFirst({
			where: eq(userSubscription.userId, order.userId)
		})
		if (!sub) {
			throw new PaymentServiceError('SUBSCRIPTION_NOT_FOUND')
		}

		if (event.providerPaymentId !== null) {
			const duplicated = await this.db.query.paymentTransaction.findFirst({
				where: and(
					eq(paymentTransaction.provider, event.provider),
					eq(paymentTransaction.providerPaymentId, event.providerPaymentId)
				)
			})
			if (duplicated) {
				return
			}
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
		const transactionId = crypto.randomUUID()

		await this.db.insert(paymentTransaction).values({
			id: transactionId,
			userId: sub.userId,
			checkoutOrderId: order.id,
			subscriptionId: sub.userId,
			type: 'subscription_upgrade',
			status: 'paid',
			productId: targetProduct.productId,
			provider: event.provider,
			providerPaymentId: event.providerPaymentId,
			providerRefundId: null,
			providerDisputeId: null,
			amount: event.amount ?? 0,
			currency: event.currency ?? '',
			creditsGranted: creditsDiff,
			creditsReversedAt: null,
			paidAt: nowMs,
			refundedAt: null,
			disputedAt: null,
			createdAt: nowMs,
			updatedAt: nowMs
		})

		if (creditsDiff > 0) {
			const credits = new CreditsService(this.db)
			await credits.grant({
				userId: sub.userId,
				type: 'manual_grant',
				amount: creditsDiff,
				sourceType: 'payment_transaction',
				sourceId: transactionId,
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
				status: 'active',
				canceledAt: null,
				updatedAt: nowMs
			})
			.where(eq(userSubscription.userId, sub.userId))

		await this.db
			.update(checkoutOrder)
			.set({
				status: 'completed',
				providerPaymentId: event.providerPaymentId,
				updatedAt: nowMs
			})
			.where(eq(checkoutOrder.id, order.id))
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

export function createPaymentServiceFromEnv(
	db: AppDb,
	env: Record<string, string | undefined>
): PaymentService {
	const config = parsePaymentConfig(env)
	const providerRouter = new PaymentProviderRouter({
		defaultProvider: config.defaultProvider,
		providerCountryOverrides: config.providerCountryOverrides
	})

	const providers: PaymentProviderMap = {
		dodo: createDodoPaymentProviderFromEnv(env),
		creem: createCreemPaymentProviderFromEnv(env)
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
		: `https://${appDomain}`
	const url = new URL(returnPath, base)
	if (checkoutOrderId !== '') {
		url.searchParams.set('checkout_order_id', checkoutOrderId)
	}
	return url.toString()
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
