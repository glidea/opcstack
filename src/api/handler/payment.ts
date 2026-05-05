import type { Context } from 'hono'
import { z } from 'zod'
import type { ApiEnv } from '..'
import { PageRequestSchema, parse } from './utils'
import { createPaymentServiceFromEnv, PaymentServiceError, type PaymentProviderName } from '../../payment'

const CreatePaymentCheckoutRequestSchema = z.object({
	product_id: z.string().min(1),
	return_path: z.string().min(1).optional()
})

const UpgradeSubscriptionRequestSchema = z.object({
	product_id: z.string().min(1)
})

const ListPaymentTransactionsRequestSchema = PageRequestSchema.extend({
	type: z.string().min(1).optional(),
	status: z.string().min(1).optional()
})

const ListAdminPaymentTransactionsRequestSchema = PageRequestSchema.extend({
	user_id: z.string().min(1).optional(),
	type: z.string().min(1).optional(),
	status: z.string().min(1).optional()
})

export async function listPaymentProductsHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const service = createPaymentServiceFromEnv(ctx.get('db'), toEnvMap(ctx.env))
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
				credits_amount: row.creditsAmount,
				subscription_plan: row.subscriptionPlan,
				upgrade_rank: row.upgradeRank,
				period_credits_amount: row.periodCreditsAmount
			}
		})
	})
}

export async function createPaymentCheckoutHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parse(ctx, CreatePaymentCheckoutRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	const service = createPaymentServiceFromEnv(ctx.get('db'), toEnvMap(ctx.env))
	try {
		const result = await service.createPaymentCheckout({
			userId: ctx.get('userId'),
			productId: req.product_id,
			returnPath: req.return_path ?? null,
			country: readCountryCode(ctx),
			appDomain: String(toEnvMap(ctx.env)['APP_DOMAIN'] ?? '')
		})
		return ctx.json({
			checkout_order_id: result.checkoutOrderId,
			checkout_url: result.checkoutUrl
		})
	} catch (error) {
		const handled = mapPaymentServiceError(ctx, error)
		if (handled) {
			return handled
		}
		throw error
	}
}

export async function getSubscriptionHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const service = createPaymentServiceFromEnv(ctx.get('db'), toEnvMap(ctx.env))
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
	const service = createPaymentServiceFromEnv(ctx.get('db'), toEnvMap(ctx.env))
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
		const handled = mapPaymentServiceError(ctx, error)
		if (handled) {
			return handled
		}
		throw error
	}
}

export async function upgradeSubscriptionHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parse(ctx, UpgradeSubscriptionRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	const service = createPaymentServiceFromEnv(ctx.get('db'), toEnvMap(ctx.env))
	try {
		const result = await service.upgradeSubscription({
			userId: ctx.get('userId'),
			productId: req.product_id
		})
		return ctx.json({
			status: result.status
		})
	} catch (error) {
		const handled = mapPaymentServiceError(ctx, error)
		if (handled) {
			return handled
		}
		throw error
	}
}

export async function listPaymentTransactionsHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parse(ctx, ListPaymentTransactionsRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}
	const service = createPaymentServiceFromEnv(ctx.get('db'), toEnvMap(ctx.env))
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
				credits_granted: row.creditsGranted,
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
	const req = await parse(ctx, ListAdminPaymentTransactionsRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}
	const service = createPaymentServiceFromEnv(ctx.get('db'), toEnvMap(ctx.env))
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
				credits_granted: row.creditsGranted,
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
	return processWebhook(ctx, 'dodo')
}

export async function creemWebhookHandler(ctx: Context<ApiEnv>): Promise<Response> {
	return processWebhook(ctx, 'creem')
}

async function processWebhook(
	ctx: Context<ApiEnv>,
	provider: PaymentProviderName
): Promise<Response> {
	const service = createPaymentServiceFromEnv(ctx.get('db'), toEnvMap(ctx.env))
	const rawBody = await ctx.req.raw.text()
	try {
		await service.processWebhook(provider, rawBody, ctx.req.raw.headers)
		return ctx.json({})
	} catch (error) {
		if (error instanceof Error && error.message.endsWith('_SIGNATURE_INVALID')) {
			return ctx.json({ code: error.message }, 400)
		}
		throw error
	}
}

function mapPaymentServiceError(ctx: Context<ApiEnv>, error: unknown): Response | null {
	if (!(error instanceof PaymentServiceError)) {
		return null
	}
	if (error.code === 'SUBSCRIPTION_NOT_FOUND' || error.code === 'PAYMENT_USER_NOT_FOUND') {
		return ctx.json({ code: error.code }, 404)
	}
	if (error.code === 'SUBSCRIPTION_ALREADY_CANCELED') {
		return ctx.json({ code: error.code }, 409)
	}
	return ctx.json({ code: error.code }, 400)
}

function toEnvMap(env: Env): Record<string, string | undefined> {
	return env as unknown as Record<string, string | undefined>
}

function readCountryCode(ctx: Context<ApiEnv>): string | null {
	const raw = ctx.req.raw as Request & { cf?: { country?: string } }
	return raw.cf?.country ?? null
}
