import { Hono, type Context } from 'hono'
import {
	administratorMiddleware,
	authConfigMiddleware,
	authMiddleware,
	browserSessionOnlyMiddleware,
	requireApiScope,
	type OAuthAuthorization
} from './middleware/auth'
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
	listAdminCreditTransactionsHandler,
	listCreditCodesHandler,
	listCreditTransactionsHandler,
	redeemCreditCodeHandler
} from './handler/credits'
import { bindAffiliateHandler, getAffiliateSummaryHandler, listAdminAffiliateReferralsHandler } from './handler/affiliate'
import { listFeedbacksHandler, submitFeedbackHandler } from './handler/feedback'
import {
	archiveNotificationHandler,
	createNotificationHandler,
	listAdminNotificationsHandler,
	listNotificationsHandler,
	readNotificationHandler,
	updateNotificationHandler
} from './handler/notifications'
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
import {
	readR2ImageOriginHandler,
	readR2ObjectHandler,
	uploadR2ObjectHandler,
	uploadR2PublicObjectHandler
} from './handler/r2'
import {
	aiRealtimeConnectHandler,
	getAITaskHandler,
	listAITasksHandler
} from './handler/ai'
import { getDashboardHandler } from './handler/dashboard'
import { listUsersHandler } from './handler/users'
import {
	createAIProviderHandler,
	createPaymentProductHandler,
	deleteAIProviderHandler,
	deletePaymentProductHandler,
	getAIConfigHandler,
	getAuthenticationConfigHandler,
	getAffiliateConfigHandler,
	getCreditsConfigHandler,
	getEmailConfigHandler,
	getGeneralConfigHandler,
	getPaymentConfigHandler,
	listRemotePaymentProductsHandler,
	updateAIProviderHandler,
	updateAIConfigHandler,
	updateAuthenticationConfigHandler,
	updateAffiliateConfigHandler,
	updateCreditsConfigHandler,
	updateEmailConfigHandler,
	updateGeneralConfigHandler,
	updatePaymentConfigHandler,
	updatePaymentProductHandler
} from './handler/configuration'
import { authCore } from './auth'
import { logError } from '../lib/log'
import type { ApiErrorResponse } from '../../api-contract/common'
import type { MetaDb, TenantShardDb } from '../db'
import {
	createOAuthAuthorizationHandler,
	getOAuthAuthorizationDetailsHandler,
	listOAuthGrantsHandler,
	oauthAuthorizationCallbackHandler,
	pollOAuthAuthorizationHandler,
	resolveOAuthAuthorizationHandler,
	revokeOAuthGrantHandler
} from './handler/oauth-api-access'

export type ApiEnv = {
	Bindings: Env
	Variables: {
		userId: string
		oauthAuthorization: OAuthAuthorization | undefined
		metaDb: MetaDb
		tenantDb: TenantShardDb
		tenantShardId: string
		authRuntimeConfig: import('../config').AuthRuntimeConfig | undefined
	}
}

const publicApi: Hono<ApiEnv> = new Hono<ApiEnv>()
publicApi.use('/auth/*', authConfigMiddleware, emailAuthMiddleware)

publicApi.get('/health', (ctx): Response => {
	return ctx.json({})
})

publicApi.post('/oauth/create_authorization', createOAuthAuthorizationHandler)
publicApi.post('/oauth/poll_authorization', pollOAuthAuthorizationHandler)
publicApi.post('/oauth/resolve_authorization', resolveOAuthAuthorizationHandler)
publicApi.get('/oauth/authorization_callback', oauthAuthorizationCallbackHandler)

publicApi.all('/auth/*', async (ctx): Promise<Response> => {
	const h = authCore(ctx.env, ctx.get('metaDb'), ctx.get('authRuntimeConfig')!).handler
	return h(ctx.req.raw)
})

publicApi.post('/list_payment_products', listPaymentProductsHandler)
publicApi.post('/webhook/dodo', dodoWebhookHandler)
publicApi.post('/webhook/creem', creemWebhookHandler)
publicApi.get('/r2/public/*', readR2ObjectHandler)
publicApi.get('/r2/tmp/public/*', readR2ObjectHandler)
publicApi.get('/internal/r2_image_origin/*', readR2ImageOriginHandler)

const authOnlyApi: Hono<ApiEnv> = new Hono<ApiEnv>()
authOnlyApi.post(
	'/bind_beta_code',
	authMiddleware,
	requireApiScope('account:write'),
	bindBetaCodeHandler
)
authOnlyApi.post(
	'/oauth/get_authorization_details',
	authMiddleware,
	browserSessionOnlyMiddleware,
	getOAuthAuthorizationDetailsHandler
)
authOnlyApi.post(
	'/oauth/list_grants',
	authMiddleware,
	browserSessionOnlyMiddleware,
	listOAuthGrantsHandler
)
authOnlyApi.post(
	'/oauth/revoke_grant',
	authMiddleware,
	browserSessionOnlyMiddleware,
	revokeOAuthGrantHandler
)

const adminApi: Hono<ApiEnv> = new Hono<ApiEnv>()
adminApi.use('/admin/*', authMiddleware, administratorMiddleware)
adminApi.post('/admin/list_users', requireApiScope('admin:users:read'), listUsersHandler)
adminApi.post('/admin/generate_beta_codes', requireApiScope('admin:beta:write'), generateBetaCodesHandler)
adminApi.post('/admin/list_beta_codes', requireApiScope('admin:beta:read'), listBetaCodesHandler)
adminApi.post('/admin/generate_credit_codes', requireApiScope('admin:credits:write'), generateCreditCodesHandler)
adminApi.post('/admin/list_credit_codes', requireApiScope('admin:credits:read'), listCreditCodesHandler)
adminApi.post('/admin/grant_credits', requireApiScope('admin:credits:write'), grantCreditsHandler)
adminApi.post('/admin/list_credit_transactions', requireApiScope('admin:credits:read'), listAdminCreditTransactionsHandler)
adminApi.post('/admin/list_affiliate_referrals', requireApiScope('admin:affiliate:read'), listAdminAffiliateReferralsHandler)
adminApi.post('/admin/list_feedbacks', requireApiScope('admin:feedback:read'), listFeedbacksHandler)
adminApi.post('/admin/create_notification', requireApiScope('admin:notifications:write'), createNotificationHandler)
adminApi.post('/admin/list_notifications', requireApiScope('admin:notifications:read'), listAdminNotificationsHandler)
adminApi.post('/admin/update_notification', requireApiScope('admin:notifications:write'), updateNotificationHandler)
adminApi.post('/admin/archive_notification', requireApiScope('admin:notifications:write'), archiveNotificationHandler)
adminApi.post('/admin/list_payment_transactions', requireApiScope('admin:payment:read'), listAdminPaymentTransactionsHandler)
adminApi.post('/admin/list_ai_tasks', requireApiScope('admin:ai:read'), listAITasksHandler)
adminApi.post('/admin/get_ai_task', requireApiScope('admin:ai:read'), getAITaskHandler)
adminApi.post('/admin/get_dashboard', requireApiScope('admin:dashboard:read'), getDashboardHandler)
adminApi.post('/admin/get_general_config', requireApiScope('config:general:read'), getGeneralConfigHandler)
adminApi.post('/admin/update_general_config', requireApiScope('config:general:write'), updateGeneralConfigHandler)
adminApi.post('/admin/get_authentication_config', requireApiScope('config:authentication:read'), getAuthenticationConfigHandler)
adminApi.post('/admin/update_authentication_config', requireApiScope('config:authentication:write'), updateAuthenticationConfigHandler)
adminApi.post('/admin/get_email_config', requireApiScope('config:email:read'), getEmailConfigHandler)
adminApi.post('/admin/update_email_config', requireApiScope('config:email:write'), updateEmailConfigHandler)
adminApi.post('/admin/get_credits_config', requireApiScope('config:credits:read'), getCreditsConfigHandler)
adminApi.post('/admin/update_credits_config', requireApiScope('config:credits:write'), updateCreditsConfigHandler)
adminApi.post('/admin/get_affiliate_config', requireApiScope('config:affiliate:read'), getAffiliateConfigHandler)
adminApi.post('/admin/update_affiliate_config', requireApiScope('config:affiliate:write'), updateAffiliateConfigHandler)
adminApi.post('/admin/get_payment_config', requireApiScope('config:payment:read'), getPaymentConfigHandler)
adminApi.post('/admin/list_remote_payment_products', requireApiScope('config:payment:read'), listRemotePaymentProductsHandler)
adminApi.post('/admin/update_payment_config', requireApiScope('config:payment:write'), updatePaymentConfigHandler)
adminApi.post('/admin/create_payment_product', requireApiScope('config:payment:write'), createPaymentProductHandler)
adminApi.post('/admin/update_payment_product', requireApiScope('config:payment:write'), updatePaymentProductHandler)
adminApi.post('/admin/delete_payment_product', requireApiScope('config:payment:write'), deletePaymentProductHandler)
adminApi.post('/admin/get_ai_config', requireApiScope('config:ai:read'), getAIConfigHandler)
adminApi.post('/admin/update_ai_config', requireApiScope('config:ai:write'), updateAIConfigHandler)
adminApi.post('/admin/create_ai_provider', requireApiScope('config:ai:write'), createAIProviderHandler)
adminApi.post('/admin/update_ai_provider', requireApiScope('config:ai:write'), updateAIProviderHandler)
adminApi.post('/admin/delete_ai_provider', requireApiScope('config:ai:write'), deleteAIProviderHandler)
adminApi.put('/admin/r2/public/*', browserSessionOnlyMiddleware, uploadR2PublicObjectHandler)
adminApi.get('/admin/ai_realtime_connect', browserSessionOnlyMiddleware, aiRealtimeConnectHandler)

const userApi: Hono<ApiEnv> = new Hono<ApiEnv>()
userApi.use('*', authMiddleware, betaGateMiddleware, tenantDbMiddleware)
userApi.get('/r2/private/*', browserSessionOnlyMiddleware, readR2ObjectHandler)
userApi.get('/r2/tmp/private/*', browserSessionOnlyMiddleware, readR2ObjectHandler)
userApi.put('/r2/private/*', browserSessionOnlyMiddleware, uploadR2ObjectHandler)
userApi.put('/r2/tmp/private/*', browserSessionOnlyMiddleware, uploadR2ObjectHandler)
userApi.post('/get_credit_summary', requireApiScope('credits:read'), getCreditSummaryHandler)
userApi.post(
	'/list_credit_transactions',
	requireApiScope('credits:read'),
	listCreditTransactionsHandler
)
userApi.post('/daily_checkin', requireApiScope('credits:write'), dailyCheckinHandler)
userApi.post('/get_affiliate_summary', requireApiScope('affiliate:read'), getAffiliateSummaryHandler)
userApi.post('/bind_affiliate', requireApiScope('affiliate:write'), bindAffiliateHandler)
userApi.post('/redeem_credit_code', requireApiScope('credits:write'), redeemCreditCodeHandler)
userApi.post('/submit_feedback', requireApiScope('feedback:write'), submitFeedbackHandler)
userApi.post('/list_notifications', requireApiScope('notifications:read'), listNotificationsHandler)
userApi.post('/read_notification', requireApiScope('notifications:write'), readNotificationHandler)
userApi.post('/create_payment_checkout', requireApiScope('payment:write'), createPaymentCheckoutHandler)
userApi.post('/get_subscription', requireApiScope('payment:read'), getSubscriptionHandler)
userApi.post('/cancel_subscription', requireApiScope('payment:write'), cancelSubscriptionHandler)
userApi.post('/upgrade_subscription', requireApiScope('payment:write'), upgradeSubscriptionHandler)
userApi.post('/list_payment_transactions', requireApiScope('payment:read'), listPaymentTransactionsHandler)

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
