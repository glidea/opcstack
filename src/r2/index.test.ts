import { describe } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import { newR2Client } from './index'

type StoredObject = {
	body: string
	contentType: string
	etag: string
}

describe('newR2Client.put', () => {
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
		const client = newR2Client(env, when.userId)
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

describe('newR2Client.putImage', () => {
	type GivenDetail = Record<string, never>
	type WhenDetail = {
		userId?: string
		dir: string
		filename?: string
		imageBase64: string
		mimeType: string
	}
	type ThenExpected = {
		key: string
		keyStartsWith: boolean
		keyEndsWith: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'creates image filename by mime type when filename is empty',
			given: 'a public client',
			when: 'uploading image without filename',
			then: 'creates filename and keeps mime extension',
			givenDetail: {},
			whenDetail: {
				dir: 'images',
				imageBase64: 'aA==',
				mimeType: 'image/webp'
			},
			thenExpected: {
				key: '',
				keyStartsWith: true,
				keyEndsWith: true
			}
		},
		{
			scenario: 'uses private prefix for image upload when userId exists',
			given: 'a private client with userId',
			when: 'uploading image with filename',
			then: 'stores key under private user prefix',
			givenDetail: {},
			whenDetail: {
				userId: 'u1',
				dir: 'images',
				filename: 'a.png',
				imageBase64: 'aA==',
				mimeType: 'image/png'
			},
			thenExpected: {
				key: 'private/u1/images/a.png',
				keyStartsWith: true,
				keyEndsWith: true
			}
		}
	]

	runCases(cases, async (_given, when) => {
		const env = createEnv()
		const client = newR2Client(env, when.userId)
		const result = await client.putImage({
			dir: when.dir,
			imageBase64: when.imageBase64,
			mimeType: when.mimeType,
			...(when.filename ? { filename: when.filename } : {})
		})
		return {
			key: when.filename ? result.key : '',
			keyStartsWith: result.key.startsWith(
				when.userId ? `private/${when.userId}/${when.dir}/` : `public/${when.dir}/`
			),
			keyEndsWith: result.key.endsWith(when.filename ? when.filename : '.webp')
		}
	})
})

describe('newR2Client.get', () => {
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
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'returns unavailable when r2 binding is missing',
			given: 'runtime env does not include r2 bucket',
			when: 'reading any key',
			then: 'returns unavailable',
			givenDetail: {
				noR2: true
			},
			whenDetail: {
				key: 'public/assets/demo.txt'
			},
			thenExpected: {
				status: 'unavailable',
				contentType: ''
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
				contentType: 'text/plain'
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
				contentType: 'text/plain'
			}
		},
		{
			scenario: 'rejects private key for non-owner',
			given: 'an existing private object',
			when: 'reading with another user',
			then: 'returns forbidden',
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
				status: 'forbidden',
				contentType: ''
			}
		},
		{
			scenario: 'returns not_found when key is missing',
			given: 'no object at requested key',
			when: 'reading key',
			then: 'returns not_found',
			givenDetail: {},
			whenDetail: {
				key: 'public/missing.txt'
			},
			thenExpected: {
				status: 'not_found',
				contentType: ''
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
			const writer = newR2Client(env, given.writeUserId)
			await writer.put({
				dir: given.writeDir,
				filename: given.writeFilename,
				contentType: given.writeContentType,
				body: given.writeBody
			})
		}

		const reader = newR2Client(env, when.readUserId)
		const result = await reader.get(when.key)
		if (result.status !== 'ok') {
			return {
				status: result.status,
				contentType: ''
			}
		}
		return {
			status: result.status,
			contentType: result.contentType
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
				etag: `"${key}-etag"`
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
				httpEtag: item.etag
			} as unknown as R2ObjectBody
		}
	} as R2Bucket

	return {
		APP_BASE_URL: 'http://localhost:5173',
		R2: r2
	} as unknown as Env & { R2: R2Bucket }
}

function createEnvWithoutR2(): Env {
	return {
		APP_BASE_URL: 'http://localhost:5173'
	} as unknown as Env
}
