import { env } from '$env/dynamic/private'
import { buildDocsManifest } from '$web/docs/docs'
import { supportedLocales } from '$web/i18n/locales'
import { resolveSiteOrigin } from '$web/seo'

const rawDocModules = import.meta.glob('/public-docs/**/*.md', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>
const pageModules = import.meta.glob('/src/web/routes/**/+page.svelte')
const ROUTES_DIR_PREFIX = '/src/web/routes'
const PAGE_FILE_SUFFIX = '/+page.svelte'

export const prerender = true

export async function GET(): Promise<Response> {
	const manifest = await buildDocsManifest(rawDocModules)
	const urls = new Set<string>()

	for (const path of listPublicRoutePaths()) {
		urls.add(path)
	}

	for (const locale of manifest.locales) {
		const localeManifest = manifest.byLocale[locale]
		for (const doc of localeManifest?.docs ?? []) {
			urls.add(`/${locale}/docs/${doc.slug}`)
		}
	}

	const origin = resolveSiteOrigin(env['APP_DOMAIN'] ?? 'localhost')

	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...[...urls].sort((a, b) => a.localeCompare(b)).map((pathname) => {
			return `<url><loc>${new URL(pathname, origin).toString()}</loc></url>`
		}),
		'</urlset>'
	].join('')

	return new Response(body, {
		headers: {
			'content-type': 'application/xml; charset=utf-8'
		}
	})
}

function listPublicRoutePaths(): string[] {
	const routes = new Set<string>()

	for (const filePath of Object.keys(pageModules)) {
		for (const path of expandPublicRoutePaths(filePath)) {
			routes.add(path)
		}
	}

	return [...routes]
}

function expandPublicRoutePaths(filePath: string): string[] {
	if (!filePath.startsWith(ROUTES_DIR_PREFIX) || !filePath.endsWith(PAGE_FILE_SUFFIX)) {
		return []
	}

	const routePath = filePath.slice(ROUTES_DIR_PREFIX.length, -PAGE_FILE_SUFFIX.length)
	const rawSegments = routePath.split('/').filter((segment) => segment !== '')
	let paths: string[] = ['']

	for (const segment of rawSegments) {
		if (isRouteGroup(segment)) {
			continue
		}

		if (segment === '[locale=locale]') {
			const expanded: string[] = []
			for (const path of paths) {
				for (const locale of supportedLocales) {
					expanded.push(`${path}/${locale}`)
				}
			}
			paths = expanded
			continue
		}

		if (isDynamicSegment(segment)) {
			return []
		}

		paths = paths.map((path) => `${path}/${segment}`)
	}

	if (paths.length === 0) {
		return ['/']
	}

	return paths.map((path) => (path === '' ? '/' : path))
}

function isDynamicSegment(segment: string): boolean {
	return segment.startsWith('[') && segment.endsWith(']')
}

function isRouteGroup(segment: string): boolean {
	return segment.startsWith('(') && segment.endsWith(')')
}
