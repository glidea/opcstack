import { loadDocsLayoutData } from '$web/docs/manifest.server'
import type { SystemLocale } from '$web/i18n/locales'

export const prerender = true

export async function load(event: { params: { locale: string } }) {
	return loadDocsLayoutData({
		locale: event.params.locale as SystemLocale
	})
}
