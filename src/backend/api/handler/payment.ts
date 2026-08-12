import type { Context } from 'hono'
import type { ApiEnv } from '..'
import {
	CancelSubscriptionApi,
	CreatePaymentCheckoutApi,
	ListAdminPaymentTransactionsApi,
	ListPaymentTransactionsApi,
	UpgradeSubscriptionApi
} from '../../../api-contract/payment'
import { parseRequest } from '../../lib/request'
import {
	createPaymentService,
	PAYMENT_PROVIDER_CREEM,
	PAYMENT_PROVIDER_DODO,
	PaymentServiceError,
	type PaymentProviderName
} from '../../payment'
import { PaymentProviderError } from '../../payment/contract'
import { formatDecimal } from '../../lib/decimal'
import { logWarn } from '../../lib/log'

export async function listPaymentProductsHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const service = await createPaymentService(ctx.get('metaDb'), ctx.env)
	const country = readCountryCode(ctx)
	const items = await service.listPaymentProducts({
		country
	})
	return ctx.json({
		items: items.map((row) => {
			return {
				product_id: row.productId,
				type: row.type,
				name: row.name,
				description: row.description,
				price_amount: row.priceAmount,
				currency: row.currency,
				credits_amount: formatNullableCreditAmount(row.creditsAmount),
				subscription_plan: row.subscriptionPlan,
				upgrade_rank: row.upgradeRank,
				period_credits_amount: formatNullableCreditAmount(row.periodCreditsAmount)
			}
		})
	})
}

export async function createPaymentCheckoutHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, CreatePaymentCheckoutApi.request)
	if (!request.success) {
		const error = CreatePaymentCheckoutApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	const req = request.data

	const service = await createPaymentService(ctx.get('metaDb'), ctx.env)
	try {
		const result = await service.createPaymentCheckout({
			userId: ctx.get('userId'),
			productId: req.product_id,
			returnPath: req.return_path ?? null,
			country: readCountryCode(ctx),
			appDomain: String(ctx.env.APP_DOMAIN ?? '')
		})
		return ctx.json({
			checkout_order_id: result.checkoutOrderId,
			checkout_url: result.checkoutUrl
		})
	} catch (error) {
		if (error instanceof PaymentServiceError) {
			switch (error.code) {
				case 'PAYMENT_DISABLED': {
					const response = CreatePaymentCheckoutApi.errors.PAYMENT_DISABLED()
					return ctx.json(response.body, response.status)
				}
				case 'PAYMENT_PRODUCT_NOT_FOUND': {
					const response = CreatePaymentCheckoutApi.errors.PAYMENT_PRODUCT_NOT_FOUND()
					return ctx.json(response.body, response.status)
				}
				case 'PAYMENT_RETURN_PATH_INVALID': {
					const response = CreatePaymentCheckoutApi.errors.PAYMENT_RETURN_PATH_INVALID()
					return ctx.json(response.body, response.status)
				}
				default:
					break
			}
		}
		throw error
	}
}

export async function getSubscriptionHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const service = await createPaymentService(ctx.get('metaDb'), ctx.env)
	const result = await service.getSubscription({
		userId: ctx.get('userId')
	})
	return ctx.json({
		subscription_plan: result.subscriptionPlan,
		subscription:
			result.subscription === null
				? null
				: {
					product_id: result.subscription.productId,
					status: result.subscription.status,
					current_period_start: result.subscription.currentPeriodStart,
					current_period_end: result.subscription.currentPeriodEnd,
					canceled_at: result.subscription.canceledAt
				}
	})
}

export async function cancelSubscriptionHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const service = await createPaymentService(ctx.get('metaDb'), ctx.env)
	try {
		const result = await service.cancelSubscription({
			userId: ctx.get('userId')
		})
		return ctx.json({
			status: result.status,
			current_period_end: result.currentPeriodEnd,
			canceled_at: result.canceledAt
		})
	} catch (error) {
		if (error instanceof PaymentServiceError) {
			switch (error.code) {
				case 'SUBSCRIPTION_NOT_FOUND': {
					const response = CancelSubscriptionApi.errors.SUBSCRIPTION_NOT_FOUND()
					return ctx.json(response.body, response.status)
				}
				case 'SUBSCRIPTION_ALREADY_CANCELED': {
					const response = CancelSubscriptionApi.errors.SUBSCRIPTION_ALREADY_CANCELED()
					return ctx.json(response.body, response.status)
				}
				default:
					break
			}
		}
		throw error
	}
}

export async function upgradeSubscriptionHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, UpgradeSubscriptionApi.request)
	if (!request.success) {
		const error = UpgradeSubscriptionApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	const req = request.data

	const service = await createPaymentService(ctx.get('metaDb'), ctx.env)
	try {
		const result = await service.upgradeSubscription({
			userId: ctx.get('userId'),
			productId: req.product_id
		})
		return ctx.json({
			status: result.status
		})
	} catch (error) {
		if (error instanceof PaymentServiceError) {
			switch (error.code) {
				case 'PAYMENT_DISABLED': {
					const response = UpgradeSubscriptionApi.errors.PAYMENT_DISABLED()
					return ctx.json(response.body, response.status)
				}
				case 'SUBSCRIPTION_NOT_FOUND': {
					const response = UpgradeSubscriptionApi.errors.SUBSCRIPTION_NOT_FOUND()
					return ctx.json(response.body, response.status)
				}
				case 'SUBSCRIPTION_NOT_ACTIVE': {
					const response = UpgradeSubscriptionApi.errors.SUBSCRIPTION_NOT_ACTIVE()
					return ctx.json(response.body, response.status)
				}
				case 'SUBSCRIPTION_TARGET_INVALID': {
					const response = UpgradeSubscriptionApi.errors.SUBSCRIPTION_TARGET_INVALID()
					return ctx.json(response.body, response.status)
				}
				case 'SUBSCRIPTION_CURRENT_INVALID': {
					const response = UpgradeSubscriptionApi.errors.SUBSCRIPTION_CURRENT_INVALID()
					return ctx.json(response.body, response.status)
				}
				case 'SUBSCRIPTION_UPGRADE_NOT_ALLOWED': {
					const response = UpgradeSubscriptionApi.errors.SUBSCRIPTION_UPGRADE_NOT_ALLOWED()
					return ctx.json(response.body, response.status)
				}
				case 'PAYMENT_PRODUCT_NOT_FOUND': {
					const response = UpgradeSubscriptionApi.errors.PAYMENT_PRODUCT_NOT_FOUND()
					return ctx.json(response.body, response.status)
				}
				default:
					break
			}
		}
		throw error
	}
}

export async function listPaymentTransactionsHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, ListPaymentTransactionsApi.request)
	if (!request.success) {
		const error = ListPaymentTransactionsApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	const req = request.data
	const service = await createPaymentService(ctx.get('metaDb'), ctx.env)
	const result = await service.listPaymentTransactions({
		userId: ctx.get('userId'),
		page: req.page,
		pageSize: req.page_size,
		type: req.type,
		status: req.status
	})
	return ctx.json({
		items: result.items.map((row) => {
			return {
				id: row.id,
				type: row.type,
				status: row.status,
				product_id: row.productId,
				amount: row.amount,
				currency: row.currency,
				credits_granted: formatDecimal(row.creditsGranted),
				paid_at: row.paidAt,
				refunded_at: row.refundedAt,
				disputed_at: row.disputedAt,
				created_at: row.createdAt
			}
		}),
		total: result.total
	})
}

export async function listAdminPaymentTransactionsHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, ListAdminPaymentTransactionsApi.request)
	if (!request.success) {
		const error = ListAdminPaymentTransactionsApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	const req = request.data
	const service = await createPaymentService(ctx.get('metaDb'), ctx.env)
	const result = await service.listAdminPaymentTransactions({
		page: req.page,
		pageSize: req.page_size,
		userId: req.user_id,
		type: req.type,
		status: req.status
	})
	return ctx.json({
		items: result.items.map((row) => {
			return {
				id: row.id,
				user_id: row.userId,
				type: row.type,
				status: row.status,
				product_id: row.productId,
				amount: row.amount,
				currency: row.currency,
				credits_granted: formatDecimal(row.creditsGranted),
				paid_at: row.paidAt,
				refunded_at: row.refundedAt,
				disputed_at: row.disputedAt,
				created_at: row.createdAt
			}
		}),
		total: result.total
	})
}

export async function dodoWebhookHandler(ctx: Context<ApiEnv>): Promise<Response> {
	return processWebhook(ctx, PAYMENT_PROVIDER_DODO)
}

export async function creemWebhookHandler(ctx: Context<ApiEnv>): Promise<Response> {
	return processWebhook(ctx, PAYMENT_PROVIDER_CREEM)
}

async function processWebhook(
	ctx: Context<ApiEnv>,
	provider: PaymentProviderName
): Promise<Response> {
	const service = await createPaymentService(ctx.get('metaDb'), ctx.env)
	const rawBody = await ctx.req.raw.text()
	try {
		await service.processWebhook(provider, rawBody, ctx.req.raw.headers)
		return ctx.json({})
	} catch (error) {
		if (error instanceof PaymentProviderError) {
			switch (error.code) {
				case 'DODO_WEBHOOK_SIGNATURE_INVALID':
				case 'CREEM_WEBHOOK_SIGNATURE_INVALID':
					logWarn(error, {
						provider
					})
					return ctx.json({ code: error.code, message: error.message }, 400)
				default:
					break
			}
		}
		throw error
	}
}

function formatNullableCreditAmount(units: number | null): string | null {
	if (units === null) {
		return null
	}
	return formatDecimal(units)
}

function readCountryCode(ctx: Context<ApiEnv>): string | null {
	const raw = ctx.req.raw as Request & { cf?: { country?: string } }
	return raw.cf?.country ?? null
}
