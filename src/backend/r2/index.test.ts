import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import { createR2Client, R2Error } from './index'

type StoredObject = {
	body: string
	contentType: string
	etag: string
	size: number
}

type FetchCall = {
	url: string
	expires: string
	hasSignature: boolean
	image: RequestInitCfPropertiesImage
}

beforeEach(() => {
	vi.unstubAllGlobals()
})

describe('createR2Client.put', () => {
	type GivenDetail = Record<string, never>
	type WhenDetail = {
		userId?: string
		dir: string
		filename: string
		contentType: string
		body: string
	}
	type ThenExpected = {
		key: string
		url: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'uses public prefix when userId is empty',
			given: 'a public client',
			when: 'uploading a file',
			then: 'stores key under public prefix',
			givenDetail: {},
			whenDetail: {
				dir: 'images',
				filename: 'a.png',
				contentType: 'image/png',
				body: 'x'
			},
			thenExpected: {
				key: 'public/images/a.png',
				url: 'http://localhost:5173/api/r2/public/images/a.png'
			}
		},
		{
			scenario: 'uses private prefix and owner when userId exists',
			given: 'a private client with userId',
			when: 'uploading a file',
			then: 'stores key under private user prefix',
			givenDetail: {},
			whenDetail: {
				userId: 'u1',
				dir: 'images',
				filename: 'a.png',
				contentType: 'image/png',
				body: 'x'
			},
			thenExpected: {
				key: 'private/u1/images/a.png',
				url: 'http://localhost:5173/api/r2/private/u1/images/a.png'
			}
		}
	]

	runCases(cases, async (_given, when) => {
		const env = createEnv()
		const client = createR2Client(env, when.userId)
		const result = await client.put({
			dir: when.dir,
			filename: when.filename,
			contentType: when.contentType,
			body: when.body
		})
		return {
			key: result.key,
			url: result.url
		}
	})
})

describe('createR2Client.get', () => {
	type GivenDetail = {
		noR2?: boolean
		writeUserId?: string
		writeDir?: string
		writeFilename?: string
		writeBody?: string
		writeContentType?: string
	}
	type WhenDetail = {
		readUserId?: string
		key: string
	}
	type ThenExpected = {
		status: string
		contentType: string
		size: number
		error: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'throws when r2 binding is missing',
			given: 'runtime env does not include r2 bucket',
			when: 'reading any key',
			then: 'throws config error',
			givenDetail: {
				noR2: true
			},
			whenDetail: {
				key: 'public/assets/demo.txt'
			},
			thenExpected: {
				status: '',
				contentType: '',
				size: 0,
				error: 'R2_NOT_CONFIGURED'
			}
		},
		{
			scenario: 'reads public key',
			given: 'an existing public object',
			when: 'reading with public client',
			then: 'returns ok with content type',
			givenDetail: {
				writeDir: 'assets',
				writeFilename: 'demo.txt',
				writeBody: 'demo',
				writeContentType: 'text/plain'
			},
			whenDetail: {
				key: 'public/assets/demo.txt'
			},
			thenExpected: {
				status: 'ok',
				contentType: 'text/plain',
				size: 4,
				error: ''
			}
		},
		{
			scenario: 'reads private key for owner',
			given: 'an existing private object',
			when: 'reading with same user',
			then: 'returns ok',
			givenDetail: {
				writeUserId: 'u1',
				writeDir: 'docs',
				writeFilename: 'a.txt',
				writeBody: 'hello',
				writeContentType: 'text/plain'
			},
			whenDetail: {
				readUserId: 'u1',
				key: 'private/u1/docs/a.txt'
			},
			thenExpected: {
				status: 'ok',
				contentType: 'text/plain',
				size: 5,
				error: ''
			}
		},
		{
			scenario: 'rejects private key for non-owner',
			given: 'an existing private object',
			when: 'reading with another user',
			then: 'throws forbidden error',
			givenDetail: {
				writeUserId: 'u1',
				writeDir: 'docs',
				writeFilename: 'a.txt',
				writeBody: 'hello',
				writeContentType: 'text/plain'
			},
			whenDetail: {
				readUserId: 'u2',
				key: 'private/u1/docs/a.txt'
			},
			thenExpected: {
				status: '',
				contentType: '',
				size: 0,
				error: 'R2_READ_FORBIDDEN'
			}
		},
		{
			scenario: 'reads tmp public key without owner',
			given: 'an existing tmp public object',
			when: 'reading with public client',
			then: 'returns ok',
			givenDetail: {
				writeUserId: 'u1',
				writeDir: 'tmp-public/images',
				writeFilename: 'a.png',
				writeBody: 'image',
				writeContentType: 'image/png'
			},
			whenDetail: {
				key: 'tmp/public/images/a.png'
			},
			thenExpected: {
				status: 'ok',
				contentType: 'image/png',
				size: 5,
				error: ''
			}
		},
		{
			scenario: 'rejects tmp private key for non-owner',
			given: 'an existing tmp private object',
			when: 'reading with another user',
			then: 'throws forbidden error',
			givenDetail: {
				writeUserId: 'u1',
				writeDir: 'tmp-private/images',
				writeFilename: 'a.png',
				writeBody: 'image',
				writeContentType: 'image/png'
			},
			whenDetail: {
				readUserId: 'u2',
				key: 'tmp/private/u1/images/a.png'
			},
			thenExpected: {
				status: '',
				contentType: '',
				size: 0,
				error: 'R2_READ_FORBIDDEN'
			}
		},
		{
			scenario: 'throws not found when key is missing',
			given: 'no object at requested key',
			when: 'reading key',
			then: 'throws not found error',
			givenDetail: {},
			whenDetail: {
				key: 'public/missing.txt'
			},
			thenExpected: {
				status: '',
				contentType: '',
				size: 0,
				error: 'R2_READ_NOT_FOUND'
			}
		}
	]

	runCases(cases, async (given, when) => {
		const env = given.noR2 ? createEnvWithoutR2() : createEnv()
		if (
			given.writeDir &&
			given.writeFilename &&
			given.writeBody &&
			given.writeContentType
		) {
			const writer = createR2Client(env, given.writeUserId)
			if (given.writeDir.startsWith('tmp-public/')) {
				await writer.put({
					isPublic: true,
					isTmp: true,
					dir: given.writeDir.slice('tmp-public/'.length),
					filename: given.writeFilename,
					contentType: given.writeContentType,
					body: given.writeBody
				})
			} else if (given.writeDir.startsWith('tmp-private/')) {
				await writer.put({
					isPublic: false,
					isTmp: true,
					dir: given.writeDir.slice('tmp-private/'.length),
					filename: given.writeFilename,
					contentType: given.writeContentType,
					body: given.writeBody
				})
			} else {
				await writer.put({
					dir: given.writeDir,
					filename: given.writeFilename,
					contentType: given.writeContentType,
					body: given.writeBody
				})
			}
		}

		const reader = createR2Client(env, when.readUserId)
		try {
			const result = await reader.get(when.key)
				return {
					status: 'ok',
					contentType: result.contentType,
					size: result.size,
					error: ''
				}
			} catch (error) {
				return {
					status: '',
					contentType: '',
					size: 0,
					error: error instanceof R2Error ? error.code : ''
				}
			}
	})
})

describe('createR2Client.getImageVariant', () => {
	type GivenDetail = {
		noSecret?: boolean
		writeUserId?: string
	}
	type WhenDetail = {
		readUserId?: string
		key: string
		preset: 'small' | 'medium'
	}
	type ThenExpected = {
		status: string
		contentType: string
		fetchCalls: number
		url: string
		expires: string
		hasSignature: boolean
		width: number
		fit: string
		quality: number
		format: string
		error: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'throws when origin signing secret is missing',
			given: 'r2 exists and signing secret is empty',
			when: 'reading an image variant',
			then: 'throws config error before fetching origin',
			givenDetail: {
				noSecret: true
			},
			whenDetail: {
				key: 'public/images/a.png',
				preset: 'small'
			},
			thenExpected: {
				status: '',
				contentType: '',
				fetchCalls: 0,
				url: '',
				expires: '',
				hasSignature: false,
				width: 0,
				fit: '',
				quality: 0,
				format: '',
				error: 'R2_ORIGIN_SIGNING_SECRET_REQUIRED'
			}
		},
		{
			scenario: 'rejects private key for non owner',
			given: 'a private object owned by another user',
			when: 'reading variant with different user',
			then: 'throws forbidden error without fetching origin',
			givenDetail: {
				writeUserId: 'u1'
			},
			whenDetail: {
				readUserId: 'u2',
				key: 'private/u1/images/a.png',
				preset: 'medium'
			},
			thenExpected: {
				status: '',
				contentType: '',
				fetchCalls: 0,
				url: '',
				expires: '',
				hasSignature: false,
				width: 0,
				fit: '',
				quality: 0,
				format: '',
				error: 'R2_READ_FORBIDDEN'
			}
		},
		{
			scenario: 'rejects key without allowed prefix',
			given: 'r2 exists',
			when: 'reading variant for invalid key',
			then: 'throws invalid path error without fetching origin',
			givenDetail: {},
			whenDetail: {
				key: 'images/a.png',
				preset: 'medium'
			},
			thenExpected: {
				status: '',
				contentType: '',
				fetchCalls: 0,
				url: '',
				expires: '',
				hasSignature: false,
				width: 0,
				fit: '',
				quality: 0,
				format: '',
				error: 'R2_READ_PATH_INVALID'
			}
		},
		{
			scenario: 'fetches small variant through signed image origin',
			given: 'a public image',
			when: 'reading small variant',
			then: 'uses fixed Cloudflare image options',
			givenDetail: {},
			whenDetail: {
				key: 'public/images/a.png',
				preset: 'small'
			},
			thenExpected: {
				status: 'ok',
				contentType: 'image/jpeg',
				fetchCalls: 1,
				url: 'http://localhost:5173/api/internal/r2_image_origin/public/images/a.png',
				expires: '60',
				hasSignature: true,
				width: 320,
				fit: 'scale-down',
				quality: 75,
				format: 'jpeg',
				error: ''
			}
		}
	]

	runCases(cases, async (given, when) => {
		const fetchCalls: FetchCall[] = []
		vi.stubGlobal(
			'fetch',
			async (request: Request, init?: RequestInit<RequestInitCfProperties>): Promise<Response> => {
				fetchCalls.push({
					url: `${new URL(request.url).origin}${new URL(request.url).pathname}`,
					expires: new URL(request.url).searchParams.get('expires') ?? '',
					hasSignature: Boolean(new URL(request.url).searchParams.get('signature')),
					image: init?.cf?.image ?? {}
				})
				return new Response('variant', {
					status: 200,
					headers: {
						'content-type': 'image/jpeg',
						etag: '"variant-etag"'
					}
				})
			}
		)
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

		const env = createEnv()
		if (given.noSecret) {
			const writableEnv = env as unknown as { R2_ORIGIN_SIGNING_SECRET: string }
			writableEnv.R2_ORIGIN_SIGNING_SECRET = ''
		}
		if (given.writeUserId) {
			const writer = createR2Client(env, given.writeUserId)
			await writer.put({
				dir: 'images',
				filename: 'a.png',
				contentType: 'image/png',
				body: 'image'
			})
		}

		try {
			const client = createR2Client(env, when.readUserId)
			const result = await client.getImageVariant(when.key, when.preset)
			const call = fetchCalls[0]
			return {
				status: 'ok',
				contentType: result.contentType,
				fetchCalls: fetchCalls.length,
				url: call?.url ?? '',
				expires: call ? String(Number(call.expires) - 1767225600) : '',
				hasSignature: call?.hasSignature ?? false,
				width: call?.image.width ?? 0,
				fit: call?.image.fit ?? '',
				quality: Number(call?.image.quality ?? 0),
				format: call?.image.format ?? '',
				error: ''
			}
		} catch (error) {
			return {
				status: '',
				contentType: '',
				fetchCalls: fetchCalls.length,
				url: '',
				expires: '',
				hasSignature: false,
				width: 0,
				fit: '',
				quality: 0,
				format: '',
				error: error instanceof R2Error ? error.code : ''
			}
		}
	})
})

function createEnv(): Env & { R2: R2Bucket } {
	const objects: Map<string, StoredObject> = new Map()
	const r2 = {
		put: async (
			key: string,
			value: string | ArrayBuffer | Uint8Array | ReadableStream,
			options?: R2PutOptions
		): Promise<R2Object> => {
			const textBody = await new Response(value as BodyInit).text()
			const metadata = options?.httpMetadata
			const contentType =
				metadata instanceof Headers
					? metadata.get('content-type') ?? 'application/octet-stream'
					: metadata?.contentType ?? 'application/octet-stream'
			objects.set(key, {
				body: textBody,
				contentType,
				etag: `"${key}-etag"`,
				size: textBody.length
			})
			return {} as R2Object
		},
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
				httpEtag: item.etag,
				size: item.size
			} as unknown as R2ObjectBody
		}
	} as R2Bucket

	return {
		APP_NAME: 'opcstack',
		APP_BASE_URL: 'http://localhost:5173',
		R2_ACCOUNT_ID: 'abc',
		R2_ORIGIN_SIGNING_SECRET: 'test-secret',
		R2: r2
	} as unknown as Env & { R2: R2Bucket }
}

function createEnvWithoutR2(): Env {
	return {
		APP_NAME: 'opcstack',
		APP_BASE_URL: 'http://localhost:5173',
		R2_ACCOUNT_ID: 'abc',
		R2_ORIGIN_SIGNING_SECRET: 'test-secret'
	} as unknown as Env
}
