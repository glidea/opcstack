export const API_SCOPES = [
	'account:write',
	'credits:read',
	'credits:write',
	'affiliate:read',
	'affiliate:write',
	'feedback:write',
	'notifications:read',
	'notifications:write',
	'payment:read',
	'payment:write',
	'admin:overview:read',
	'admin:users:read',
	'admin:users:write',
	'admin:beta:read',
	'admin:beta:write',
	'admin:credits:read',
	'admin:credits:write',
	'admin:feedback:read',
	'admin:notifications:read',
	'admin:notifications:write',
	'admin:payment:read',
	'admin:ai:read',
	'config:general:read',
	'config:general:write',
	'config:authentication:read',
	'config:authentication:write',
	'config:email:read',
	'config:email:write',
	'config:storage:read',
	'config:storage:write',
	'config:credits:read',
	'config:credits:write',
	'config:affiliate:read',
	'config:affiliate:write',
	'config:payment:read',
	'config:payment:write',
	'config:ai:read',
	'config:ai:write'
] as const

export type ApiScope = (typeof API_SCOPES)[number]
export type ProtectedJsonRouteAccess = 'user' | 'admin'
export type ProtectedJsonRoute = {
	method: 'POST'
	path: `/api/${string}`
	scope: ApiScope
	access: ProtectedJsonRouteAccess
}

export const PROTECTED_JSON_ROUTES: ProtectedJsonRoute[] = [
	{ method: 'POST', path: '/api/bind_beta_code', scope: 'account:write', access: 'user' },
	{ method: 'POST', path: '/api/get_credit_summary', scope: 'credits:read', access: 'user' },
	{ method: 'POST', path: '/api/list_credit_transactions', scope: 'credits:read', access: 'user' },
	{ method: 'POST', path: '/api/daily_checkin', scope: 'credits:write', access: 'user' },
	{ method: 'POST', path: '/api/redeem_credit_code', scope: 'credits:write', access: 'user' },
	{ method: 'POST', path: '/api/get_aff_summary', scope: 'affiliate:read', access: 'user' },
	{ method: 'POST', path: '/api/bind_aff', scope: 'affiliate:write', access: 'user' },
	{ method: 'POST', path: '/api/submit_feedback', scope: 'feedback:write', access: 'user' },
	{ method: 'POST', path: '/api/list_notifications', scope: 'notifications:read', access: 'user' },
	{ method: 'POST', path: '/api/read_notification', scope: 'notifications:write', access: 'user' },
	{ method: 'POST', path: '/api/get_subscription', scope: 'payment:read', access: 'user' },
	{ method: 'POST', path: '/api/list_payment_transactions', scope: 'payment:read', access: 'user' },
	{ method: 'POST', path: '/api/create_payment_checkout', scope: 'payment:write', access: 'user' },
	{ method: 'POST', path: '/api/cancel_subscription', scope: 'payment:write', access: 'user' },
	{ method: 'POST', path: '/api/upgrade_subscription', scope: 'payment:write', access: 'user' },
	{ method: 'POST', path: '/api/admin/get_overview', scope: 'admin:overview:read', access: 'admin' },
	{ method: 'POST', path: '/api/admin/list_users', scope: 'admin:users:read', access: 'admin' },
	{ method: 'POST', path: '/api/admin/update_administrator_email', scope: 'admin:users:write', access: 'admin' },
	{ method: 'POST', path: '/api/admin/list_beta_codes', scope: 'admin:beta:read', access: 'admin' },
	{ method: 'POST', path: '/api/admin/generate_beta_codes', scope: 'admin:beta:write', access: 'admin' },
	{ method: 'POST', path: '/api/admin/list_credit_codes', scope: 'admin:credits:read', access: 'admin' },
	{ method: 'POST', path: '/api/admin/generate_credit_codes', scope: 'admin:credits:write', access: 'admin' },
	{ method: 'POST', path: '/api/admin/grant_credits', scope: 'admin:credits:write', access: 'admin' },
	{ method: 'POST', path: '/api/admin/list_feedbacks', scope: 'admin:feedback:read', access: 'admin' },
	{ method: 'POST', path: '/api/admin/list_notifications', scope: 'admin:notifications:read', access: 'admin' },
	{ method: 'POST', path: '/api/admin/create_notification', scope: 'admin:notifications:write', access: 'admin' },
	{ method: 'POST', path: '/api/admin/update_notification', scope: 'admin:notifications:write', access: 'admin' },
	{ method: 'POST', path: '/api/admin/archive_notification', scope: 'admin:notifications:write', access: 'admin' },
	{ method: 'POST', path: '/api/admin/list_payment_transactions', scope: 'admin:payment:read', access: 'admin' },
	{ method: 'POST', path: '/api/admin/list_ai_tasks', scope: 'admin:ai:read', access: 'admin' },
	{ method: 'POST', path: '/api/admin/get_ai_task', scope: 'admin:ai:read', access: 'admin' },
	{ method: 'POST', path: '/api/admin/get_general_config', scope: 'config:general:read', access: 'admin' },
	{ method: 'POST', path: '/api/admin/update_general_config', scope: 'config:general:write', access: 'admin' },
	{ method: 'POST', path: '/api/admin/get_authentication_config', scope: 'config:authentication:read', access: 'admin' },
	{ method: 'POST', path: '/api/admin/update_authentication_config', scope: 'config:authentication:write', access: 'admin' },
	{ method: 'POST', path: '/api/admin/get_email_config', scope: 'config:email:read', access: 'admin' },
	{ method: 'POST', path: '/api/admin/update_email_config', scope: 'config:email:write', access: 'admin' },
	{ method: 'POST', path: '/api/admin/get_storage_config', scope: 'config:storage:read', access: 'admin' },
	{ method: 'POST', path: '/api/admin/update_storage_config', scope: 'config:storage:write', access: 'admin' },
	{ method: 'POST', path: '/api/admin/get_credits_config', scope: 'config:credits:read', access: 'admin' },
	{ method: 'POST', path: '/api/admin/update_credits_config', scope: 'config:credits:write', access: 'admin' },
	{ method: 'POST', path: '/api/admin/get_affiliate_config', scope: 'config:affiliate:read', access: 'admin' },
	{ method: 'POST', path: '/api/admin/update_affiliate_config', scope: 'config:affiliate:write', access: 'admin' },
	{ method: 'POST', path: '/api/admin/get_payment_config', scope: 'config:payment:read', access: 'admin' },
	{ method: 'POST', path: '/api/admin/create_payment_product', scope: 'config:payment:write', access: 'admin' },
	{ method: 'POST', path: '/api/admin/update_payment_config', scope: 'config:payment:write', access: 'admin' },
	{ method: 'POST', path: '/api/admin/update_payment_product', scope: 'config:payment:write', access: 'admin' },
	{ method: 'POST', path: '/api/admin/delete_payment_product', scope: 'config:payment:write', access: 'admin' },
	{ method: 'POST', path: '/api/admin/get_ai_config', scope: 'config:ai:read', access: 'admin' },
	{ method: 'POST', path: '/api/admin/update_ai_config', scope: 'config:ai:write', access: 'admin' },
	{ method: 'POST', path: '/api/admin/create_ai_provider', scope: 'config:ai:write', access: 'admin' },
	{ method: 'POST', path: '/api/admin/update_ai_provider', scope: 'config:ai:write', access: 'admin' },
	{ method: 'POST', path: '/api/admin/delete_ai_provider', scope: 'config:ai:write', access: 'admin' }
]

const API_SCOPE_SET: ReadonlySet<string> = new Set<string>(API_SCOPES)

export function isApiScope(value: string): value is ApiScope {
	return API_SCOPE_SET.has(value)
}

export function isAdministratorScope(scope: ApiScope): boolean {
	return scope.startsWith('admin:') || scope.startsWith('config:')
}

export function getProtectedJsonRouteScope(path: string): ApiScope {
	const route = PROTECTED_JSON_ROUTES.find((item: ProtectedJsonRoute): boolean => item.path === path)
	if (!route) {
		throw new Error(`Protected JSON route is not registered: ${path}`)
	}
	return route.scope
}
