import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import {
	createCreditCodeSearchParams,
	getCreditCodeStatusVariant,
	joinCreditCodes,
	parseCreditCodeListQuery,
	validateCreditCodeAmount,
	validateCreditCodeCount
} from './credit-codes-page'

const pageSource: string = readFileSync(
	fileURLToPath(new URL('./+page.svelte', import.meta.url)),
	'utf8'
)

describe('admin credit codes page', (): void => {
	test('parses every supported filter from the URL', (): void => {
		const url = new URL(
			'https://example.com/en/admin/credit-codes?code=CREDIT1&claimed_by=user-1&status=claimed&amount=10.5&created_at_start=100&created_at_end=200&expires_at_start=300&expires_at_end=400&page=2'
		)

		expect({ query: parseCreditCodeListQuery(url) }).toEqual({
			query: {
				code: 'CREDIT1',
				claimed_by: 'user-1',
				status: 'claimed',
				amount: '10.5',
				created_at_start: 100,
				created_at_end: 200,
				expires_at_start: 300,
				expires_at_end: 400,
				page: 2,
				page_size: 20
			}
		})
	})

	test('serializes only active filters', (): void => {
		const params = createCreditCodeSearchParams({
			status: 'unused',
			amount: '10',
			page: 1,
			page_size: 20
		})

		expect({ search: params.toString() }).toEqual({ search: 'status=unused&amount=10' })
	})

	test('marks claimed codes as needing attention', (): void => {
		expect({
			unused: getCreditCodeStatusVariant('unused'),
			claimed: getCreditCodeStatusVariant('claimed'),
			granted: getCreditCodeStatusVariant('granted')
		}).toEqual({ unused: 'outline', claimed: 'destructive', granted: 'secondary' })
	})

	test('enforces generation count and credit amount constraints', (): void => {
		expect({ one: validateCreditCodeCount('1'), max: validateCreditCodeCount('200') }).toEqual({
			one: true,
			max: true
		})
		expect({ over: validateCreditCodeCount('201'), decimal: validateCreditCodeCount('1.5') }).toEqual({
			over: false,
			decimal: false
		})
		expect({ amount: validateCreditCodeAmount('10.000001'), zero: validateCreditCodeAmount('0') }).toEqual({
			amount: true,
			zero: false
		})
	})

	test('joins every generated code for copying', (): void => {
		expect({ text: joinCreditCodes([{ code: 'AAAA1111' }, { code: 'BBBB2222' }]) }).toEqual({
			text: 'AAAA1111\nBBBB2222'
		})
	})

	test('uses a standard primary action and an unframed filter toolbar', (): void => {
		expect(pageSource).toContain('<Button onclick={() => (generateOpen = true)}>')
		expect(pageSource).toContain('class="admin-filter-bar border-0 bg-transparent p-0"')
	})
})
