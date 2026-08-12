import { redirect, type Handle } from '@sveltejs/kit'
import { isSystemLocale, resolveSystemLocale } from '$frontend/i18n/locales'
import { getMetaDb } from '$backend/db'
import { getPublicRuntimeConfig, type PublicRuntimeConfig } from '$backend/config'
import {
	META_DB_BOOKMARK_COOKIE,
	resolveSessionBookmark
} from '$backend/api/middleware/meta-db-session'

const BYPASS_PATH_PREFIXES = ['/_app/', '/api/']
const BYPASS_EXACT_PATHS = [
	'/robots.txt',
	'/sitemap.xml',
	'/terms',
	'/privacy',
	'/refund-policy'
]
const INTERNAL_PATH_PREFIXES = ['/cdn-cgi/ProxyWorker/']

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url

	if (isInternalPath(pathname)) {
		return new Response(null, { status: 204 })
	}

	if (shouldBypassRuntimeConfig(pathname)) {
		return resolve(event)
	}

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
	event.locals.publicRuntimeConfig = publicRuntimeConfig
	const nextBookmark: D1SessionBookmark | null = session.getBookmark()
	if (nextBookmark) {
		event.cookies.set(META_DB_BOOKMARK_COOKIE, nextBookmark, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: env.APP_BASE_URL.startsWith('https://')
		})
	}

	const designSystem: string = getDesignForPath(
		pathname,
		publicRuntimeConfig.design_system
	)

	const response = await resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('<html lang="en"', `<html lang="en" data-design="${designSystem}"`)
	})
	if (shouldBypassLocaleRedirect(pathname)) {
		return response
	}
	if (response.status !== 404) {
		return response
	}

	const firstSegment: string = pathname.split('/').filter((segment) => segment !== '')[0] ?? ''
	if (isSystemLocale(firstSegment)) {
		return response
	}
	const targetLocale = resolveSystemLocale(event.request.headers.get('accept-language') ?? '')
	let search = ''
	try { search = event.url.search } catch {}
	throw redirect(302, `/${targetLocale}${pathname}${search}`)
}

function shouldBypassRuntimeConfig(pathname: string): boolean {
	if (pathname === '/robots.txt' || pathname === '/sitemap.xml') {
		return true
	}
	for (const prefix of BYPASS_PATH_PREFIXES) {
		if (pathname.startsWith(prefix)) {
			return true
		}
	}
	if (pathname.startsWith('/favicon') || pathname.startsWith('/manifest')) {
		return true
	}
	const lastSegment: string = pathname.split('/').pop() ?? ''
	return /\.[a-zA-Z0-9]+$/.test(lastSegment)
}

function isInternalPath(pathname: string): boolean {
	for (const prefix of INTERNAL_PATH_PREFIXES) {
		if (pathname.startsWith(prefix)) {
			return true
		}
	}

	return false
}

function getDesignForPath(pathname: string, fallback: string): string {
	const match = pathname.match(/\/demo-design\/([^/]+)/)
	return match?.[1] ?? fallback
}

function shouldBypassLocaleRedirect(pathname: string): boolean {
	if (pathname === '') {
		return false
	}

	for (const exactPath of BYPASS_EXACT_PATHS) {
		if (pathname === exactPath) {
			return true
		}
	}

	for (const prefix of BYPASS_PATH_PREFIXES) {
		if (pathname.startsWith(prefix)) {
			return true
		}
	}

	if (pathname.startsWith('/favicon')) {
		return true
	}

	if (pathname.startsWith('/manifest')) {
		return true
	}

	const lastSegment = pathname.split('/').pop() ?? ''
	if (/\.[a-zA-Z0-9]+$/.test(lastSegment)) {
		return true
	}

	return false
}
