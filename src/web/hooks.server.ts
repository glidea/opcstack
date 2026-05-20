import { redirect, type Handle } from '@sveltejs/kit'
import { isSystemLocale, resolveSystemLocale } from '$web/i18n/locales'
import { serverConfig } from '$web/config/server.server'

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

	if (shouldBypassLocaleRedirect(pathname)) {
		return resolve(event)
	}

	const designSystem = getDesignForPath(pathname, serverConfig.DESIGN_SYSTEM || 'apple-saas')

	const response = await resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('<html lang="en"', `<html lang="en" data-design="${designSystem}"`)
	})
	if (response.status !== 404) {
		return response
	}

	const firstSegment = pathname.split('/').filter((segment) => segment !== '')[0] ?? ''
	const targetLocale = isSystemLocale(firstSegment)
		? firstSegment
		: resolveSystemLocale(event.request.headers.get('accept-language') ?? '')
	let search = ''
	try { search = event.url.search } catch {}
	throw redirect(302, `/${targetLocale}${pathname}${search}`)
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
