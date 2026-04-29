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
api.use('/api/*', authMiddleware)
api.use('/api/*', betaGateMiddleware)
api.use('/api/auth/*', emailAuthMiddleware)

api.get('/api/health', (ctx): Response => {
	return ctx.json({})
})

api.all('/api/auth/*', async (ctx): Promise<Response> => {
	const h = authCore(ctx.env, ctx.get('db')).handler
	return h(ctx.req.raw)
})

api.post('/api/get_public_config', (ctx): Response => {
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

api.get('/api/r2/*', readR2ObjectHandler)

api.post('/api/bind_beta_code', bindBetaCodeHandler)
api.post('/api/admin/generate_beta_codes', adminSecretMiddleware, generateBetaCodesHandler)
api.post('/api/admin/list_beta_codes', adminSecretMiddleware, listBetaCodesHandler)
api.post('/api/get_credit_summary', getCreditSummaryHandler)
api.post('/api/list_credit_transactions', listCreditTransactionsHandler)
api.post('/api/daily_checkin', dailyCheckinHandler)
api.post('/api/bind_referral', bindReferralHandler)
api.post('/api/admin/generate_credit_codes', adminSecretMiddleware, generateCreditCodesHandler)
api.post('/api/admin/list_credit_codes', adminSecretMiddleware, listCreditCodesHandler)
api.post('/api/admin/grant_credits', adminSecretMiddleware, grantCreditsHandler)
api.post('/api/redeem_credit_code', redeemCreditCodeHandler)
api.post('/api/submit_feedback', submitFeedbackHandler)
api.post('/api/admin/list_feedbacks', adminSecretMiddleware, listFeedbacksHandler)
api.post('/api/admin/create_notification', adminSecretMiddleware, createNotificationHandler)
api.post('/api/list_notifications', listNotificationsHandler)
api.post('/api/read_notification', readNotificationHandler)
