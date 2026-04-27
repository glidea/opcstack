export const defaultLocale = 'en'

export const supportedLocales = ['en', 'zh'] as const
export const systemLocales = supportedLocales

export type SystemLocale = (typeof supportedLocales)[number]

export function isSystemLocale(value: string): value is SystemLocale {
	return supportedLocales.includes(value as SystemLocale)
}

export function resolveSystemLocale(acceptLanguage: string): SystemLocale {
	const acceptedLocales = parseAcceptLanguage(acceptLanguage)

	for (const value of acceptedLocales) {
		if (isSystemLocale(value)) {
			return value
		}

		const baseLocale = value.split('-')[0] ?? ''
		if (isSystemLocale(baseLocale)) {
			return baseLocale
		}
	}

	return defaultLocale
}

function parseAcceptLanguage(header: string): string[] {
	const weightedLocales: Array<{ locale: string; q: number; index: number }> = []
	const entries = header.split(',')

	for (let index = 0; index < entries.length; index += 1) {
		const entry = entries[index] ?? ''
		const [rawLocale, ...params] = entry.split(';')
		const locale = (rawLocale ?? '').trim().toLowerCase()
		if (locale === '') {
			continue
		}

		let q = 1
		for (const param of params) {
			const [key, value] = param.split('=')
			if (key?.trim().toLowerCase() !== 'q') {
				continue
			}
			const parsed = Number(value?.trim() ?? '')
			if (!Number.isNaN(parsed)) {
				q = parsed
			}
		}

		weightedLocales.push({ locale, q, index })
	}

	weightedLocales.sort((a, b) => {
		if (a.q !== b.q) {
			return b.q - a.q
		}
		return a.index - b.index
	})

	return weightedLocales.map((item) => item.locale)
}
