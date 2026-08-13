import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const adminDirectory: string = fileURLToPath(new URL('.', import.meta.url))
const adminLayoutSource: string = readFileSync(`${adminDirectory}+layout.svelte`, 'utf8')
const pageDirectories: string[] = [
	'overview',
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
	(pageDirectory: string): boolean => pageDirectory !== 'overview'
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

	test('uses a metric strip instead of an identical card grid on overview', (): void => {
		const source: string = readPage('overview')
		expect(source).toContain('admin-metric-strip')
		expect(source).not.toContain('<Card.Root')
	})
})
