import type { Context } from 'hono'
import { z } from 'zod'
import type { ApiEnv } from '..'
import {
	newR2Client,
	verifyR2Origin,
	type R2GetResult,
	type R2ImageVariantPreset
} from '../../r2'
import { parseRequest } from '../../lib/request'

const R2_ROUTE_PREFIX = '/api/r2/'
const R2_IMAGE_ORIGIN_ROUTE_PREFIX = '/api/internal/r2_image_origin/'

const PUBLIC_CACHE_CONTROL = 'public, max-age=31536000, immutable'
const TMP_PUBLIC_CACHE_CONTROL = 'public, max-age=300'
const PRIVATE_CACHE_CONTROL = 'private, no-store'

const CreateR2UploadUrlRequestSchema = z.object({
	path: z.string().min(1).refine((path) => {
		if (path.startsWith('/')) {
			return false
		}
		return !path.split('/').includes('..')
	}),
	content_type: z.string().min(1),
	size: z.number().int().min(1)
})

const CreateR2TmpUploadUrlRequestSchema = CreateR2UploadUrlRequestSchema.extend({
	is_public: z.boolean()
})

export async function readR2ObjectHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const key = toR2Key(ctx.req.path)
	const variant = ctx.req.query('variant')
	const userId = ctx.get('userId') as string | undefined
	const client = newR2Client(ctx.env, userId)

	if (!variant) {
		const result = await client.get(key)
		return toR2Response(ctx, result)
	}

	if (!isR2ImageVariantPreset(variant)) {
		return ctx.json({}, 404)
	}

	const result = await client.getImageVariant(key, variant)
	return toR2Response(ctx, result)
}

export async function createR2TmpUploadUrlHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parseRequest(ctx, CreateR2TmpUploadUrlRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	try {
		const client = newR2Client(ctx.env, ctx.get('userId'))
		const result = await client.createTmpUploadUrl({
			isPublic: req.is_public,
			path: req.path,
			contentType: req.content_type,
			size: req.size
		})
		return ctx.json({
			key: result.key,
			upload_url: result.uploadUrl,
			read_url: result.readUrl,
			expires_at: result.expiresAt
		})
	} catch (error) {
		if (error instanceof Error && error.message === 'R2_UPLOAD_SIGNING_CONFIG_REQUIRED') {
			return ctx.json({ code: 'R2_UPLOAD_SIGNING_CONFIG_REQUIRED' }, 500)
		}
		if (error instanceof Error && error.message === 'R2_NOT_CONFIGURED') {
			return ctx.json({ code: 'R2_NOT_CONFIGURED' }, 500)
		}
		if (error instanceof Error && error.message === 'R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED') {
			return ctx.json({ code: 'R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED' }, 400)
		}
		if (error instanceof Error && error.message === 'R2_USER_UPLOAD_SIZE_TOO_LARGE') {
			return ctx.json({ code: 'R2_USER_UPLOAD_SIZE_TOO_LARGE' }, 400)
		}
		throw error
	}
}

export async function createR2UploadUrlHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parseRequest(ctx, CreateR2UploadUrlRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	try {
		const client = newR2Client(ctx.env, ctx.get('userId'))
		const result = await client.createUploadUrl({
			path: req.path,
			contentType: req.content_type,
			size: req.size
		})
		return ctx.json({
			key: result.key,
			upload_url: result.uploadUrl,
			read_url: result.readUrl,
			expires_at: result.expiresAt
		})
	} catch (error) {
		if (error instanceof Error && error.message === 'R2_UPLOAD_SIGNING_CONFIG_REQUIRED') {
			return ctx.json({ code: 'R2_UPLOAD_SIGNING_CONFIG_REQUIRED' }, 500)
		}
		if (error instanceof Error && error.message === 'R2_NOT_CONFIGURED') {
			return ctx.json({ code: 'R2_NOT_CONFIGURED' }, 500)
		}
		if (error instanceof Error && error.message === 'R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED') {
			return ctx.json({ code: 'R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED' }, 400)
		}
		if (error instanceof Error && error.message === 'R2_USER_UPLOAD_SIZE_TOO_LARGE') {
			return ctx.json({ code: 'R2_USER_UPLOAD_SIZE_TOO_LARGE' }, 400)
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
	const client = newR2Client(ctx.env, privateOwner(key))
	const result = await client.get(key)
	return toR2Response(ctx, result)
}

export function toR2Key(path: string): string {
	return path.slice(R2_ROUTE_PREFIX.length)
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

function privateOwner(key: string): string | undefined {
	if (!key.startsWith('private/')) {
		return undefined
	}
	const remaining = key.slice('private/'.length)
	const index = remaining.indexOf('/')
	if (index === -1) {
		return remaining
	}
	return remaining.slice(0, index)
}

function toR2Response(ctx: Context<ApiEnv>, result: R2GetResult): Response {
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
