export type AdminSection =
	| 'overview'
	| 'users'
	| 'beta-codes'
	| 'credit-codes'
	| 'feedback'
	| 'notifications'
	| 'payments'
	| 'ai-tasks'

export type AdminNavigationItem = {
	id: AdminSection
	href: string
	labelKey: string
}

const ADMIN_SECTIONS: AdminSection[] = [
	'overview',
	'users',
	'beta-codes',
	'credit-codes',
	'feedback',
	'notifications',
	'payments',
	'ai-tasks'
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
