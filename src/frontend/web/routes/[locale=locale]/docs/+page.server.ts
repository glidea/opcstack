import { error, redirect } from '@sveltejs/kit'
import { clientConfig } from '$frontend/config/client'
import { supportedLocales, type SystemLocale } from '$frontend/i18n/locales'
import { loadDocsLayoutData } from '../../../lib/docs/manifest.server'

export const prerender = true

export function entries(): Array<{ locale: string }> {
	if (!clientConfig.docsEnabled) {
		return []
	}

	return supportedLocales.map((locale) => ({ locale }))
}

export async function load(event: { params: { locale: string } }): Promise<void> {
	if (!clientConfig.docsEnabled) {
		error(404, 'DOC_NOT_FOUND')
	}

	const locale = event.params.locale as SystemLocale
	const data = await loadDocsLayoutData({ locale })
	if (data.homeSlug === '') {
		error(404, 'DOC_NOT_FOUND')
	}

	redirect(307, `/${locale}/docs/${data.homeSlug}`)
}
