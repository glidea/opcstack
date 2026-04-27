import { error, redirect } from '@sveltejs/kit'
import { supportedLocales, type SystemLocale } from '$web/i18n/locales'
import { loadDocsLayoutData } from '$web/docs/manifest.server'

export const prerender = true

export function entries(): Array<{ locale: string }> {
	return supportedLocales.map((locale) => ({ locale }))
}

export async function load(event: { params: { locale: string } }): Promise<void> {
	const locale = event.params.locale as SystemLocale
	const data = await loadDocsLayoutData({ locale })
	if (data.homeSlug === '') {
		error(404, 'DOC_NOT_FOUND')
	}

	redirect(307, `/${locale}/docs/${data.homeSlug}`)
}
