import { error } from '@sveltejs/kit'
import { clientConfig } from '$frontend/config/client'
import type { SystemLocale } from '$frontend/i18n/locales'
import { loadDocsLayoutData } from '../../../lib/docs/manifest.server'

export const prerender = true

export async function load(event: { params: { locale: string } }) {
	if (!clientConfig.docsEnabled) {
		error(404, 'DOC_NOT_FOUND')
	}

	return loadDocsLayoutData({
		locale: event.params.locale as SystemLocale
	})
}
