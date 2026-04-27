import { error } from '@sveltejs/kit'
import { defaultLocale } from '$web/i18n/locales'
import { getDocBySlug, getDocNeighbors, getDocSwitchPath, getLocaleManifest, type DocHeading } from '$web/docs/docs'
import { getDocsManifest } from '$web/docs/manifest.server'

export const prerender = true

export async function entries(): Promise<Array<{ locale: string; slug: string }>> {
	const manifest = await getDocsManifest()
	const allEntries: Array<{ locale: string; slug: string }> = []

	for (const locale of manifest.locales) {
		const localeManifest = manifest.byLocale[locale]
		for (const doc of localeManifest?.docs ?? []) {
			allEntries.push({ locale, slug: doc.slug })
		}
	}

	return allEntries
}

export async function load({
	params,
	parent
}: {
	params: { locale: string; slug: string }
	parent: () => Promise<{ locale: string; locales: string[] }>
}): Promise<{
	slug: string
	title: string
	description: string
	group: string
	contentHtml: string
	headings: DocHeading[]
	previous: ReturnType<typeof getDocNeighbors>['previous']
	next: ReturnType<typeof getDocNeighbors>['next']
	localePaths: Array<{ locale: string; path: string }>
	locale: string
	canonicalPath: string
	xDefaultPath: string
}> {
	const layoutData = await parent()
	const manifest = await getDocsManifest()
	const localeManifest = getLocaleManifest(manifest, layoutData.locale)
	const target = getDocBySlug(localeManifest?.docs ?? [], params.slug)
	if (!target) {
		error(404, 'DOC_NOT_FOUND')
	}

	const neighbors = getDocNeighbors(localeManifest?.docs ?? [], params.slug)
	const localePaths = layoutData.locales.map((locale) => {
		return {
			locale,
			path: getDocSwitchPath(manifest, locale, params.slug)
		}
	})

	return {
		slug: target.slug,
		title: target.title,
		description: target.description,
		group: target.group,
		contentHtml: target.contentHtml,
		headings: target.headings,
		previous: neighbors.previous,
		next: neighbors.next,
		localePaths,
		locale: layoutData.locale,
		canonicalPath: `/${layoutData.locale}/docs/${target.slug}`,
		xDefaultPath: getDocSwitchPath(manifest, defaultLocale, params.slug)
	}
}
