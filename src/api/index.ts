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
	bindReferralHandler,
	dailyCheckinHandler,
	generateCreditCodesHandler,
	grantCreditsHandler,
	getCreditSummaryHandler,
	listCreditCodesHandler,
	listCreditTransactionsHandler,
	redeemCreditCodeHandler
} from './handler/credits'
import { listFeedbacksHandler, submitFeedbackHandler } from './handler/feedback'
import {
	createNotificationHandler,
	listNotificationsHandler,
	readNotificationHandler
} from './handler/notification'
import { readR2ObjectHandler } from './handler/r2'
import { authCore } from './auth'
import type { AppDb } from '../db'

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
	const envMap = ctx.env as unknown as Record<string, string | undefined>
	return ctx.json({
		beta_code_enabled: String(ctx.env.BETA_CODE_ENABLED) === 'true',
		google_auth_enabled: String(ctx.env.GOOGLE_AUTH_ENABLED) === 'true',
		email_enabled: String(ctx.env.EMAIL_ENABLED) === 'true',
		email_signup_enabled: String(ctx.env.EMAIL_SIGNUP_ENABLED) === 'true',
		email_require_verification: String(ctx.env.EMAIL_REQUIRE_VERIFICATION) === 'true',
		email_user_action_cooldown_seconds: Number(ctx.env.EMAIL_USER_ACTION_COOLDOWN_SECONDS),
		credits_signup_enabled: envMap['CREDITS_SIGNUP_ENABLED'] === 'true',
		credits_signup_amount: Number(envMap['CREDITS_SIGNUP_AMOUNT'] ?? '0'),
		credits_daily_checkin_enabled: envMap['CREDITS_DAILY_CHECKIN_ENABLED'] === 'true',
		credits_daily_checkin_amount: Number(envMap['CREDITS_DAILY_CHECKIN_AMOUNT'] ?? '0'),
		credits_referral_enabled: envMap['CREDITS_REFERRAL_ENABLED'] === 'true'
	})
})
publicApi.get('/r2/public/*', readR2ObjectHandler)

const authOnlyApi: Hono<ApiEnv> = new Hono<ApiEnv>()
authOnlyApi.use('*', authMiddleware)
authOnlyApi.post('/bind_beta_code', bindBetaCodeHandler)

const adminApi: Hono<ApiEnv> = new Hono<ApiEnv>()
adminApi.use('/admin/*', adminSecretMiddleware)
adminApi.post('/admin/generate_beta_codes', generateBetaCodesHandler)
adminApi.post('/admin/list_beta_codes', listBetaCodesHandler)
adminApi.post('/admin/generate_credit_codes', generateCreditCodesHandler)
adminApi.post('/admin/list_credit_codes', listCreditCodesHandler)
adminApi.post('/admin/grant_credits', grantCreditsHandler)
adminApi.post('/admin/list_feedbacks', listFeedbacksHandler)
adminApi.post('/admin/create_notification', createNotificationHandler)

const userApi: Hono<ApiEnv> = new Hono<ApiEnv>()
userApi.use('*', authMiddleware)
userApi.use('*', betaGateMiddleware)
userApi.get('/r2/private/*', readR2ObjectHandler)
userApi.post('/get_credit_summary', getCreditSummaryHandler)
userApi.post('/list_credit_transactions', listCreditTransactionsHandler)
userApi.post('/daily_checkin', dailyCheckinHandler)
userApi.post('/bind_referral', bindReferralHandler)
userApi.post('/redeem_credit_code', redeemCreditCodeHandler)
userApi.post('/submit_feedback', submitFeedbackHandler)
userApi.post('/list_notifications', listNotificationsHandler)
userApi.post('/read_notification', readNotificationHandler)

api.route('/api', publicApi)
api.route('/api', authOnlyApi)
api.route('/api', adminApi)
api.route('/api', userApi)
