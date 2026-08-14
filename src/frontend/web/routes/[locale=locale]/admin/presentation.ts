export function formatCreditAmount(value: string, locale: string): string {
	const amount: number = Number(value)
	return new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(amount)
}

export function compactTechnicalId(value: string): string {
	if (value.length <= 18) {
		return value
	}
	return `${value.slice(0, 8)}…${value.slice(-6)}`
}

export function createFilterOptions(
	selected: string,
	observed: readonly string[],
	known: readonly string[] = []
): string[] {
	const options: Set<string> = new Set<string>()
	for (const value of known) {
		if (value !== '') {
			options.add(value)
		}
	}
	if (selected !== '' && selected !== 'all') {
		options.add(selected)
	}
	for (const value of observed) {
		if (value !== '') {
			options.add(value)
		}
	}
	return Array.from(options)
}
