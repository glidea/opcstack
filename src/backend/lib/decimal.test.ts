import { describe, expect, test } from 'vitest'
import { addUnits, formatDecimal, parseDecimal, subtractUnits } from './decimal'

describe('parseDecimal', () => {
	test('parses integer text into scaled units', () => {
		expect(parseDecimal('1')).toBe(1_000_000)
	})

	test('parses fractional text into scaled units', () => {
		expect(parseDecimal('1.23')).toBe(1_230_000)
		expect(parseDecimal('0.000001')).toBe(1)
	})

	test('rejects invalid decimal text', () => {
		expect(() => parseDecimal('0')).toThrow('INVALID_DECIMAL')
		expect(() => parseDecimal('1.0000001')).toThrow('INVALID_DECIMAL')
		expect(() => parseDecimal('1.')).toThrow('INVALID_DECIMAL')
		expect(() => parseDecimal('-1')).toThrow('INVALID_DECIMAL')
	})
})

describe('formatDecimal', () => {
	test('formats units with 6 decimal places', () => {
		expect(formatDecimal(1_230_000)).toBe('1.230000')
		expect(formatDecimal(1)).toBe('0.000001')
		expect(formatDecimal(-1_230_000)).toBe('-1.230000')
	})
})

describe('unit arithmetic', () => {
	test('adds and subtracts units with safe integer checks', () => {
		expect(addUnits(1_230_000, 1)).toBe(1_230_001)
		expect(subtractUnits(1_230_000, 1)).toBe(1_229_999)
	})

	test('rejects unsafe integer results', () => {
		expect(() => addUnits(Number.MAX_SAFE_INTEGER, 1)).toThrow('DECIMAL_OVERFLOW')
		expect(() => subtractUnits(Number.MIN_SAFE_INTEGER, 1)).toThrow('DECIMAL_OVERFLOW')
	})
})
