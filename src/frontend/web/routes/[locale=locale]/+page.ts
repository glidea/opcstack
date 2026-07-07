import { supportedLocales, type SystemLocale } from '$frontend/i18n/locales'

export const prerender = true

export function entries(): Array<{ locale: SystemLocale }> {
	return supportedLocales.map((locale) => ({ locale }))
}
