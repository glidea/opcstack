import type { SystemLocale } from '$web/i18n/locales'

export function load(event: {
	params: { locale?: string }
}): { locale: SystemLocale } {
	return { locale: event.params.locale as SystemLocale }
}
