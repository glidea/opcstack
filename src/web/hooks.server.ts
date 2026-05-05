import { redirect, type Handle } from '@sveltejs/kit'
import { isSystemLocale, resolveSystemLocale } from '$web/i18n/locales'

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

	const firstSegment = pathname.split('/').filter((segment) => segment !== '')[0] ?? ''
	if (isSystemLocale(firstSegment)) {
		return resolve(event)
	}

	const locale = resolveSystemLocale(event.request.headers.get('accept-language') ?? '')
	const targetPath = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`
	redirect(302, `${targetPath}${event.url.search}`)
}

function isInternalPath(pathname: string): boolean {
	for (const prefix of INTERNAL_PATH_PREFIXES) {
		if (pathname.startsWith(prefix)) {
			return true
		}
	}

	return false
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
