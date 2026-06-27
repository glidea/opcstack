import { dev } from '$app/environment'
import { defaultLocale, supportedLocales, type SystemLocale } from '$web/i18n/locales'
import { buildDocsManifest, getLocaleManifest, type DocGroup, type DocsManifest } from './docs'

export interface DocNavItem {
	slug: string
	title: string
}

export interface DocNavGroup {
	id: string
	title: string
	docs: DocNavItem[]
}

export interface DocsLayoutData {
	locale: string
	locales: string[]
	groups: DocNavGroup[]
	homeSlug: string
}

const rawDocModules = import.meta.glob('/public-docs/**/*.md', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>

let manifestPromise: Promise<DocsManifest> | null = null

export async function getDocsManifest(): Promise<DocsManifest> {
	if (dev) {
		return buildDocsManifest(rawDocModules)
	}

	if (!manifestPromise) {
		manifestPromise = buildDocsManifest(rawDocModules)
	}

	return manifestPromise
}

export async function loadDocsLayoutData(input: {
	locale: SystemLocale
}): Promise<DocsLayoutData> {
	const manifest = await getDocsManifest()
	const matchedLocales = supportedLocales.filter((locale) => manifest.locales.includes(locale))
	const locales = matchedLocales.length > 0 ? matchedLocales : manifest.locales
	const locale = resolveDocsLocale(locales, input.locale)
	const localeManifest = getLocaleManifest(manifest, locale)

	return {
		locale,
		locales,
		groups: toNavGroups(localeManifest?.groups ?? []),
		homeSlug: localeManifest?.homeSlug ?? ''
	}
}

function resolveDocsLocale(locales: string[], preferredLocale: string): string {
	if (locales.includes(preferredLocale)) {
		return preferredLocale
	}

	if (locales.includes(defaultLocale)) {
		return defaultLocale
	}

	return locales[0] ?? defaultLocale
}

function toNavGroups(groups: DocGroup[]): DocNavGroup[] {
	return groups.map((group) => {
		return {
			id: group.id,
			title: group.title,
			docs: group.docs.map((doc) => {
				return {
					slug: doc.slug,
					title: doc.title
				}
			})
		}
	})
}
