import type { RequestEvent } from '@sveltejs/kit'
import { getMetaDb } from '$backend/db'
import { getPublicRuntimeConfig, type PublicRuntimeConfig } from '$backend/config'
import {
	META_DB_BOOKMARK_COOKIE,
	resolveSessionBookmark
} from '$backend/api/middleware/meta-db-session'
import { supportedLocales } from '$frontend/i18n/locales'
import { clientConfig } from '$frontend/config/client'
import { buildDocsManifest } from '../../lib/docs/docs'

const rawDocModules = import.meta.glob('/public-docs/**/*.md', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>
const pageModules = import.meta.glob('/src/frontend/web/routes/**/+page.svelte')
const ROUTES_DIR_PREFIX = '/src/frontend/web/routes'
const PAGE_FILE_SUFFIX = '/+page.svelte'

export async function GET(event: RequestEvent): Promise<Response> {
	const env: Env | undefined = event.platform?.env as Env | undefined
	if (!env) {
		throw new Error('CONFIG_UNAVAILABLE')
	}
	const bookmark: D1SessionBookmark | D1SessionConstraint = resolveSessionBookmark(
		undefined,
		event.cookies.get(META_DB_BOOKMARK_COOKIE)
	)
	const session: D1DatabaseSession = env.META_DB.withSession(bookmark)
	const publicRuntimeConfig: PublicRuntimeConfig = await getPublicRuntimeConfig(getMetaDb(session))
	const nextBookmark: D1SessionBookmark | null = session.getBookmark()
	if (nextBookmark) {
		event.cookies.set(META_DB_BOOKMARK_COOKIE, nextBookmark, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: env.APP_BASE_URL.startsWith('https://')
		})
	}
	const urls = new Set<string>()

	for (const path of listPublicRoutePaths()) {
		urls.add(path)
	}

	if (publicRuntimeConfig.docs_enabled) {
		const manifest = await buildDocsManifest(rawDocModules)
		for (const locale of manifest.locales) {
			const localeManifest = manifest.byLocale[locale]
			for (const doc of localeManifest?.docs ?? []) {
				urls.add(`/${locale}/docs/${doc.slug}`)
			}
		}
	}

	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...[...urls].sort((a, b) => a.localeCompare(b)).map((pathname) => {
			return `<url><loc>${new URL(pathname, clientConfig.webBaseUrl).toString()}</loc></url>`
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
