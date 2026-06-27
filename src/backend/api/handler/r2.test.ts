import { beforeEach, describe, vi } from 'vitest'
import type { Context } from 'hono'
import { runCases, type TestCase } from '../../testing/bdd'
import type { ApiEnv } from '..'
import { signR2Origin } from '../../r2'
import {
	createR2TmpUploadUrlHandler,
	createR2UploadUrlHandler,
	readR2ImageOriginHandler,
	readR2ObjectHandler,
	toR2Key
} from './r2'

beforeEach(() => {
	vi.unstubAllGlobals()
})

describe('toR2Key', () => {
	type GivenDetail = Record<string, never>
	type WhenPath = { path: string }
	type ThenKey = { key: string }

	const cases: TestCase<GivenDetail, WhenPath, ThenKey>[] = [
		{
			scenario: 'maps public route path to bucket key',
			given: 'a request path with /api/r2 prefix',
			when: 'building r2 key from the path',
			then: 'returns key after the prefix',
			givenDetail: {},
			whenDetail: { path: '/api/r2/public/images/demo.png' },
			thenExpected: { key: 'public/images/demo.png' }
		},
		{
			scenario: 'maps private route path to bucket key',
			given: 'a request path with /api/r2 prefix',
			when: 'building r2 key from the path',
			then: 'returns key after the prefix',
			givenDetail: {},
			whenDetail: { path: '/api/r2/private/u1/a.txt' },
			thenExpected: { key: 'private/u1/a.txt' }
		}
	]

	runCases(cases, (_given, when) => {
		return { key: toR2Key(when.path) }
	})
})

describe('readR2ObjectHandler', () => {
	type GivenDetail = Record<string, never>
	type WhenDetail = {
		variant?: string
	}
	type ThenExpected = {
		status: number
		contentType: string
		body: string
		width: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'reads original object when variant is empty',
			given: 'an existing public image',
			when: 'reading r2 object without variant query',
			then: 'returns original object',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				status: 200,
				contentType: 'image/png',
				body: 'image',
				width: 0
			}
		},
		{
			scenario: 'reads small image variant from original route',
			given: 'an existing public image',
			when: 'reading r2 object with small variant query',
			then: 'returns transformed image',
			givenDetail: {},
			whenDetail: {
				variant: 'small'
			},
			thenExpected: {
				status: 200,
				contentType: 'image/jpeg',
				body: 'variant',
				width: 320
			}
		},
		{
			scenario: 'rejects unknown image variant',
			given: 'an existing public image',
			when: 'reading r2 object with unknown variant query',
			then: 'returns not found',
			givenDetail: {},
			whenDetail: {
				variant: 'huge'
			},
			thenExpected: {
				status: 404,
				contentType: 'application/json',
				body: '{}',
				width: 0
			}
		}
	]

	runCases(cases, async (_given, when) => {
		stubCaches()
		let imageWidth = 0
		vi.stubGlobal(
			'fetch',
			async (_request: Request, init?: RequestInit<RequestInitCfProperties>): Promise<Response> => {
				imageWidth = init?.cf?.image?.width ?? 0
				return new Response('variant', {
					status: 200,
					headers: {
						'content-type': 'image/jpeg',
						etag: '"variant-etag"'
					}
				})
			}
		)

		const response = await readR2ObjectHandler(
			createContext('/api/r2/public/images/a.png', new Headers(), when.variant)
		)
		return {
			status: response.status,
			contentType: response.headers.get('content-type') ?? '',
			body: await response.text(),
			width: imageWidth
		}
	})
})

describe('readR2ObjectHandler cache', () => {
	type GivenDetail = {
		path: string
		userId?: string
	}
	type WhenDetail = {
		readCount: number
	}
	type ThenExpected = {
		firstStatus: number
		secondStatus: number
		firstCache: string
		secondCache: string
		r2GetCount: number
		cacheMatchCount: number
		cachePutCount: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'caches public object after miss',
			given: 'an existing public object',
			when: 'reading the same public url twice',
			then: 'returns miss then hit without reading r2 again',
			givenDetail: {
				path: '/api/r2/public/images/a.png'
			},
			whenDetail: {
				readCount: 2
			},
			thenExpected: {
				firstStatus: 200,
				secondStatus: 200,
				firstCache: 'miss',
				secondCache: 'hit',
				r2GetCount: 1,
				cacheMatchCount: 2,
				cachePutCount: 1
			}
		},
		{
			scenario: 'bypasses cache for private object',
			given: 'an existing private object',
			when: 'reading the same private url twice',
			then: 'returns bypass and reads r2 every time',
			givenDetail: {
				path: '/api/r2/private/u1/a.txt',
				userId: 'u1'
			},
			whenDetail: {
				readCount: 2
			},
			thenExpected: {
				firstStatus: 200,
				secondStatus: 200,
				firstCache: 'bypass',
				secondCache: 'bypass',
				r2GetCount: 2,
				cacheMatchCount: 0,
				cachePutCount: 0
			}
		},
		{
			scenario: 'caches tmp public object after miss',
			given: 'an existing tmp public object',
			when: 'reading the same tmp public url twice',
			then: 'returns miss then hit without reading r2 again',
			givenDetail: {
				path: '/api/r2/tmp/public/a.txt'
			},
			whenDetail: {
				readCount: 2
			},
			thenExpected: {
				firstStatus: 200,
				secondStatus: 200,
				firstCache: 'miss',
				secondCache: 'hit',
				r2GetCount: 1,
				cacheMatchCount: 2,
				cachePutCount: 1
			}
		}
	]

	runCases(cases, async (given, when) => {
		const cacheStats = stubCaches()
		let r2GetCount = 0
		const r2 = createR2Bucket((): void => {
			r2GetCount += 1
		})
		const env = createEnvWithR2(r2)
		const responses: Response[] = []

		for (let index = 0; index < when.readCount; index += 1) {
			const response = await readR2ObjectHandler(
				createContext(given.path, new Headers(), undefined, undefined, {
					env,
					userId: given.userId
				})
			)
			responses.push(response)
			await response.text()
		}

		const firstResponse = responses[0]
		const secondResponse = responses[1]
		if (!firstResponse || !secondResponse) {
			throw new Error('TEST_RESPONSE_MISSING')
		}
		return {
			firstStatus: firstResponse.status,
			secondStatus: secondResponse.status,
			firstCache: firstResponse.headers.get('x-r2-worker-cache') ?? '',
			secondCache: secondResponse.headers.get('x-r2-worker-cache') ?? '',
			r2GetCount,
			cacheMatchCount: cacheStats.matchCount,
			cachePutCount: cacheStats.putCount
		}
	})
})

describe('readR2ObjectHandler variant cache', () => {
	type GivenDetail = Record<string, never>
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		smallFirstBody: string
		mediumBody: string
		smallSecondBody: string
		smallFirstCache: string
		mediumCache: string
		smallSecondCache: string
		imageFetchCount: number
		cacheMatchCount: number
		cachePutCount: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'caches image variants by full url',
			given: 'an existing public image',
			when: 'reading small medium then small variant',
			then: 'keeps each variant as a different cache entry',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				smallFirstBody: 'variant-320',
				mediumBody: 'variant-1024',
				smallSecondBody: 'variant-320',
				smallFirstCache: 'miss',
				mediumCache: 'miss',
				smallSecondCache: 'hit',
				imageFetchCount: 2,
				cacheMatchCount: 3,
				cachePutCount: 2
			}
		}
	]

	runCases(cases, async () => {
		const cacheStats = stubCaches()
		let imageFetchCount = 0
		vi.stubGlobal(
			'fetch',
			async (_request: Request, init?: RequestInit<RequestInitCfProperties>): Promise<Response> => {
				imageFetchCount += 1
				const width = init?.cf?.image?.width ?? 0
				return new Response(`variant-${width}`, {
					status: 200,
					headers: {
						'content-type': 'image/jpeg',
						etag: `"variant-${width}"`
					}
				})
			}
		)

		const env = createEnv()
		const smallFirstResponse = await readR2ObjectHandler(
			createContext('/api/r2/public/images/a.png', new Headers(), 'small', undefined, { env })
		)
		const mediumResponse = await readR2ObjectHandler(
			createContext('/api/r2/public/images/a.png', new Headers(), 'medium', undefined, { env })
		)
		const smallSecondResponse = await readR2ObjectHandler(
			createContext('/api/r2/public/images/a.png', new Headers(), 'small', undefined, { env })
		)

		return {
			smallFirstBody: await smallFirstResponse.text(),
			mediumBody: await mediumResponse.text(),
			smallSecondBody: await smallSecondResponse.text(),
			smallFirstCache: smallFirstResponse.headers.get('x-r2-worker-cache') ?? '',
			mediumCache: mediumResponse.headers.get('x-r2-worker-cache') ?? '',
			smallSecondCache: smallSecondResponse.headers.get('x-r2-worker-cache') ?? '',
			imageFetchCount,
			cacheMatchCount: cacheStats.matchCount,
			cachePutCount: cacheStats.putCount
		}
	})
})

describe('readR2ImageOriginHandler', () => {
	type GivenDetail = {
		action: 'missing_signature' | 'expired_signature' | 'wrong_signature' | 'valid_signature'
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		contentType: string
		body: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'rejects origin request without signature',
			given: 'an origin request without hmac query',
			when: 'reading r2 origin',
			then: 'returns forbidden',
			givenDetail: {
				action: 'missing_signature'
			},
			whenDetail: {},
			thenExpected: {
				status: 403,
				contentType: 'application/json',
				body: '{}'
			}
		},
		{
			scenario: 'rejects origin request with expired signature',
			given: 'an origin request with past expires',
			when: 'reading r2 origin',
			then: 'returns forbidden',
			givenDetail: {
				action: 'expired_signature'
			},
			whenDetail: {},
			thenExpected: {
				status: 403,
				contentType: 'application/json',
				body: '{}'
			}
		},
		{
			scenario: 'rejects origin request with wrong signature',
			given: 'an origin request with mismatched hmac',
			when: 'reading r2 origin',
			then: 'returns forbidden',
			givenDetail: {
				action: 'wrong_signature'
			},
			whenDetail: {},
			thenExpected: {
				status: 403,
				contentType: 'application/json',
				body: '{}'
			}
		},
		{
			scenario: 'reads origin request with valid signature',
			given: 'an origin request with valid hmac query',
			when: 'reading r2 origin',
			then: 'returns original r2 object',
			givenDetail: {
				action: 'valid_signature'
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				contentType: 'image/png',
				body: 'image'
			}
		}
	]

	runCases(cases, async (given) => {
		const path = '/api/internal/r2_image_origin/public/images/a.png'
		const expires = given.action === 'expired_signature' ? 1 : 4102444800
		const headers = new Headers()
		const query = new Map<string, string>()
		if (given.action !== 'missing_signature') {
			query.set('expires', String(expires))
			if (given.action === 'wrong_signature') {
				query.set('signature', 'bad-signature')
			} else {
				query.set('signature', await signR2Origin('test-secret', 'GET', path, expires))
			}
		}

		const response = await readR2ImageOriginHandler(createContext(path, headers, undefined, query))
		return {
			status: response.status,
			contentType: response.headers.get('content-type') ?? '',
			body: await response.text()
		}
	})
})

describe('createR2UploadUrlHandler', () => {
	type GivenDetail = {
		body: unknown
		userId: string
		noAccessKey?: boolean
		allowedContentTypes?: string
		maxBytes?: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		key: string
		readUrl: string
		hasUploadUrl: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'rejects invalid upload url request',
			given: 'path is absolute',
			when: 'creating upload url',
			then: 'returns invalid request',
			givenDetail: {
				userId: 'u1',
				body: {
					path: '/avatars/me.png',
					content_type: 'image/png',
					size: 1024
				}
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'INVALID_REQUEST',
				key: '',
				readUrl: '',
				hasUploadUrl: false
			}
		},
		{
			scenario: 'creates upload url for current user private path',
			given: 'path and content type are valid',
			when: 'creating upload url',
			then: 'returns private key and signed upload url',
			givenDetail: {
				userId: 'u1',
				body: {
					path: 'avatars/me.png',
					content_type: 'image/png',
					size: 1024
				}
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				key: 'private/u1/avatars/me.png',
				readUrl: 'http://localhost:5173/api/r2/private/u1/avatars/me.png',
				hasUploadUrl: true
			}
		},
		{
			scenario: 'fails when upload signing config is missing',
			given: 'access key is empty',
			when: 'creating upload url',
			then: 'returns server error',
			givenDetail: {
				userId: 'u1',
				noAccessKey: true,
				body: {
					path: 'avatars/me.png',
					content_type: 'image/png',
					size: 1024
				}
			},
			whenDetail: {},
			thenExpected: {
				status: 500,
				code: 'R2_UPLOAD_SIGNING_CONFIG_REQUIRED',
				key: '',
				readUrl: '',
				hasUploadUrl: false
			}
		},
		{
			scenario: 'rejects disallowed upload content type',
			given: 'content type is not configured as allowed',
			when: 'creating upload url',
			then: 'returns content type error',
			givenDetail: {
				userId: 'u1',
				allowedContentTypes: 'image/png',
				body: {
					path: 'avatars/me.txt',
					content_type: 'text/plain',
					size: 1024
				}
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED',
				key: '',
				readUrl: '',
				hasUploadUrl: false
			}
		},
		{
			scenario: 'rejects upload size over limit',
			given: 'size is greater than configured max bytes',
			when: 'creating upload url',
			then: 'returns size error',
			givenDetail: {
				userId: 'u1',
				maxBytes: '100',
				body: {
					path: 'avatars/me.png',
					content_type: 'image/png',
					size: 101
				}
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'R2_USER_UPLOAD_SIZE_TOO_LARGE',
				key: '',
				readUrl: '',
				hasUploadUrl: false
			}
		}
	]

	runCases(cases, async (given) => {
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
		const env = createEnv()
		if (given.noAccessKey) {
			const writableEnv = env as unknown as { R2_ACCESS_KEY_ID: string }
			writableEnv.R2_ACCESS_KEY_ID = ''
		}
		if (given.allowedContentTypes) {
			const writableEnv = env as unknown as { R2_USER_UPLOAD_ALLOWED_CONTENT_TYPES: string }
			writableEnv.R2_USER_UPLOAD_ALLOWED_CONTENT_TYPES = given.allowedContentTypes
		}
		if (given.maxBytes) {
			const writableEnv = env as unknown as { R2_USER_UPLOAD_MAX_BYTES: string }
			writableEnv.R2_USER_UPLOAD_MAX_BYTES = given.maxBytes
		}

		const response = await createR2UploadUrlHandler(
			createJsonContext(given.userId, given.body, env)
		)
		const payload = (await response.json()) as {
			code?: string
			key?: string
			read_url?: string
			upload_url?: string
		}
		return {
			status: response.status,
			code: payload.code ?? '',
			key: payload.key ?? '',
			readUrl: payload.read_url ?? '',
			hasUploadUrl: Boolean(payload.upload_url)
		}
	})
})

describe('createR2TmpUploadUrlHandler', () => {
	type GivenDetail = {
		body: unknown
		userId: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		key: string
		readUrl: string
		hasUploadUrl: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'rejects invalid tmp upload isPublic',
			given: 'is_public is not boolean',
			when: 'creating tmp upload url',
			then: 'returns invalid request',
			givenDetail: {
				userId: 'u1',
				body: {
					is_public: 'yes',
					path: 'images/a.png',
					content_type: 'image/png',
					size: 1024
				}
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'INVALID_REQUEST',
				key: '',
				readUrl: '',
				hasUploadUrl: false
			}
		},
		{
			scenario: 'creates tmp upload url for public tmp path',
			given: 'is_public is true',
			when: 'creating tmp upload url',
			then: 'returns tmp public key and signed upload url',
			givenDetail: {
				userId: 'u1',
				body: {
					is_public: true,
					path: 'images/a.png',
					content_type: 'image/png',
					size: 1024
				}
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				key: 'tmp/public/images/a.png',
				readUrl: 'http://localhost:5173/api/r2/tmp/public/images/a.png',
				hasUploadUrl: true
			}
		},
		{
			scenario: 'creates tmp upload url for private tmp path',
			given: 'is_public is false',
			when: 'creating tmp upload url',
			then: 'returns tmp private key and signed upload url',
			givenDetail: {
				userId: 'u1',
				body: {
					is_public: false,
					path: 'images/a.png',
					content_type: 'image/png',
					size: 1024
				}
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				key: 'tmp/private/u1/images/a.png',
				readUrl: 'http://localhost:5173/api/r2/tmp/private/u1/images/a.png',
				hasUploadUrl: true
			}
		}
	]

	runCases(cases, async (given) => {
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
		const response = await createR2TmpUploadUrlHandler(
			createJsonContext(given.userId, given.body, createEnv())
		)
		const payload = (await response.json()) as {
			code?: string
			key?: string
			read_url?: string
			upload_url?: string
		}
		return {
			status: response.status,
			code: payload.code ?? '',
			key: payload.key ?? '',
			readUrl: payload.read_url ?? '',
			hasUploadUrl: Boolean(payload.upload_url)
		}
	})
})

type StoredObject = {
	body: string
	contentType: string
	etag: string
}

type CreateContextOptions = {
	env?: Env & { R2: R2Bucket }
	userId?: string
}

type CacheStats = {
	matchCount: number
	putCount: number
}

function createEnv(): Env & { R2: R2Bucket } {
	const r2 = createR2Bucket()
	return createEnvWithR2(r2)
}

function createEnvWithR2(r2: R2Bucket): Env & { R2: R2Bucket } {
	return {
		APP_NAME: 'opcstack',
		APP_BASE_URL: 'http://localhost:5173',
		R2_ACCOUNT_ID: 'abc',
		R2_ACCESS_KEY_ID: 'access-key',
		R2_SECRET_ACCESS_KEY: 'secret-key',
		R2_USER_UPLOAD_ALLOWED_CONTENT_TYPES: 'image/png;image/jpeg;image/webp',
		R2_USER_UPLOAD_MAX_BYTES: '5242880',
		R2_ORIGIN_SIGNING_SECRET: 'test-secret',
		R2: r2
	} as unknown as Env & { R2: R2Bucket }
}

function createJsonContext(
	userId: string,
	body: unknown,
	env: Env & { R2: R2Bucket }
): Context<ApiEnv> {
	return {
		env,
		req: {
			json: async <T>(): Promise<T> => {
				return body as T
			}
		},
		get: (key: string): unknown => {
			if (key === 'userId') {
				return userId
			}
			return undefined
		},
		json: (payload: unknown, status?: number): Response => {
			return new Response(JSON.stringify(payload), {
				status: status ?? 200,
				headers: {
					'content-type': 'application/json'
				}
			})
		}
	} as unknown as Context<ApiEnv>
}

function createContext(
	path: string,
	headers: Headers,
	variant?: string,
	query?: Map<string, string>,
	options?: CreateContextOptions
): Context<ApiEnv> {
	const env = options?.env ?? createEnv()

	return {
		env,
		req: {
			path,
			raw: new Request(createRequestUrl(env.APP_BASE_URL, path, variant, query)),
			header: (name: string): string | undefined => {
				return headers.get(name) ?? undefined
			},
			query: (name: string): string | undefined => {
				if (name === 'variant') {
					return variant
				}
				return query?.get(name)
			}
		},
		get: (key: string): unknown => {
			if (key === 'userId') {
				return options?.userId
			}
			return undefined
		},
		json: (payload: unknown, status?: number): Response => {
			return new Response(JSON.stringify(payload), {
				status: status ?? 200,
				headers: {
					'content-type': 'application/json'
				}
			})
		}
	} as unknown as Context<ApiEnv>
}

function createR2Bucket(onGet?: (key: string) => void): R2Bucket {
	const objects: Map<string, StoredObject> = new Map()
	objects.set('public/images/a.png', {
		body: 'image',
		contentType: 'image/png',
		etag: '"etag"'
	})
	objects.set('tmp/public/a.txt', {
		body: 'tmp',
		contentType: 'text/plain',
		etag: '"tmp-etag"'
	})
	objects.set('private/u1/a.txt', {
		body: 'private',
		contentType: 'text/plain',
		etag: '"private-etag"'
	})

	const r2 = {
		get: async (key: string): Promise<R2ObjectBody | null> => {
			if (onGet) {
				onGet(key)
			}
			const item = objects.get(key)
			if (!item) {
				return null
			}
			return {
				body: new Response(item.body).body,
				httpMetadata: {
					contentType: item.contentType
				},
				httpEtag: item.etag
			} as unknown as R2ObjectBody
		}
	} as R2Bucket
	return r2
}

function createRequestUrl(
	baseUrl: string,
	path: string,
	variant?: string,
	query?: Map<string, string>
): string {
	const url = new URL(path, baseUrl)
	if (variant) {
		url.searchParams.set('variant', variant)
	}
	if (query) {
		for (const entry of query.entries()) {
			url.searchParams.set(entry[0], entry[1])
		}
	}
	return url.toString()
}

function stubCaches(): CacheStats {
	const responses: Map<string, Response> = new Map()
	const stats: CacheStats = {
		matchCount: 0,
		putCount: 0
	}
	const cache = {
		match: async (request: RequestInfo | URL): Promise<Response | undefined> => {
			stats.matchCount += 1
			const response = responses.get(cacheKey(request))
			if (!response) {
				return undefined
			}
			return response.clone()
		},
		put: async (request: RequestInfo | URL, response: Response): Promise<void> => {
			stats.putCount += 1
			responses.set(cacheKey(request), response.clone())
		}
	} as unknown as Cache

	vi.stubGlobal('caches', {
		default: cache
	})
	return stats
}

function cacheKey(request: RequestInfo | URL): string {
	if (typeof request === 'string') {
		return request
	}
	if (request instanceof URL) {
		return request.toString()
	}
	return request.url
}
