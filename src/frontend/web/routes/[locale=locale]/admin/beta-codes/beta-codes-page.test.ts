import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import {
	createBetaCodeSearchParams,
	joinBetaCodes,
	parseBetaCodeListQuery,
	validateGenerateCount
} from './beta-codes-page'

const pageSource: string = readFileSync(
	fileURLToPath(new URL('./+page.svelte', import.meta.url)),
	'utf8'
)

describe('admin beta codes page', (): void => {
	test('parses filters and pagination from the URL', (): void => {
		const url = new URL(
			'https://example.com/en/admin/beta-codes?code=BETA1234&used_by=user-1&used=true&created_at_start=100&created_at_end=200&page=3'
		)

		expect({ query: parseBetaCodeListQuery(url) }).toEqual({
			query: {
				code: 'BETA1234',
				used_by: 'user-1',
				used: true,
				created_at_start: 100,
				created_at_end: 200,
				page: 3,
				page_size: 20
			}
		})
	})

	test('serializes only active filters', (): void => {
		const params = createBetaCodeSearchParams({
			used: false,
			created_at_start: 100,
			page: 1,
			page_size: 20
		})

		expect({ search: params.toString() }).toEqual({
			search: 'used=false&created_at_start=100'
		})
	})

	test('accepts only positive integer generation counts', (): void => {
		expect({ one: validateGenerateCount('1'), twenty: validateGenerateCount('20') }).toEqual({
			one: true,
			twenty: true
		})
		expect({ zero: validateGenerateCount('0'), decimal: validateGenerateCount('1.5') }).toEqual({
			zero: false,
			decimal: false
		})
	})

	test('joins every generated code for copying', (): void => {
		expect({ text: joinBetaCodes([{ code: 'AAAA1111' }, { code: 'BBBB2222' }]) }).toEqual({
			text: 'AAAA1111\nBBBB2222'
		})
	})

	test('uses a standard primary action and an unframed filter toolbar', (): void => {
		expect(pageSource).toContain('<Button onclick={() => (generateOpen = true)}>')
		expect(pageSource).toContain('class="admin-filter-bar border-0 bg-transparent p-0"')
	})
})
