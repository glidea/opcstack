import { Hono } from 'hono'
import { adminSecretMiddleware, authMiddleware } from './middleware/auth'
import { emailAuthMiddleware } from './middleware/email-auth'
import { betaGateMiddleware } from './middleware/beta-gate'
import { d1SessionMiddleware } from './middleware/d1-session'
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
import { readR2ObjectHandler } from './handler/r2'
import { authCore } from './auth'
import type { AppDb } from '../db'
import { formatDecimal, parseDecimal } from '../lib/decimal'

export type ApiEnv = {
	Bindings: Env
	Variables: {
		userId: string
		db: AppDb
	}
}

export const api: Hono<ApiEnv> = new Hono<ApiEnv>()
api.use('/api/*', d1SessionMiddleware)

const publicApi: Hono<ApiEnv> = new Hono<ApiEnv>()
publicApi.use('/auth/*', emailAuthMiddleware)

publicApi.get('/health', (ctx): Response => {
	return ctx.json({})
})

publicApi.all('/auth/*', async (ctx): Promise<Response> => {
	const h = authCore(ctx.env, ctx.get('db')).handler
	return h(ctx.req.raw)
})

publicApi.post('/get_public_config', (ctx): Response => {
	const env = ctx.env
	return ctx.json({
		beta_code_enabled: String(env.BETA_CODE_ENABLED) === 'true',
		google_auth_enabled: String(env.GOOGLE_AUTH_ENABLED) === 'true',
		email_enabled: String(env.EMAIL_ENABLED) === 'true',
		email_signup_enabled: String(env.EMAIL_SIGNUP_ENABLED) === 'true',
		email_require_verification: String(env.EMAIL_REQUIRE_VERIFICATION) === 'true',
		email_user_action_cooldown_seconds: Number(env.EMAIL_USER_ACTION_COOLDOWN_SECONDS),
		credits_signup_enabled: String(env.CREDITS_SIGNUP_ENABLED) === 'true',
		credits_signup_amount: formatDecimal(parseDecimal(env.CREDITS_SIGNUP_AMOUNT)),
		credits_daily_checkin_enabled: String(env.CREDITS_DAILY_CHECKIN_ENABLED) === 'true',
		credits_daily_checkin_amount: formatDecimal(parseDecimal(env.CREDITS_DAILY_CHECKIN_AMOUNT)),
		aff_enabled: String(env.AFF_ENABLED) === 'true',
		payment_enabled: String(env.PAYMENT_ENABLED) === 'true'
	})
})
publicApi.post('/list_payment_products', listPaymentProductsHandler)
publicApi.post('/webhook/dodo', dodoWebhookHandler)
publicApi.post('/webhook/creem', creemWebhookHandler)
publicApi.get('/r2/public/*', readR2ObjectHandler)

const authOnlyApi: Hono<ApiEnv> = new Hono<ApiEnv>()
authOnlyApi.post('/bind_beta_code', authMiddleware, bindBetaCodeHandler)

const adminApi: Hono<ApiEnv> = new Hono<ApiEnv>()
adminApi.use('/admin/*', adminSecretMiddleware)
adminApi.post('/admin/generate_beta_codes', generateBetaCodesHandler)
adminApi.post('/admin/list_beta_codes', listBetaCodesHandler)
adminApi.post('/admin/generate_credit_codes', generateCreditCodesHandler)
adminApi.post('/admin/list_credit_codes', listCreditCodesHandler)
adminApi.post('/admin/grant_credits', grantCreditsHandler)
adminApi.post('/admin/list_feedbacks', listFeedbacksHandler)
adminApi.post('/admin/create_notification', createNotificationHandler)
adminApi.post('/admin/list_payment_transactions', listAdminPaymentTransactionsHandler)

const userApi: Hono<ApiEnv> = new Hono<ApiEnv>()
userApi.get('/r2/private/*', authMiddleware, betaGateMiddleware, readR2ObjectHandler)
userApi.post('/get_credit_summary', authMiddleware, betaGateMiddleware, getCreditSummaryHandler)
userApi.post(
	'/list_credit_transactions',
	authMiddleware,
	betaGateMiddleware,
	listCreditTransactionsHandler
)
userApi.post('/daily_checkin', authMiddleware, betaGateMiddleware, dailyCheckinHandler)
userApi.post('/get_aff_summary', authMiddleware, betaGateMiddleware, getAffSummaryHandler)
userApi.post('/bind_aff', authMiddleware, betaGateMiddleware, bindAffHandler)
userApi.post('/redeem_credit_code', authMiddleware, betaGateMiddleware, redeemCreditCodeHandler)
userApi.post('/submit_feedback', authMiddleware, betaGateMiddleware, submitFeedbackHandler)
userApi.post('/list_notifications', authMiddleware, betaGateMiddleware, listNotificationsHandler)
userApi.post('/read_notification', authMiddleware, betaGateMiddleware, readNotificationHandler)
userApi.post(
	'/create_payment_checkout',
	authMiddleware,
	betaGateMiddleware,
	createPaymentCheckoutHandler
)
userApi.post('/get_subscription', authMiddleware, betaGateMiddleware, getSubscriptionHandler)
userApi.post('/cancel_subscription', authMiddleware, betaGateMiddleware, cancelSubscriptionHandler)
userApi.post('/upgrade_subscription', authMiddleware, betaGateMiddleware, upgradeSubscriptionHandler)
userApi.post(
	'/list_payment_transactions',
	authMiddleware,
	betaGateMiddleware,
	listPaymentTransactionsHandler
)

api.route('/api', publicApi)
api.route('/api', authOnlyApi)
api.route('/api', adminApi)
api.route('/api', userApi)
