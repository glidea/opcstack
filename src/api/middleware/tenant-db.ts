import type { MiddlewareHandler } from 'hono'
import { createTenantShardAccess } from '../../db/shard-router'
import type { ApiEnv } from '..'

export const TENANT_DB_BOOKMARK_HEADER = 'x-d1-tenant-bookmark'
export const TENANT_DB_SHARD_HEADER = 'x-d1-tenant-shard'
export const TENANT_DB_BOOKMARK_DEFAULT: D1SessionConstraint = 'first-primary'

export const tenantDbMiddleware: MiddlewareHandler<ApiEnv> = async (
	ctx,
	next
): Promise<Response | void> => {
	const tenantShards = createTenantShardAccess(ctx.get('metaDb'), ctx.env)
	const resolved = await tenantShards.resolveUser(ctx.get('userId'))
	const cookieName = tenantBookmarkCookieName(resolved.shardId)
	const headerBookmark = ctx.req.header(TENANT_DB_BOOKMARK_HEADER)
	const cookieBookmark = readCookie(ctx.req.header('cookie'), cookieName)
	const bookmark = resolveTenantBookmark(headerBookmark, cookieBookmark)
	const tenant = tenantShards.openSession(resolved, bookmark)
	const session = tenant.session

	ctx.set('tenantDb', tenant.db)
	ctx.set('tenantShardId', tenant.shardId)

	await next()

	const nextBookmark = session.getBookmark()
	ctx.res.headers.set(TENANT_DB_SHARD_HEADER, tenant.shardId)
	if (!nextBookmark) {
		return
	}

	ctx.res.headers.set(TENANT_DB_BOOKMARK_HEADER, nextBookmark)
	ctx.res.headers.append(
		'set-cookie',
		buildTenantBookmarkSetCookie(
			cookieName,
			nextBookmark,
			shouldUseSecureCookie(ctx.env.APP_BASE_URL)
		)
	)
}

export function tenantBookmarkCookieName(shardId: string): string {
	return `d1_tenant_bookmark_${shardId}`
}

export function resolveTenantBookmark(
	headerBookmark: string | undefined,
	cookieBookmark: string | undefined
): D1SessionBookmark | D1SessionConstraint {
	if (headerBookmark && headerBookmark.trim() !== '') {
		return headerBookmark.trim()
	}
	if (cookieBookmark && cookieBookmark.trim() !== '') {
		return cookieBookmark.trim()
	}
	return TENANT_DB_BOOKMARK_DEFAULT
}

export function buildTenantBookmarkSetCookie(
	cookieName: string,
	bookmark: string,
	secure: boolean
): string {
	const encodedBookmark = encodeURIComponent(bookmark)
	if (secure) {
		return `${cookieName}=${encodedBookmark}; Path=/; HttpOnly; SameSite=Lax; Secure`
	}
	return `${cookieName}=${encodedBookmark}; Path=/; HttpOnly; SameSite=Lax`
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
