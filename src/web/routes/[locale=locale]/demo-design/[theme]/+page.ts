import { supportedLocales } from '$web/i18n/locales'

export const prerender = true

const themes = ['apple-saas', 'brutalism']

export function entries() {
	return supportedLocales.flatMap(locale => themes.map(theme => ({ locale, theme })))
}
