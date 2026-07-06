import type { Context } from 'hono'
import type { ApiEnv } from '..'
import {
	createR2Client,
	R2Error,
	verifyR2Origin,
	type R2Client,
	type R2CreateUploadUrlResult,
	type R2GetResult,
	type R2ImageVariantPreset
} from '../../r2'
import { parseRequest } from '../../lib/request'
import {
	CreateR2PublicUploadUrlApi,
	CreateR2UploadUrlApi,
	type CreateR2UploadUrlResponse
} from '../../../api-contract/r2'

const R2_ROUTE_PREFIX = '/api/r2/'
const R2_IMAGE_ORIGIN_ROUTE_PREFIX = '/api/internal/r2_image_origin/'

const PUBLIC_CACHE_CONTROL = 'public, max-age=31536000, immutable'
const TMP_PUBLIC_CACHE_CONTROL = 'public, max-age=300'
const PRIVATE_CACHE_CONTROL = 'private, no-store'
const R2_WORKER_CACHE_HEADER = 'x-r2-worker-cache'

export async function readR2ObjectHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const key: string = toR2Key(ctx.req.path)
	const variant: string | undefined = ctx.req.query('variant')
	const userId: string | undefined = ctx.get('userId') as string | undefined
	const client: R2Client = createR2Client(ctx.env, userId)

	if (!isCacheableR2ReadPath(ctx.req.path)) {
		const response: Response = await readR2Object(ctx, key, variant, client)
		return withR2WorkerCacheHeader(response, 'bypass')
	}

	const cacheKey: Request = new Request(ctx.req.raw.url, {
		method: 'GET'
	})
	const cache: Cache = defaultR2Cache()
	const cachedResponse: Response | undefined = await cache.match(cacheKey)
	if (cachedResponse) {
		return withR2WorkerCacheHeader(cachedResponse, 'hit')
	}

	const response: Response = await readR2Object(ctx, key, variant, client)
	if (response.status === 200) {
		await cache.put(cacheKey, response.clone())
	}
	return withR2WorkerCacheHeader(response, 'miss')
}

async function readR2Object(
	ctx: Context<ApiEnv>,
	key: string,
	variant: string | undefined,
	client: R2Client
): Promise<Response> {
	try {
		if (!variant) {
			const result: R2GetResult = await client.get(key)
			return toR2Response(ctx, result)
		}

		if (!isR2ImageVariantPreset(variant)) {
			return ctx.json({}, 404)
		}

		const result: R2GetResult = await client.getImageVariant(key, variant)
		return toR2Response(ctx, result)
	} catch (error) {
		const handled: Response | undefined = mapR2ReadError(ctx, error)
		if (handled) {
			return handled
		}
		throw error
	}
}

export async function createR2UploadUrlHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, CreateR2UploadUrlApi.request)
	if (!request.success) {
		const error = CreateR2UploadUrlApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	const req = request.data

	try {
		const client: R2Client = createR2Client(ctx.env, ctx.get('userId'))
		const path: { dir: string; filename: string } = splitUploadPath(req.path)
		const result: R2CreateUploadUrlResult = await client.createUploadUrl({
			isPublic: false,
			isTmp: req.is_tmp,
			dir: path.dir,
			filename: path.filename,
			contentType: req.content_type,
			size: req.size
		})
		return ctx.json(toCreateR2UploadUrlResponse(result))
	} catch (error) {
		if (error instanceof R2Error) {
			switch (error.code) {
				case 'R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED': {
					const response = CreateR2UploadUrlApi.errors.R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED()
					return ctx.json(response.body, response.status)
				}
				case 'R2_USER_UPLOAD_SIZE_TOO_LARGE': {
					const response = CreateR2UploadUrlApi.errors.R2_USER_UPLOAD_SIZE_TOO_LARGE()
					return ctx.json(response.body, response.status)
				}
				default:
					break
			}
		}
		throw error
	}
}

export async function createR2PublicUploadUrlHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, CreateR2PublicUploadUrlApi.request)
	if (!request.success) {
		const error = CreateR2PublicUploadUrlApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	const req = request.data

	try {
		const client: R2Client = createR2Client(ctx.env)
		const path: { dir: string; filename: string } = splitUploadPath(req.path)
		const result: R2CreateUploadUrlResult = await client.createUploadUrl({
			isPublic: true,
			dir: path.dir,
			filename: path.filename,
			contentType: req.content_type,
			size: req.size
		})
		return ctx.json(toCreateR2UploadUrlResponse(result))
	} catch (error) {
		if (error instanceof R2Error) {
			switch (error.code) {
				case 'R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED': {
					const response =
						CreateR2PublicUploadUrlApi.errors.R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED()
					return ctx.json(response.body, response.status)
				}
				case 'R2_USER_UPLOAD_SIZE_TOO_LARGE': {
					const response = CreateR2PublicUploadUrlApi.errors.R2_USER_UPLOAD_SIZE_TOO_LARGE()
					return ctx.json(response.body, response.status)
				}
				default:
					break
			}
		}
		throw error
	}
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

function splitUploadPath(path: string): { dir: string; filename: string } {
	const index = path.lastIndexOf('/')
	if (index === -1) {
		return {
			dir: '',
			filename: path
		}
	}
	return {
		dir: path.slice(0, index),
		filename: path.slice(index + 1)
	}
}

function toCreateR2UploadUrlResponse(
	result: R2CreateUploadUrlResult
): CreateR2UploadUrlResponse {
	return {
		key: result.key,
		upload_url: result.uploadUrl,
		read_url: result.readUrl,
		expires_at: result.expiresAt
	}
}

function toR2OriginKey(path: string): string {
	return path.slice(R2_IMAGE_ORIGIN_ROUTE_PREFIX.length)
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
