import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const adminDirectory: string = fileURLToPath(new URL('.', import.meta.url))
const adminLayoutSource: string = readFileSync(`${adminDirectory}+layout.svelte`, 'utf8')
const userDetailSource: string = readFileSync(`${adminDirectory}users/UserDetailSheet.svelte`, 'utf8')
const appCssSource: string = readFileSync(
	fileURLToPath(new URL('../../../../lib/styles/app.css', import.meta.url)),
	'utf8'
)
const enMessages: Record<string, string> = JSON.parse(
	readFileSync(fileURLToPath(new URL('../../../../lib/i18n/messages/en.json', import.meta.url)), 'utf8')
) as Record<string, string>
const zhMessages: Record<string, string> = JSON.parse(
	readFileSync(fileURLToPath(new URL('../../../../lib/i18n/messages/zh.json', import.meta.url)), 'utf8')
) as Record<string, string>
const pageDirectories: string[] = [
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
	'ai-providers',
	'ai-tasks'
]
const listPageDirectories: string[] = pageDirectories.filter(
	(pageDirectory: string): boolean => pageDirectory !== 'dashboard'
)

function readPage(pageDirectory: string): string {
	return readFileSync(`${adminDirectory}${pageDirectory}/+page.svelte`, 'utf8')
}

describe('admin page layout', (): void => {
	test('places Worker logs in the leading header actions', (): void => {
		const leadingActionsIndex: number = adminLayoutSource.indexOf('{#snippet leadingActions()}')
		const workerLinkIndex: number = adminLayoutSource.indexOf("admin.cloudflare.worker")
		const trailingActionsIndex: number = adminLayoutSource.indexOf('{#snippet actions()}')

		expect(leadingActionsIndex).toBeGreaterThan(-1)
		expect(workerLinkIndex).toBeGreaterThan(leadingActionsIndex)
		expect(trailingActionsIndex).toBeGreaterThan(workerLinkIndex)
	})

	test('aligns every page to the shared workspace frame and header baseline', (): void => {
		for (const pageDirectory of pageDirectories) {
			const source: string = readPage(pageDirectory)
			expect(source).toContain('class="admin-page"')
			expect(source).toContain('class="admin-page-header"')
		}
	})

	test('keeps list filters and tables in shared operational containers', (): void => {
		for (const pageDirectory of listPageDirectories) {
			const source: string = readPage(pageDirectory)
			expect(source).toContain('admin-filter-bar')
			expect(source).toContain('admin-table-panel')
		}
	})

	test('uses a metric strip instead of an identical card grid on dashboard', (): void => {
		const source: string = readPage('dashboard')
		expect(source).toContain('admin-metric-strip')
		expect(source).not.toContain('<Card.Root')
	})

	test('keeps the Worker handoff compact enough for the mobile header', (): void => {
		const workerLinkIndex: number = adminLayoutSource.indexOf('admin.cloudflare.worker')
		const workerLink: string = adminLayoutSource.slice(workerLinkIndex - 400, workerLinkIndex + 400)

		expect(workerLink).toContain('hidden sm:inline')
	})

	test('keeps the admin sidebar frame in shared admin styles', (): void => {
		expect(adminLayoutSource).not.toContain('md:top-12')
		expect(adminLayoutSource).not.toContain('md:h-[calc(')
		expect(appCssSource).toContain('.admin-shell [data-slot="sidebar-container"]')
	})

	test('keeps sidebar label weight fixed so the current page does not reflow', (): void => {
		const menuButtonIndex: number = adminLayoutSource.indexOf('<Sidebar.MenuButton')
		const menuButton: string = adminLayoutSource.slice(menuButtonIndex, menuButtonIndex + 300)

		expect(menuButton).toContain('font-medium')
	})

	test('keeps admin surfaces at or below an 8px radius', (): void => {
		const radiusPixels: Record<string, number> = Object.fromEntries(
			[...appCssSource.matchAll(/--radius-(sm|md|lg|xl):\s*(\d+)px/g)].map(
				(match: RegExpMatchArray): [string, number] => [match[1]!, Number(match[2])]
			)
		)
		const adminRules: string[] = appCssSource.match(/\.admin-[a-z-]+ \{[^}]*\}/g) ?? []
		const oversizedRules: string[] = adminRules.filter((rule: string): boolean => {
			const radius: RegExpMatchArray | null = rule.match(/rounded-(sm|md|lg|xl)\b/)
			return radius !== null && radiusPixels[radius[1]!]! > 8
		})

		expect(oversizedRules).toEqual([])
	})
})

describe('admin dashboard composition', (): void => {
	const dashboardSource: string = readPage('dashboard')

	test('renders the attention queue from one derived exception list', (): void => {
		expect(dashboardSource).toContain('createAttentionItems')
		expect(dashboardSource).not.toContain('drilldowns.')
	})

	test('drops the aggregate attention count and per-row status captions', (): void => {
		expect(dashboardSource).not.toContain('<Badge')
		expect(dashboardSource).not.toContain('admin.dashboard.attention.current')
	})

	test('keeps the metric strip free of decorative icons', (): void => {
		expect(dashboardSource).not.toContain('<UsersIcon')
		expect(dashboardSource).not.toContain('<BotIcon')
		expect(dashboardSource).not.toContain('<CircleDollarSignIcon')
		expect(dashboardSource).not.toContain('<MessageSquareTextIcon')
	})

	test('keeps restating copy out of the distribution panel', (): void => {
		expect(dashboardSource).not.toContain('admin.dashboard.distribution.description')
	})

	test('names each exception by the operator state in both locales', (): void => {
		expect({
			en: {
				failedTasks: enMessages['admin.dashboard.attention.failedTasks'],
				claimedCodes: enMessages['admin.dashboard.attention.claimedCodes'],
				disputedPayments: enMessages['admin.dashboard.attention.disputedPayments']
			},
			zh: {
				failedTasks: zhMessages['admin.dashboard.attention.failedTasks'],
				claimedCodes: zhMessages['admin.dashboard.attention.claimedCodes'],
				disputedPayments: zhMessages['admin.dashboard.attention.disputedPayments']
			}
		}).toEqual({
			en: {
				failedTasks: 'Failed AI tasks in the last 24 hours',
				claimedCodes: 'Credit codes waiting for their grant',
				disputedPayments: 'Disputed payments'
			},
			zh: {
				failedTasks: '近 24 小时失败的 AI 任务',
				claimedCodes: '等待发放积分的兑换码',
				disputedPayments: '争议支付'
			}
		})
	})
})

describe('admin user operations composition', (): void => {
	const userSource: string = readPage('users')
	const referralSource: string = readPage('affiliate-referrals')
	const creditTransactionSource: string = readPage('credit-transactions')

	test('does not repeat an email when the user name is the same value', (): void => {
		expect(userSource).toContain("user.name !== user.email")
	})

	test('closes user details before opening the credit grant dialog', (): void => {
		expect(userDetailSource).toContain('open = false')
		expect(userDetailSource.lastIndexOf('<GrantCreditsDialog')).toBeGreaterThan(
			userDetailSource.lastIndexOf('</Sheet.Root>')
		)
	})

	test('keeps invitation loading rows aligned to the five-column relationship table', (): void => {
		expect(referralSource).toContain('<Table.Head colspan={3}>')
		expect(referralSource).toContain('{#each Array(5) as _cell}')
	})

	test('shows signed credit changes with a direction icon', (): void => {
		expect(creditTransactionSource).toContain('<MoveDownIcon')
		expect(creditTransactionSource).toContain('<MoveUpIcon')
		expect(creditTransactionSource).toContain('`+${formatted}`')
	})
})
