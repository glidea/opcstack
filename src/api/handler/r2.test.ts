import { beforeEach, describe, vi } from 'vitest'
import type { Context } from 'hono'
import { runCases, type TestCase } from '../../testing/bdd'
import type { ApiEnv } from '..'
import { signR2Origin } from '../../r2'
import { readR2ImageOriginHandler, readR2ObjectHandler, toR2Key } from './r2'

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
			given: 'an origin request without hmac headers',
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
			given: 'an origin request with valid hmac headers',
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
		if (given.action !== 'missing_signature') {
			headers.set('x-r2-origin-expires', String(expires))
			if (given.action === 'wrong_signature') {
				headers.set('x-r2-origin-signature', 'bad-signature')
			} else {
				headers.set(
					'x-r2-origin-signature',
					await signR2Origin('test-secret', 'GET', path, expires)
				)
			}
		}

		const response = await readR2ImageOriginHandler(createContext(path, headers))
		return {
			status: response.status,
			contentType: response.headers.get('content-type') ?? '',
			body: await response.text()
		}
	})
})

type StoredObject = {
	body: string
	contentType: string
	etag: string
}

function createContext(path: string, headers: Headers, variant?: string): Context<ApiEnv> {
	const objects: Map<string, StoredObject> = new Map()
	objects.set('public/images/a.png', {
		body: 'image',
		contentType: 'image/png',
		etag: '"etag"'
	})

	const r2 = {
		get: async (key: string): Promise<R2ObjectBody | null> => {
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

	return {
		env: {
			APP_BASE_URL: 'http://localhost:5173',
			R2_ORIGIN_SIGNING_SECRET: 'test-secret',
			R2: r2
		},
		req: {
			path,
			header: (name: string): string | undefined => {
				return headers.get(name) ?? undefined
			},
			query: (name: string): string | undefined => {
				if (name === 'variant') {
					return variant
				}
				return undefined
			}
		},
		get: (): unknown => {
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
