import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import { newR2Client } from './index'

type StoredObject = {
	body: string
	contentType: string
	etag: string
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
		isPublic?: boolean
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
		},
		{
			scenario: 'uses public prefix for image upload when isPublic is true',
			given: 'a private client with public upload',
			when: 'uploading image with filename',
			then: 'stores key under public prefix',
			givenDetail: {},
			whenDetail: {
				userId: 'u1',
				dir: 'system/images',
				filename: 'a.png',
				imageBase64: 'aA==',
				mimeType: 'image/png',
				isPublic: true
			},
			thenExpected: {
				key: 'public/system/images/a.png',
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
			isPublic: when.isPublic,
			...(when.filename ? { filename: when.filename } : {})
		})
		const prefix =
			when.isPublic === true || !when.userId
				? `public/${when.dir}/`
				: `private/${when.userId}/${when.dir}/`
		return {
			key: when.filename ? result.key : '',
			keyStartsWith: result.key.startsWith(prefix),
			keyEndsWith: result.key.endsWith(when.filename ? when.filename : '.webp')
		}
	})
})

describe('newR2Client.createUploadUrl', () => {
	type GivenDetail = {
		userId?: string
		noAccessKey?: boolean
		allowedContentTypes?: string
		maxBytes?: string
	}
	type WhenDetail = {
		path: string
		contentType: string
		size: number
	}
	type ThenExpected = {
		key: string
		readUrl: string
		uploadHost: string
		uploadPath: string
		algorithm: string
		signedHeaders: string
		hasSignature: boolean
		expiresAtOffset: number
		error: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'creates private presigned upload url',
			given: 'a user r2 client',
			when: 'creating upload url for a relative path',
			then: 'scopes upload to current user private directory',
			givenDetail: {
				userId: 'u1'
			},
			whenDetail: {
				path: 'avatars/me.png',
				contentType: 'image/png',
				size: 1024
			},
			thenExpected: {
				key: 'private/u1/avatars/me.png',
				readUrl: 'http://localhost:5173/api/r2/private/u1/avatars/me.png',
				uploadHost: 'abc.r2.cloudflarestorage.com',
				uploadPath: '/opcstack/private/u1/avatars/me.png',
				algorithm: 'AWS4-HMAC-SHA256',
				signedHeaders: 'content-type;host',
				hasSignature: true,
				expiresAtOffset: 60,
				error: ''
			}
		},
		{
			scenario: 'rejects upload url without user id',
			given: 'a public r2 client',
			when: 'creating upload url',
			then: 'throws user required error',
			givenDetail: {},
			whenDetail: {
				path: 'avatars/me.png',
				contentType: 'image/png',
				size: 1024
			},
			thenExpected: {
				key: '',
				readUrl: '',
				uploadHost: '',
				uploadPath: '',
				algorithm: '',
				signedHeaders: '',
				hasSignature: false,
				expiresAtOffset: 0,
				error: 'R2_UPLOAD_USER_REQUIRED'
			}
		},
		{
			scenario: 'rejects absolute upload path',
			given: 'a user r2 client',
			when: 'creating upload url for absolute path',
			then: 'throws invalid path error',
			givenDetail: {
				userId: 'u1'
			},
			whenDetail: {
				path: '/avatars/me.png',
				contentType: 'image/png',
				size: 1024
			},
			thenExpected: {
				key: '',
				readUrl: '',
				uploadHost: '',
				uploadPath: '',
				algorithm: '',
				signedHeaders: '',
				hasSignature: false,
				expiresAtOffset: 0,
				error: 'R2_UPLOAD_PATH_INVALID'
			}
		},
		{
			scenario: 'rejects parent segment upload path',
			given: 'a user r2 client',
			when: 'creating upload url with parent segment',
			then: 'throws invalid path error',
			givenDetail: {
				userId: 'u1'
			},
			whenDetail: {
				path: 'avatars/../me.png',
				contentType: 'image/png',
				size: 1024
			},
			thenExpected: {
				key: '',
				readUrl: '',
				uploadHost: '',
				uploadPath: '',
				algorithm: '',
				signedHeaders: '',
				hasSignature: false,
				expiresAtOffset: 0,
				error: 'R2_UPLOAD_PATH_INVALID'
			}
		},
		{
			scenario: 'throws when upload signing config is missing',
			given: 'a user r2 client without access key',
			when: 'creating upload url',
			then: 'throws config error',
			givenDetail: {
				userId: 'u1',
				noAccessKey: true
			},
			whenDetail: {
				path: 'avatars/me.png',
				contentType: 'image/png',
				size: 1024
			},
			thenExpected: {
				key: '',
				readUrl: '',
				uploadHost: '',
				uploadPath: '',
				algorithm: '',
				signedHeaders: '',
				hasSignature: false,
				expiresAtOffset: 0,
				error: 'R2_UPLOAD_SIGNING_CONFIG_REQUIRED'
			}
		},
		{
			scenario: 'rejects disallowed upload content type',
			given: 'a user r2 client with png allowlist',
			when: 'creating upload url for text content',
			then: 'throws content type error',
			givenDetail: {
				userId: 'u1',
				allowedContentTypes: 'image/png'
			},
			whenDetail: {
				path: 'avatars/me.txt',
				contentType: 'text/plain',
				size: 1024
			},
			thenExpected: {
				key: '',
				readUrl: '',
				uploadHost: '',
				uploadPath: '',
				algorithm: '',
				signedHeaders: '',
				hasSignature: false,
				expiresAtOffset: 0,
				error: 'R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED'
			}
		},
		{
			scenario: 'rejects upload size over limit',
			given: 'a user r2 client with small max bytes',
			when: 'creating upload url for oversized file',
			then: 'throws size limit error',
			givenDetail: {
				userId: 'u1',
				maxBytes: '100'
			},
			whenDetail: {
				path: 'avatars/me.png',
				contentType: 'image/png',
				size: 101
			},
			thenExpected: {
				key: '',
				readUrl: '',
				uploadHost: '',
				uploadPath: '',
				algorithm: '',
				signedHeaders: '',
				hasSignature: false,
				expiresAtOffset: 0,
				error: 'R2_USER_UPLOAD_SIZE_TOO_LARGE'
			}
		}
	]

	runCases(cases, async (given, when) => {
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

		try {
			const client = newR2Client(env, given.userId)
			const path = splitPath(when.path)
			const result = await client.createUploadUrl({
				dir: path.dir,
				filename: path.filename,
				contentType: when.contentType,
				size: when.size
			})
			const uploadUrl = new URL(result.uploadUrl)
			return {
				key: result.key,
				readUrl: result.readUrl,
				uploadHost: uploadUrl.host,
				uploadPath: uploadUrl.pathname,
				algorithm: uploadUrl.searchParams.get('X-Amz-Algorithm') ?? '',
				signedHeaders: uploadUrl.searchParams.get('X-Amz-SignedHeaders') ?? '',
				hasSignature: Boolean(uploadUrl.searchParams.get('X-Amz-Signature')),
				expiresAtOffset: result.expiresAt - 1767225600,
				error: ''
			}
		} catch (error) {
			return {
				key: '',
				readUrl: '',
				uploadHost: '',
				uploadPath: '',
				algorithm: '',
				signedHeaders: '',
				hasSignature: false,
				expiresAtOffset: 0,
				error: error instanceof Error ? error.message : ''
			}
		}
	})
})

describe('newR2Client.createUploadUrl tmp', () => {
	type GivenDetail = {
		userId?: string
	}
	type WhenDetail = {
		isPublic: boolean
		path: string
		contentType: string
		size: number
	}
	type ThenExpected = {
		key: string
		readUrl: string
		uploadPath: string
		hasSignature: boolean
		error: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'creates public tmp upload url',
			given: 'a user r2 client',
			when: 'creating public tmp upload url',
			then: 'scopes key under tmp public directory',
			givenDetail: {
				userId: 'u1'
			},
			whenDetail: {
				isPublic: true,
				path: 'images/a.png',
				contentType: 'image/png',
				size: 1024
			},
			thenExpected: {
				key: 'tmp/public/images/a.png',
				readUrl: 'http://localhost:5173/api/r2/tmp/public/images/a.png',
				uploadPath: '/opcstack/tmp/public/images/a.png',
				hasSignature: true,
				error: ''
			}
		},
		{
			scenario: 'creates private tmp upload url',
			given: 'a user r2 client',
			when: 'creating private tmp upload url',
			then: 'scopes key under tmp private user directory',
			givenDetail: {
				userId: 'u1'
			},
			whenDetail: {
				isPublic: false,
				path: 'images/a.png',
				contentType: 'image/png',
				size: 1024
			},
			thenExpected: {
				key: 'tmp/private/u1/images/a.png',
				readUrl: 'http://localhost:5173/api/r2/tmp/private/u1/images/a.png',
				uploadPath: '/opcstack/tmp/private/u1/images/a.png',
				hasSignature: true,
				error: ''
			}
		},
		{
			scenario: 'rejects tmp upload url without user id',
			given: 'a public r2 client',
			when: 'creating tmp upload url',
			then: 'throws user required error',
			givenDetail: {},
			whenDetail: {
				isPublic: false,
				path: 'images/a.png',
				contentType: 'image/png',
				size: 1024
			},
			thenExpected: {
				key: '',
				readUrl: '',
				uploadPath: '',
				hasSignature: false,
				error: 'R2_UPLOAD_USER_REQUIRED'
			}
		}
	]

	runCases(cases, async (given, when) => {
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
		try {
			const client = newR2Client(createEnv(), given.userId)
			const path = splitPath(when.path)
			const result = await client.createUploadUrl({
				isPublic: when.isPublic,
				isTmp: true,
				dir: path.dir,
				filename: path.filename,
				contentType: when.contentType,
				size: when.size
			})
			const uploadUrl = new URL(result.uploadUrl)
			return {
				key: result.key,
				readUrl: result.readUrl,
				uploadPath: uploadUrl.pathname,
				hasSignature: Boolean(uploadUrl.searchParams.get('X-Amz-Signature')),
				error: ''
			}
		} catch (error) {
			return {
				key: '',
				readUrl: '',
				uploadPath: '',
				hasSignature: false,
				error: error instanceof Error ? error.message : ''
			}
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
				contentType: 'image/png'
			}
		},
		{
			scenario: 'rejects tmp private key for non-owner',
			given: 'an existing tmp private object',
			when: 'reading with another user',
			then: 'returns forbidden',
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
		const r2Env = env as Env & { R2: R2Bucket }
		if (
			given.writeDir &&
			given.writeFilename &&
			given.writeBody &&
			given.writeContentType
		) {
			const writer = newR2Client(env, given.writeUserId)
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

describe('newR2Client.getImageVariant', () => {
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
			then: 'returns forbidden without fetching origin',
			givenDetail: {
				writeUserId: 'u1'
			},
			whenDetail: {
				readUserId: 'u2',
				key: 'private/u1/images/a.png',
				preset: 'medium'
			},
			thenExpected: {
				status: 'forbidden',
				contentType: '',
				fetchCalls: 0,
				url: '',
				expires: '',
				hasSignature: false,
				width: 0,
				fit: '',
				quality: 0,
				format: '',
				error: ''
			}
		},
		{
			scenario: 'rejects key without allowed prefix',
			given: 'r2 exists',
			when: 'reading variant for invalid key',
			then: 'returns not found without fetching origin',
			givenDetail: {},
			whenDetail: {
				key: 'images/a.png',
				preset: 'medium'
			},
			thenExpected: {
				status: 'not_found',
				contentType: '',
				fetchCalls: 0,
				url: '',
				expires: '',
				hasSignature: false,
				width: 0,
				fit: '',
				quality: 0,
				format: '',
				error: ''
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
			const writer = newR2Client(env, given.writeUserId)
			await writer.put({
				dir: 'images',
				filename: 'a.png',
				contentType: 'image/png',
				body: 'image'
			})
		}

		try {
			const client = newR2Client(env, when.readUserId)
			const result = await client.getImageVariant(when.key, when.preset)
			const call = fetchCalls[0]
			return {
				status: result.status,
				contentType: result.status === 'ok' ? result.contentType : '',
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
				error: error instanceof Error ? error.message : ''
			}
		}
	})
})

describe('newR2Client.getImageVariantBytes', () => {
	type GivenDetail = Record<string, never>
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: string
		contentType: string
		text: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'returns variant bytes',
			given: 'a public image and transformed response',
			when: 'reading variant bytes',
			then: 'returns array buffer and content type',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				status: 'ok',
				contentType: 'image/jpeg',
				text: 'variant'
			}
		}
	]

	runCases(cases, async () => {
		vi.stubGlobal('fetch', async (): Promise<Response> => {
			return new Response('variant', {
				status: 200,
				headers: {
					'content-type': 'image/jpeg'
				}
			})
		})

		const client = newR2Client(createEnv())
		const result = await client.getImageVariantBytes('public/images/a.png', 'medium')
		if (result.status !== 'ok') {
			return {
				status: result.status,
				contentType: '',
				text: ''
			}
		}
		return {
			status: result.status,
			contentType: result.contentType,
			text: await new Response(result.body).text()
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

function createEnvWithoutR2(): Env {
	return {
		APP_NAME: 'opcstack',
		APP_BASE_URL: 'http://localhost:5173',
		R2_ACCOUNT_ID: 'abc',
		R2_ACCESS_KEY_ID: 'access-key',
		R2_SECRET_ACCESS_KEY: 'secret-key',
		R2_USER_UPLOAD_ALLOWED_CONTENT_TYPES: 'image/png;image/jpeg;image/webp',
		R2_USER_UPLOAD_MAX_BYTES: '5242880',
		R2_ORIGIN_SIGNING_SECRET: 'test-secret'
	} as unknown as Env
}

function splitPath(path: string): { dir: string; filename: string } {
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
