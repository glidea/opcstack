import { supportedLocales } from '$frontend/i18n/locales'

export const prerender = true

const themes = ['apple-saas', 'brutalism']

export function entries() {
	return supportedLocales.flatMap(locale => themes.map(theme => ({ locale, theme })))
}
