import { describe, expect, test } from 'vitest'
import {
	compactTechnicalId,
	createFilterOptions,
	formatCreditAmount
} from './admin-presentation'

describe('admin presentation', (): void => {
	test('formats credit amounts without meaningless trailing zeroes', (): void => {
		expect({ whole: formatCreditAmount('3.000000', 'en'), decimal: formatCreditAmount('3.250000', 'en') }).toEqual({
			whole: '3',
			decimal: '3.25'
		})
	})

	test('keeps technical identifiers recognizable without occupying the full row', (): void => {
		expect({ compact: compactTechnicalId('u_shard_1786287080658_1786287080658') }).toEqual({
			compact: 'u_shard_…080658'
		})
	})

	test('builds unique select options from known and observed values', (): void => {
		expect({ options: createFilterOptions('security', ['system', 'security', 'system'], ['system']) }).toEqual({
			options: ['system', 'security']
		})
	})
})
