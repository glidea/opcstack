import { error } from '@sveltejs/kit'
import { clientConfig } from '$frontend/config/client'
import { defaultLocale } from '$frontend/i18n/locales'
import { getDocBySlug, getDocNeighbors, getDocSwitchPath, getLocaleManifest, type DocHeading } from '../../../../lib/docs/docs'
import { getDocsManifest } from '../../../../lib/docs/manifest.server'

export const prerender = true

export async function entries(): Promise<Array<{ locale: string; slug: string }>> {
	if (!clientConfig.docsEnabled) {
		return []
	}

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
	parent: () => Promise<{ locale: string; locales: string[]; siteName: string; logoUrl: string }>
}): Promise<{
	slug: string
	title: string
	description: string
	group: string
	contentHtml: string
	headings: DocHeading[]
	previous: ReturnType<typeof getDocNeighbors>['previous']
	next: ReturnType<typeof getDocNeighbors>['next']
	localeUrls: Array<{ locale: string; url: string }>
	locale: string
	siteName: string
	logoUrl: string
	seoTitle: string
	canonicalUrl: string
	xDefaultUrl: string
}> {
	if (!clientConfig.docsEnabled) {
		error(404, 'DOC_NOT_FOUND')
	}

	const layoutData = await parent()
	const origin = clientConfig.webBaseUrl
	const manifest = await getDocsManifest()
	const localeManifest = getLocaleManifest(manifest, layoutData.locale)
	const target = getDocBySlug(localeManifest?.docs ?? [], params.slug)
	if (!target) {
		error(404, 'DOC_NOT_FOUND')
	}

	const neighbors = getDocNeighbors(localeManifest?.docs ?? [], params.slug)
	const siteName = layoutData.siteName
	const localeUrls = layoutData.locales.map((locale) => {
		const path = getDocSwitchPath(manifest, locale, params.slug)
		return {
			locale,
			url: new URL(path, origin).toString()
		}
	})
	const canonicalUrl = new URL(`/${layoutData.locale}/docs/${target.slug}`, origin).toString()
	const xDefaultPath = getDocSwitchPath(manifest, defaultLocale, params.slug)

	return {
		slug: target.slug,
		title: target.title,
		description: target.description,
		group: target.group,
		contentHtml: target.contentHtml,
		headings: target.headings,
		previous: neighbors.previous,
		next: neighbors.next,
		localeUrls,
		locale: layoutData.locale,
		siteName,
		logoUrl: layoutData.logoUrl,
		seoTitle: `${target.title} - ${siteName}`,
		canonicalUrl,
		xDefaultUrl: new URL(xDefaultPath, origin).toString()
	}
}
