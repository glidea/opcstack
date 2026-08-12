import { error, redirect } from '@sveltejs/kit'
import type { SystemLocale } from '$frontend/i18n/locales'
import { loadDocsLayoutData } from '../../../lib/docs/manifest.server'

export async function load(event: {
	params: { locale: string }
	parent: () => Promise<unknown>
}): Promise<void> {
	await event.parent()
	const locale = event.params.locale as SystemLocale
	const data = await loadDocsLayoutData({ locale })
	if (data.homeSlug === '') {
		error(404, 'DOC_NOT_FOUND')
	}

	redirect(307, `/${locale}/docs/${data.homeSlug}`)
}
