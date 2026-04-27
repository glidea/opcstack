import type { Context } from 'hono'
import type { ApiEnv } from '..'
import { newR2Client } from '../../r2'

const R2_ROUTE_PREFIX = '/api/r2/'

const PUBLIC_CACHE_CONTROL = 'public, max-age=31536000, immutable'
const PRIVATE_CACHE_CONTROL = 'private, no-store'


export async function readR2ObjectHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const key = toR2Key(ctx.req.path)
	const userId = ctx.get('userId') as string | undefined
	const client = newR2Client(ctx.env, userId)

	const result = await client.get(key)
	if (result.status === 'unavailable') {
		return ctx.json({}, 500)
	}
	if (result.status === 'forbidden') {
		return ctx.json({}, 403)
	}
	if (result.status === 'not_found') {
		return ctx.json({}, 404)
	}

	const headers = new Headers()
	headers.set('content-type', result.contentType)
	headers.set('etag', result.etag)
	headers.set('cache-control', result.isPublic ? PUBLIC_CACHE_CONTROL : PRIVATE_CACHE_CONTROL)
	return new Response(result.body, {
		status: 200,
		headers
	})
}

export function toR2Key(path: string): string {
	return path.slice(R2_ROUTE_PREFIX.length)
}
