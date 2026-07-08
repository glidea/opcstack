import { Hono, type Context } from 'hono'
import { adminUserMiddleware, authMiddleware } from './middleware/auth'
import { emailAuthMiddleware } from './middleware/email-auth'
import { betaGateMiddleware } from './middleware/beta-gate'
import { metaDbSessionMiddleware } from './middleware/meta-db-session'
import { tenantDbMiddleware } from './middleware/tenant-db'
import {
	bindBetaCodeHandler,
	generateBetaCodesHandler,
	listBetaCodesHandler
} from './handler/beta'
import {
	dailyCheckinHandler,
	generateCreditCodesHandler,
	grantCreditsHandler,
	getCreditSummaryHandler,
	listCreditCodesHandler,
	listCreditTransactionsHandler,
	redeemCreditCodeHandler
} from './handler/credits'
import { bindAffHandler, getAffSummaryHandler } from './handler/aff'
import { listFeedbacksHandler, submitFeedbackHandler } from './handler/feedback'
import {
	createNotificationHandler,
	listNotificationsHandler,
	readNotificationHandler
} from './handler/notification'
import {
	cancelSubscriptionHandler,
	createPaymentCheckoutHandler,
	creemWebhookHandler,
	dodoWebhookHandler,
	getSubscriptionHandler,
	listAdminPaymentTransactionsHandler,
	listPaymentProductsHandler,
	listPaymentTransactionsHandler,
	upgradeSubscriptionHandler
} from './handler/payment'
import { aiRealtimeConnectHandler } from './handler/ai-realtime'
import {
	readR2ImageOriginHandler,
	readR2ObjectHandler,
	uploadR2ObjectHandler,
	uploadR2PublicObjectHandler
} from './handler/r2'
import { authCore } from './auth'
import { logError } from '../lib/log'
import type { ApiErrorResponse } from '../../api-contract/common'
import type { MetaDb, TenantShardDb } from '../db'

export type ApiEnv = {
	Bindings: Env
	Variables: {
		userId: string
		metaDb: MetaDb
		tenantDb: TenantShardDb
		tenantShardId: string
	}
}

const publicApi: Hono<ApiEnv> = new Hono<ApiEnv>()
publicApi.use('/auth/*', emailAuthMiddleware)

publicApi.get('/health', (ctx): Response => {
	return ctx.json({})
})

publicApi.all('/auth/*', async (ctx): Promise<Response> => {
	const h = authCore(ctx.env, ctx.get('metaDb')).handler
	return h(ctx.req.raw)
})

publicApi.post('/list_payment_products', listPaymentProductsHandler)
publicApi.post('/webhook/dodo', dodoWebhookHandler)
publicApi.post('/webhook/creem', creemWebhookHandler)
publicApi.get('/r2/public/*', readR2ObjectHandler)
publicApi.get('/r2/tmp/public/*', readR2ObjectHandler)
publicApi.get('/internal/r2_image_origin/*', readR2ImageOriginHandler)

const authOnlyApi: Hono<ApiEnv> = new Hono<ApiEnv>()
authOnlyApi.post('/bind_beta_code', authMiddleware, bindBetaCodeHandler)

const adminApi: Hono<ApiEnv> = new Hono<ApiEnv>()
adminApi.use('/admin/*', adminUserMiddleware)
adminApi.post('/admin/generate_beta_codes', generateBetaCodesHandler)
adminApi.post('/admin/list_beta_codes', listBetaCodesHandler)
adminApi.post('/admin/generate_credit_codes', generateCreditCodesHandler)
adminApi.post('/admin/list_credit_codes', listCreditCodesHandler)
adminApi.post('/admin/grant_credits', grantCreditsHandler)
adminApi.post('/admin/list_feedbacks', listFeedbacksHandler)
adminApi.post('/admin/create_notification', createNotificationHandler)
adminApi.post('/admin/list_payment_transactions', listAdminPaymentTransactionsHandler)
adminApi.put('/admin/r2/public/*', uploadR2PublicObjectHandler)
adminApi.get('/admin/ai_realtime_connect', aiRealtimeConnectHandler)

const userApi: Hono<ApiEnv> = new Hono<ApiEnv>()
userApi.use('*', authMiddleware, betaGateMiddleware, tenantDbMiddleware)
userApi.get('/r2/private/*', readR2ObjectHandler)
userApi.get('/r2/tmp/private/*', readR2ObjectHandler)
userApi.put('/r2/private/*', uploadR2ObjectHandler)
userApi.put('/r2/tmp/private/*', uploadR2ObjectHandler)
userApi.post('/get_credit_summary', getCreditSummaryHandler)
userApi.post(
	'/list_credit_transactions',
	listCreditTransactionsHandler
)
userApi.post('/daily_checkin', dailyCheckinHandler)
userApi.post('/get_aff_summary', getAffSummaryHandler)
userApi.post('/bind_aff', bindAffHandler)
userApi.post('/redeem_credit_code', redeemCreditCodeHandler)
userApi.post('/submit_feedback', submitFeedbackHandler)
userApi.post('/list_notifications', listNotificationsHandler)
userApi.post('/read_notification', readNotificationHandler)
userApi.post('/create_payment_checkout', createPaymentCheckoutHandler)
userApi.post('/get_subscription', getSubscriptionHandler)
userApi.post('/cancel_subscription', cancelSubscriptionHandler)
userApi.post('/upgrade_subscription', upgradeSubscriptionHandler)
userApi.post('/list_payment_transactions', listPaymentTransactionsHandler)

export const api: Hono<ApiEnv> = new Hono<ApiEnv>()
api.use('/api/*', metaDbSessionMiddleware)
api.route('/api', publicApi)
api.route('/api', authOnlyApi)
api.route('/api', adminApi)
api.route('/api', userApi)
api.onError(handleApiError)

export function handleApiError(error: Error, ctx: Context<ApiEnv>): Response {
	logError(error, {
		method: ctx.req.method,
		path: ctx.req.path
	})
	return ctx.json({
		code: 'INTERNAL_ERROR',
		message: 'Internal error'
	} satisfies ApiErrorResponse, 500)
}
