const DECIMAL_SCALE = 1_000_000
const DECIMAL_PRECISION = 6

export type DecimalErrorCode =
	| 'INVALID_DECIMAL'
	| 'DECIMAL_OVERFLOW'

export class DecimalError extends Error {
	public readonly code: DecimalErrorCode

	constructor(code: DecimalErrorCode, message?: string) {
		super(message ?? decimalErrorMessage(code))
		this.name = 'DecimalError'
		this.code = code
	}
}

function decimalErrorMessage(code: DecimalErrorCode): string {
	switch (code) {
		case 'INVALID_DECIMAL':
			return 'Decimal value is invalid'
		case 'DECIMAL_OVERFLOW':
			return 'Decimal value is too large'
	}
}

export function parseDecimal(raw: string): number {
	const value = raw.trim()
	const parts = value.split('.')
	if (parts.length > 2) {
		throw new DecimalError('INVALID_DECIMAL')
	}

	const whole = parts[0] ?? ''
	const fraction = parts[1]
	if (!/^\d+$/.test(whole)) {
		throw new DecimalError('INVALID_DECIMAL')
	}
	if (fraction !== undefined && !/^\d+$/.test(fraction)) {
		throw new DecimalError('INVALID_DECIMAL')
	}
	if ((fraction ?? '').length > DECIMAL_PRECISION) {
		throw new DecimalError('INVALID_DECIMAL')
	}

	const fractionText = (fraction ?? '').padEnd(DECIMAL_PRECISION, '0')
	const units = Number(whole) * DECIMAL_SCALE + Number(fractionText)
	if (!Number.isSafeInteger(units) || units <= 0) {
		throw new DecimalError('INVALID_DECIMAL')
	}
	return units
}

export function formatDecimal(units: number): string {
	if (!Number.isSafeInteger(units)) {
		throw new DecimalError('INVALID_DECIMAL')
	}

	const sign = units < 0 ? '-' : ''
	const absUnits = Math.abs(units)
	const whole = Math.floor(absUnits / DECIMAL_SCALE)
	const fraction = String(absUnits % DECIMAL_SCALE).padStart(DECIMAL_PRECISION, '0')
	return `${sign}${whole}.${fraction}`
}

export function addUnits(left: number, right: number): number {
	const result = left + right
	if (!Number.isSafeInteger(result)) {
		throw new DecimalError('DECIMAL_OVERFLOW')
	}
	return result
}

export function subtractUnits(left: number, right: number): number {
	const result = left - right
	if (!Number.isSafeInteger(result)) {
		throw new DecimalError('DECIMAL_OVERFLOW')
	}
	return result
}
