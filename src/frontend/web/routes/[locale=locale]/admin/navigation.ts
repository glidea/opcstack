export type AdminSection =
	| 'dashboard'
	| 'users'
	| 'credit-transactions'
	| 'beta-codes'
	| 'credit-codes'
	| 'affiliate-referrals'
	| 'feedback'
	| 'notifications'
	| 'payments'
	| 'payment-products'
	| 'ai-tasks'
	| 'ai-providers'
	| 'configuration'

export type AdminNavigationItem = {
	id: AdminSection
	href: string
	labelKey: string
}

const ADMIN_SECTIONS: AdminSection[] = [
	'dashboard',
	'users',
	'credit-transactions',
	'beta-codes',
	'credit-codes',
	'affiliate-referrals',
	'feedback',
	'notifications',
	'payments',
	'payment-products',
	'ai-tasks',
	'ai-providers',
	'configuration'
]

export function createAdminNavigation(locale: string): AdminNavigationItem[] {
	return ADMIN_SECTIONS.map((section: AdminSection): AdminNavigationItem => {
		return {
			id: section,
			href: `/${locale}/admin/${section}`,
			labelKey: `admin.nav.${section}`
		}
	})
}
