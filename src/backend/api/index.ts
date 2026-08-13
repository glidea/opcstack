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
	listCreditCodesHandler,
	listCreditTransactionsHandler,
	redeemCreditCodeHandler
} from './handler/credits'
import { bindAffHandler, getAffSummaryHandler } from './handler/aff'
import { listFeedbacksHandler, submitFeedbackHandler } from './handler/feedback'
import {
	archiveNotificationHandler,
	createNotificationHandler,
	listAdminNotificationsHandler,
	listNotificationsHandler,
	readNotificationHandler,
	updateNotificationHandler
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
import {
	getAdminAiTaskHandler,
	listAdminAiTasksHandler
} from './handler/admin-ai-tasks'
import { getAdminOverviewHandler } from './handler/admin-overview'
import { listAdminUsersHandler } from './handler/admin-users'
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
	updateAIProviderHandler,
	updateAIConfigHandler,
	updateAuthenticationConfigHandler,
	updateAffiliateConfigHandler,
	updateCreditsConfigHandler,
	updateEmailConfigHandler,
	updateGeneralConfigHandler,
	updatePaymentConfigHandler,
	updatePaymentProductHandler,
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
import { getProtectedJsonRouteScope } from './scopes'

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
	requireApiScope(getProtectedJsonRouteScope('/api/bind_beta_code')),
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
adminApi.post('/admin/list_users', requireApiScope(getProtectedJsonRouteScope('/api/admin/list_users')), listAdminUsersHandler)
adminApi.post('/admin/generate_beta_codes', requireApiScope(getProtectedJsonRouteScope('/api/admin/generate_beta_codes')), generateBetaCodesHandler)
adminApi.post('/admin/list_beta_codes', requireApiScope(getProtectedJsonRouteScope('/api/admin/list_beta_codes')), listBetaCodesHandler)
adminApi.post('/admin/generate_credit_codes', requireApiScope(getProtectedJsonRouteScope('/api/admin/generate_credit_codes')), generateCreditCodesHandler)
adminApi.post('/admin/list_credit_codes', requireApiScope(getProtectedJsonRouteScope('/api/admin/list_credit_codes')), listCreditCodesHandler)
adminApi.post('/admin/grant_credits', requireApiScope(getProtectedJsonRouteScope('/api/admin/grant_credits')), grantCreditsHandler)
adminApi.post('/admin/list_feedbacks', requireApiScope(getProtectedJsonRouteScope('/api/admin/list_feedbacks')), listFeedbacksHandler)
adminApi.post('/admin/create_notification', requireApiScope(getProtectedJsonRouteScope('/api/admin/create_notification')), createNotificationHandler)
adminApi.post('/admin/list_notifications', requireApiScope(getProtectedJsonRouteScope('/api/admin/list_notifications')), listAdminNotificationsHandler)
adminApi.post('/admin/update_notification', requireApiScope(getProtectedJsonRouteScope('/api/admin/update_notification')), updateNotificationHandler)
adminApi.post('/admin/archive_notification', requireApiScope(getProtectedJsonRouteScope('/api/admin/archive_notification')), archiveNotificationHandler)
adminApi.post('/admin/list_payment_transactions', requireApiScope(getProtectedJsonRouteScope('/api/admin/list_payment_transactions')), listAdminPaymentTransactionsHandler)
adminApi.post('/admin/list_ai_tasks', requireApiScope(getProtectedJsonRouteScope('/api/admin/list_ai_tasks')), listAdminAiTasksHandler)
adminApi.post('/admin/get_ai_task', requireApiScope(getProtectedJsonRouteScope('/api/admin/get_ai_task')), getAdminAiTaskHandler)
adminApi.post('/admin/get_overview', requireApiScope(getProtectedJsonRouteScope('/api/admin/get_overview')), getAdminOverviewHandler)
adminApi.post('/admin/get_general_config', requireApiScope(getProtectedJsonRouteScope('/api/admin/get_general_config')), getGeneralConfigHandler)
adminApi.post('/admin/update_general_config', requireApiScope(getProtectedJsonRouteScope('/api/admin/update_general_config')), updateGeneralConfigHandler)
adminApi.post('/admin/get_authentication_config', requireApiScope(getProtectedJsonRouteScope('/api/admin/get_authentication_config')), getAuthenticationConfigHandler)
adminApi.post('/admin/update_authentication_config', requireApiScope(getProtectedJsonRouteScope('/api/admin/update_authentication_config')), updateAuthenticationConfigHandler)
adminApi.post('/admin/get_email_config', requireApiScope(getProtectedJsonRouteScope('/api/admin/get_email_config')), getEmailConfigHandler)
adminApi.post('/admin/update_email_config', requireApiScope(getProtectedJsonRouteScope('/api/admin/update_email_config')), updateEmailConfigHandler)
adminApi.post('/admin/get_credits_config', requireApiScope(getProtectedJsonRouteScope('/api/admin/get_credits_config')), getCreditsConfigHandler)
adminApi.post('/admin/update_credits_config', requireApiScope(getProtectedJsonRouteScope('/api/admin/update_credits_config')), updateCreditsConfigHandler)
adminApi.post('/admin/get_affiliate_config', requireApiScope(getProtectedJsonRouteScope('/api/admin/get_affiliate_config')), getAffiliateConfigHandler)
adminApi.post('/admin/update_affiliate_config', requireApiScope(getProtectedJsonRouteScope('/api/admin/update_affiliate_config')), updateAffiliateConfigHandler)
adminApi.post('/admin/get_payment_config', requireApiScope(getProtectedJsonRouteScope('/api/admin/get_payment_config')), getPaymentConfigHandler)
adminApi.post('/admin/update_payment_config', requireApiScope(getProtectedJsonRouteScope('/api/admin/update_payment_config')), updatePaymentConfigHandler)
adminApi.post('/admin/create_payment_product', requireApiScope(getProtectedJsonRouteScope('/api/admin/create_payment_product')), createPaymentProductHandler)
adminApi.post('/admin/update_payment_product', requireApiScope(getProtectedJsonRouteScope('/api/admin/update_payment_product')), updatePaymentProductHandler)
adminApi.post('/admin/delete_payment_product', requireApiScope(getProtectedJsonRouteScope('/api/admin/delete_payment_product')), deletePaymentProductHandler)
adminApi.post('/admin/get_ai_config', requireApiScope(getProtectedJsonRouteScope('/api/admin/get_ai_config')), getAIConfigHandler)
adminApi.post('/admin/update_ai_config', requireApiScope(getProtectedJsonRouteScope('/api/admin/update_ai_config')), updateAIConfigHandler)
adminApi.post('/admin/create_ai_provider', requireApiScope(getProtectedJsonRouteScope('/api/admin/create_ai_provider')), createAIProviderHandler)
adminApi.post('/admin/update_ai_provider', requireApiScope(getProtectedJsonRouteScope('/api/admin/update_ai_provider')), updateAIProviderHandler)
adminApi.post('/admin/delete_ai_provider', requireApiScope(getProtectedJsonRouteScope('/api/admin/delete_ai_provider')), deleteAIProviderHandler)
adminApi.put('/admin/r2/public/*', browserSessionOnlyMiddleware, uploadR2PublicObjectHandler)
adminApi.get('/admin/ai_realtime_connect', browserSessionOnlyMiddleware, aiRealtimeConnectHandler)

const userApi: Hono<ApiEnv> = new Hono<ApiEnv>()
userApi.use('*', authMiddleware, betaGateMiddleware, tenantDbMiddleware)
userApi.get('/r2/private/*', browserSessionOnlyMiddleware, readR2ObjectHandler)
userApi.get('/r2/tmp/private/*', browserSessionOnlyMiddleware, readR2ObjectHandler)
userApi.put('/r2/private/*', browserSessionOnlyMiddleware, uploadR2ObjectHandler)
userApi.put('/r2/tmp/private/*', browserSessionOnlyMiddleware, uploadR2ObjectHandler)
userApi.post('/get_credit_summary', requireApiScope(getProtectedJsonRouteScope('/api/get_credit_summary')), getCreditSummaryHandler)
userApi.post(
	'/list_credit_transactions',
	requireApiScope(getProtectedJsonRouteScope('/api/list_credit_transactions')),
	listCreditTransactionsHandler
)
userApi.post('/daily_checkin', requireApiScope(getProtectedJsonRouteScope('/api/daily_checkin')), dailyCheckinHandler)
userApi.post('/get_aff_summary', requireApiScope(getProtectedJsonRouteScope('/api/get_aff_summary')), getAffSummaryHandler)
userApi.post('/bind_aff', requireApiScope(getProtectedJsonRouteScope('/api/bind_aff')), bindAffHandler)
userApi.post('/redeem_credit_code', requireApiScope(getProtectedJsonRouteScope('/api/redeem_credit_code')), redeemCreditCodeHandler)
userApi.post('/submit_feedback', requireApiScope(getProtectedJsonRouteScope('/api/submit_feedback')), submitFeedbackHandler)
userApi.post('/list_notifications', requireApiScope(getProtectedJsonRouteScope('/api/list_notifications')), listNotificationsHandler)
userApi.post('/read_notification', requireApiScope(getProtectedJsonRouteScope('/api/read_notification')), readNotificationHandler)
userApi.post('/create_payment_checkout', requireApiScope(getProtectedJsonRouteScope('/api/create_payment_checkout')), createPaymentCheckoutHandler)
userApi.post('/get_subscription', requireApiScope(getProtectedJsonRouteScope('/api/get_subscription')), getSubscriptionHandler)
userApi.post('/cancel_subscription', requireApiScope(getProtectedJsonRouteScope('/api/cancel_subscription')), cancelSubscriptionHandler)
userApi.post('/upgrade_subscription', requireApiScope(getProtectedJsonRouteScope('/api/upgrade_subscription')), upgradeSubscriptionHandler)
userApi.post('/list_payment_transactions', requireApiScope(getProtectedJsonRouteScope('/api/list_payment_transactions')), listPaymentTransactionsHandler)

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
