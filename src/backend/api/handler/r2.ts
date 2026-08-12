import type { Context } from 'hono'
import type { ApiEnv } from '..'
import { getStorageConfig, type StorageConfig } from '../../config'
import {
	createR2Client,
	R2Error,
	verifyR2Origin,
	type R2Client,
	type R2GetResult,
	type R2ImageVariantPreset
} from '../../r2'

const R2_ROUTE_PREFIX = '/api/r2/'
const R2_ADMIN_PUBLIC_ROUTE_PREFIX = '/api/admin/r2/public/'
const R2_IMAGE_ORIGIN_ROUTE_PREFIX = '/api/internal/r2_image_origin/'

const PUBLIC_CACHE_CONTROL = 'public, max-age=31536000, immutable'
const TMP_PUBLIC_CACHE_CONTROL = 'public, max-age=300'
const PRIVATE_CACHE_CONTROL = 'private, no-store'
const R2_WORKER_CACHE_HEADER = 'x-r2-worker-cache'
const R2_WORKER_CACHE_MAX_BYTES = 10485760

type R2ReadObjectResult = {
	response: Response
	size: number
}

export async function readR2ObjectHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const key: string = toR2Key(ctx.req.path)
	const variant: string | undefined = ctx.req.query('variant')
	const userId: string | undefined = ctx.get('userId') as string | undefined
	const client: R2Client = createR2Client(ctx.env, userId)

	if (!isCacheableR2ReadPath(ctx.req.path)) {
		const result: R2ReadObjectResult = await readR2Object(ctx, key, variant, client)
		return withR2WorkerCacheHeader(result.response, 'bypass')
	}

	const cacheKey: Request = new Request(ctx.req.raw.url, {
		method: 'GET'
	})
	const cache: Cache = defaultR2Cache()
	const cachedResponse: Response | undefined = await cache.match(cacheKey)
	if (cachedResponse) {
		return withR2WorkerCacheHeader(cachedResponse, 'hit')
	}

	const result: R2ReadObjectResult = await readR2Object(ctx, key, variant, client)
	if (result.response.status === 200 && result.size <= R2_WORKER_CACHE_MAX_BYTES) {
		await cache.put(cacheKey, result.response.clone())
		return withR2WorkerCacheHeader(result.response, 'miss')
	}
	return withR2WorkerCacheHeader(result.response, 'bypass')
}

async function readR2Object(
	ctx: Context<ApiEnv>,
	key: string,
	variant: string | undefined,
	client: R2Client
): Promise<R2ReadObjectResult> {
	try {
		if (!variant) {
			const result: R2GetResult = await client.get(key)
			return {
				response: toR2Response(ctx, result),
				size: result.size
			}
		}

		if (!isR2ImageVariantPreset(variant)) {
			return {
				response: ctx.json({}, 404),
				size: 0
			}
		}

		const result: R2GetResult = await client.getImageVariant(key, variant)
		return {
			response: toR2Response(ctx, result),
			size: result.size
		}
	} catch (error) {
		const handled: Response | undefined = mapR2ReadError(ctx, error)
		if (handled) {
			return {
				response: handled,
				size: 0
			}
		}
		throw error
	}
}

export async function uploadR2ObjectHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const key: string = toR2Key(ctx.req.path)
	const userId: string = ctx.get('userId')
	if (!isWritablePrivateKey(key, userId)) {
		return uploadError(ctx, 'INVALID_REQUEST')
	}
	return uploadR2Object(ctx, key)
}

export async function uploadR2PublicObjectHandler(ctx: Context<ApiEnv>): Promise<Response> {
	if (!ctx.req.path.startsWith(R2_ADMIN_PUBLIC_ROUTE_PREFIX)) {
		return uploadError(ctx, 'INVALID_REQUEST')
	}
	const key: string = toR2AdminPublicKey(ctx.req.path)
	if (!isWritablePublicKey(key)) {
		return uploadError(ctx, 'INVALID_REQUEST')
	}
	return uploadR2Object(ctx, key)
}

export async function readR2ImageOriginHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const expiresRaw = ctx.req.query('expires')
	const signature = ctx.req.query('signature')
	if (!expiresRaw || !signature) {
		return ctx.json({}, 403)
	}

	const expires = Number(expiresRaw)
	if (expires <= Math.floor(Date.now() / 1000)) {
		return ctx.json({}, 403)
	}

	const valid = await verifyR2Origin(
		ctx.env.R2_ORIGIN_SIGNING_SECRET,
		'GET',
		ctx.req.path,
		expires,
		signature
	)
	if (!valid) {
		return ctx.json({}, 403)
	}

	const key = toR2OriginKey(ctx.req.path)
	const client = createR2Client(ctx.env, privateOwner(key))
	try {
		const result = await client.get(key)
		return toR2Response(ctx, result)
	} catch (error) {
		const handled: Response | undefined = mapR2ReadError(ctx, error)
		if (handled) {
			return handled
		}
		throw error
	}
}

export function toR2Key(path: string): string {
	return path.slice(R2_ROUTE_PREFIX.length)
}

function toR2OriginKey(path: string): string {
	return path.slice(R2_IMAGE_ORIGIN_ROUTE_PREFIX.length)
}

function toR2AdminPublicKey(path: string): string {
	return `public/${path.slice(R2_ADMIN_PUBLIC_ROUTE_PREFIX.length)}`
}

async function uploadR2Object(ctx: Context<ApiEnv>, key: string): Promise<Response> {
	const contentLength: number | undefined = parseContentLength(ctx.req.header('content-length'))
	if (contentLength === undefined) {
		return uploadError(ctx, 'R2_UPLOAD_CONTENT_LENGTH_REQUIRED')
	}
	const storageConfig: StorageConfig = await getStorageConfig(ctx.get('metaDb'))
	if (contentLength > storageConfig.maxUploadBytes) {
		return uploadError(ctx, 'R2_USER_UPLOAD_SIZE_TOO_LARGE')
	}

	const contentType: string = ctx.req.header('content-type') ?? ''
	if (!storageConfig.allowedContentTypes.includes(contentType)) {
		return uploadError(ctx, 'R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED')
	}
	const env: Env & { R2?: R2Bucket } = ctx.env as Env & { R2?: R2Bucket }
	if (!env.R2) {
		throw new R2Error('R2_NOT_CONFIGURED')
	}
	const body: ReadableStream | null = ctx.req.raw.body
	if (!body) {
		return uploadError(ctx, 'INVALID_REQUEST')
	}

	await env.R2.put(key, body, {
		httpMetadata: {
			contentType
		}
	})

	return ctx.json({
		key,
		read_url: `${trimRightSlash(ctx.env.APP_BASE_URL)}/api/r2/${key}`
	})
}

function parseContentLength(value: string | undefined): number | undefined {
	if (value === undefined || value === '') {
		return undefined
	}
	const size: number = Number(value)
	if (!Number.isInteger(size) || size <= 0) {
		return undefined
	}
	return size
}

function isWritablePrivateKey(key: string, userId: string): boolean {
	if (!isUploadKeyPath(key)) {
		return false
	}
	if (key.startsWith(`private/${userId}/`)) {
		return true
	}
	return key.startsWith(`tmp/private/${userId}/`)
}

function isWritablePublicKey(key: string): boolean {
	if (!key.startsWith('public/')) {
		return false
	}
	return isUploadKeyPath(key)
}

function isUploadKeyPath(key: string): boolean {
	if (key.length === 0) {
		return false
	}
	if (key.split('/').includes('..')) {
		return false
	}
	return !key.endsWith('/')
}

function uploadError(
	ctx: Context<ApiEnv>,
	code:
		| 'INVALID_REQUEST'
		| 'R2_UPLOAD_CONTENT_LENGTH_REQUIRED'
		| 'R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED'
		| 'R2_USER_UPLOAD_SIZE_TOO_LARGE'
): Response {
	switch (code) {
		case 'INVALID_REQUEST':
			return ctx.json({ code, message: 'Invalid request' }, 400)
		case 'R2_UPLOAD_CONTENT_LENGTH_REQUIRED':
			return ctx.json({ code, message: 'Upload content length is required' }, 400)
		case 'R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED':
			return ctx.json({ code, message: 'Upload content type is not allowed' }, 400)
		case 'R2_USER_UPLOAD_SIZE_TOO_LARGE':
			return ctx.json({ code, message: 'Upload size is too large' }, 400)
	}
}

function isR2ImageVariantPreset(value: string): value is R2ImageVariantPreset {
	switch (value) {
		case 'small':
		case 'medium':
			return true
		default:
			return false
	}
}

function isCacheableR2ReadPath(path: string): boolean {
	if (path.startsWith('/api/r2/public/')) {
		return true
	}
	if (path.startsWith('/api/r2/tmp/public/')) {
		return true
	}
	return false
}

function defaultR2Cache(): Cache {
	const cacheStorage: CacheStorage & { default: Cache } = caches as CacheStorage & { default: Cache }
	return cacheStorage.default
}

function withR2WorkerCacheHeader(
	response: Response,
	value: 'hit' | 'miss' | 'bypass'
): Response {
	const headers: Headers = new Headers(response.headers)
	headers.set(R2_WORKER_CACHE_HEADER, value)
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	})
}

function privateOwner(key: string): string | undefined {
	if (!key.startsWith('private/')) {
		if (!key.startsWith('tmp/private/')) {
			return undefined
		}
		const tmpRemaining = key.slice('tmp/private/'.length)
		const tmpIndex = tmpRemaining.indexOf('/')
		if (tmpIndex === -1) {
			return tmpRemaining
		}
		return tmpRemaining.slice(0, tmpIndex)
	}
	const remaining = key.slice('private/'.length)
	const index = remaining.indexOf('/')
	if (index === -1) {
		return remaining
	}
	return remaining.slice(0, index)
}

function mapR2ReadError(ctx: Context<ApiEnv>, error: unknown): Response | undefined {
	if (!(error instanceof R2Error)) {
		return undefined
	}

	switch (error.code) {
		case 'R2_READ_FORBIDDEN':
			return ctx.json({}, 403)
		case 'R2_READ_NOT_FOUND':
		case 'R2_READ_PATH_INVALID':
			return ctx.json({}, 404)
		default:
			return undefined
	}
}

function toR2Response(ctx: Context<ApiEnv>, result: R2GetResult): Response {
	const headers = new Headers()
	headers.set('content-type', result.contentType)
	headers.set('etag', result.etag)
	headers.set('cache-control', cacheControlForR2Key(ctx.req.path, result.isPublic))
	return new Response(result.body, {
		status: 200,
		headers
	})
}

function cacheControlForR2Key(path: string, isPublic: boolean): string {
	if (path.startsWith('/api/r2/tmp/public/')) {
		return TMP_PUBLIC_CACHE_CONTROL
	}
	if (isPublic) {
		return PUBLIC_CACHE_CONTROL
	}
	return PRIVATE_CACHE_CONTROL
}

function trimRightSlash(rawUrl: string): string {
	if (rawUrl.endsWith('/')) {
		return rawUrl.slice(0, -1)
	}
	return rawUrl
}
