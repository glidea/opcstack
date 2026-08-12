import { error } from '@sveltejs/kit'
import type { PublicRuntimeConfig } from '$backend/config'
import type { SystemLocale } from '$frontend/i18n/locales'
import { loadDocsLayoutData } from '../../../lib/docs/manifest.server'

export async function load(event: {
	params: { locale: string }
	parent: () => Promise<{ publicRuntimeConfig: PublicRuntimeConfig }>
}): Promise<Awaited<ReturnType<typeof loadDocsLayoutData>>> {
	const parentData = await event.parent()
	if (!parentData.publicRuntimeConfig.docs_enabled) {
		error(404, 'DOC_NOT_FOUND')
	}

	return loadDocsLayoutData({
		locale: event.params.locale as SystemLocale
	})
}
