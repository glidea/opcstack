import type { MiddlewareHandler } from 'hono'
import { getDb } from '../../db'
import type { ApiEnv } from '..'

export const META_DB_BOOKMARK_HEADER = 'x-d1-meta-bookmark'
export const META_DB_BOOKMARK_COOKIE = 'd1_meta_bookmark'
export const META_DB_BOOKMARK_DEFAULT: D1SessionConstraint = 'first-primary'

export const metaDbSessionMiddleware: MiddlewareHandler<ApiEnv> = async (
	ctx,
	next
): Promise<Response | void> => {
	const headerBookmark = ctx.req.header(META_DB_BOOKMARK_HEADER)
	const cookieBookmark = readCookie(ctx.req.header('cookie'), META_DB_BOOKMARK_COOKIE)
	const bookmark = resolveSessionBookmark(headerBookmark, cookieBookmark)
	const session = ctx.env.META_DB.withSession(bookmark)
	ctx.set('metaDb', getDb(session))

	await next()

	const nextBookmark = session.getBookmark()
	if (!nextBookmark) {
		return
	}

	ctx.res.headers.set(META_DB_BOOKMARK_HEADER, nextBookmark)
	ctx.res.headers.append(
		'set-cookie',
		buildBookmarkSetCookie(nextBookmark, shouldUseSecureCookie(ctx.env.APP_BASE_URL))
	)
}

export function resolveSessionBookmark(
	headerBookmark: string | undefined,
	cookieBookmark: string | undefined
): D1SessionBookmark | D1SessionConstraint {
	if (headerBookmark && headerBookmark.trim() !== '') {
		return headerBookmark.trim()
	}
	if (cookieBookmark && cookieBookmark.trim() !== '') {
		return cookieBookmark.trim()
	}
	return META_DB_BOOKMARK_DEFAULT
}

export function buildBookmarkSetCookie(bookmark: string, secure: boolean): string {
	const encodedBookmark = encodeURIComponent(bookmark)
	if (secure) {
		return `${META_DB_BOOKMARK_COOKIE}=${encodedBookmark}; Path=/; HttpOnly; SameSite=Lax; Secure`
	}
	return `${META_DB_BOOKMARK_COOKIE}=${encodedBookmark}; Path=/; HttpOnly; SameSite=Lax`
}

function shouldUseSecureCookie(appBaseUrl: string): boolean {
	return appBaseUrl.startsWith('https://')
}

function readCookie(rawCookie: string | undefined, key: string): string | undefined {
	if (!rawCookie) {
		return undefined
	}

	const segments = rawCookie.split(';')
	for (const segment of segments) {
		const [cookieKey, ...rest] = segment.trim().split('=')
		if (cookieKey !== key) {
			continue
		}
		return decodeURIComponent(rest.join('='))
	}

	return undefined
}
