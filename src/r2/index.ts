const PUBLIC_PREFIX = 'public/'
const PRIVATE_PREFIX = 'private/'

export interface R2Client {
	put(input: R2PutInput): Promise<R2PutResult>
	putImage(input: R2PutImageInput): Promise<R2PutResult>
	get(key: string): Promise<R2GetResult>
	getImageVariant(key: string, preset: R2ImageVariantPreset): Promise<R2GetResult>
	getImageVariantBytes(
		key: string,
		preset: R2ImageVariantPreset
	): Promise<R2ImageVariantBytesResult>
}

export interface R2PutInput {
	dir: string
	body: string | ArrayBuffer | Uint8Array | ReadableStream
	contentType: string
	filename?: string
}

export interface R2PutResult {
	key: string
	url: string
}

export interface R2PutImageInput {
	dir: string
	imageBase64: string
	mimeType: string
	filename?: string
}

export type R2GetResult =
	| {
		status: 'ok'
		isPublic: boolean
		body: ReadableStream
		contentType: string
		etag: string
	}
	| { status: 'forbidden' }
	| { status: 'not_found' }
	| { status: 'unavailable' }

export type R2ImageVariantPreset = 'small' | 'medium'

export type R2ImageVariantBytesResult =
	| {
		status: 'ok'
		body: ArrayBuffer
		contentType: string
	}
	| { status: 'forbidden' }
	| { status: 'not_found' }
	| { status: 'unavailable' }

type R2AccessResult = { status: 'ok' } | { status: 'forbidden' } | { status: 'not_found' }

type R2Env = Env & { R2?: R2Bucket }

export function newR2Client(env: R2Env, userId?: string): R2Client {
	return new r2Client(env, userId)
}

class r2Client implements R2Client {
	private readonly env: R2Env
	private readonly userId: string | undefined

	constructor(env: R2Env, userId?: string) {
		this.env = env
		this.userId = userId
	}

	async put(input: R2PutInput): Promise<R2PutResult> {
		if (!this.env.R2) {
			throw new Error('R2_NOT_CONFIGURED')
		}

		const filename = input.filename ?? `${Date.now()}-${crypto.randomUUID()}`
		const key = this.buildKey(input.dir, filename)

		await this.env.R2.put(key, input.body, {
			httpMetadata: {
				contentType: input.contentType
			}
		})

		return {
			key,
			url: `${trimRightSlash(this.env.APP_BASE_URL)}/api/r2/${key}`
		}
	}

	async putImage(input: R2PutImageInput): Promise<R2PutResult> {
		if (!this.env.R2) {
			throw new Error('R2_NOT_CONFIGURED')
		}

		const filename =
			input.filename ??
			`${Date.now()}-${crypto.randomUUID()}.${extensionByMimeType(input.mimeType)}`
		return this.put({
			dir: input.dir,
			filename,
			body: toBytes(input.imageBase64),
			contentType: input.mimeType
		})
	}

	async get(key: string): Promise<R2GetResult> {
		if (!this.env.R2) {
			return { status: 'unavailable' }
		}

		const access = this.checkAccess(key)
		if (access.status !== 'ok') {
			return access
		}

		const object = await this.env.R2.get(key)
		if (!object) {
			return { status: 'not_found' }
		}

		return {
			status: 'ok',
			isPublic: key.startsWith(PUBLIC_PREFIX),
			body: object.body as ReadableStream,
			contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
			etag: object.httpEtag
		}
	}

	async getImageVariant(key: string, preset: R2ImageVariantPreset): Promise<R2GetResult> {
		if (!this.env.R2) {
			return { status: 'unavailable' }
		}

		const access = this.checkAccess(key)
		if (access.status !== 'ok') {
			return access
		}

		const secret = this.env.R2_ORIGIN_SIGNING_SECRET
		if (!secret) {
			throw new Error('R2_ORIGIN_SIGNING_SECRET_REQUIRED')
		}

		const originPath = `/api/internal/r2_image_origin/${key}`
		const expires = Math.floor(Date.now() / 1000) + 60
		const signature = await signR2Origin(secret, 'GET', originPath, expires)
		const request = new Request(`${trimRightSlash(this.env.APP_BASE_URL)}${originPath}`, {
			headers: {
				'x-r2-origin-expires': String(expires),
				'x-r2-origin-signature': signature
			}
		})
		const response = await fetch(request, {
			cf: {
				image: toCfImageOptions(preset)
			}
		})

		if (response.status === 403) {
			return { status: 'forbidden' }
		}
		if (response.status === 404) {
			return { status: 'not_found' }
		}
		if (!response.ok) {
			return { status: 'unavailable' }
		}

		return {
			status: 'ok',
			isPublic: key.startsWith(PUBLIC_PREFIX),
			body: response.body as ReadableStream,
			contentType: response.headers.get('content-type') ?? 'image/jpeg',
			etag: response.headers.get('etag') ?? ''
		}
	}

	async getImageVariantBytes(
		key: string,
		preset: R2ImageVariantPreset
	): Promise<R2ImageVariantBytesResult> {
		const result = await this.getImageVariant(key, preset)
		if (result.status !== 'ok') {
			return result
		}
		return {
			status: 'ok',
			body: await new Response(result.body).arrayBuffer(),
			contentType: result.contentType
		}
	}

	private checkAccess(key: string): R2AccessResult {
		if (key.startsWith(PRIVATE_PREFIX)) {
			const owner = this.privateOwner(key)
			if (!this.userId || owner !== this.userId) {
				return { status: 'forbidden' }
			}
			return { status: 'ok' }
		}

		if (key.startsWith(PUBLIC_PREFIX)) {
			return { status: 'ok' }
		}

		return { status: 'not_found' }
	}

	private buildKey(dir: string, filename: string): string {
		if (this.userId) {
			return `${PRIVATE_PREFIX}${this.userId}/${dir}/${filename}`
		}
		return `${PUBLIC_PREFIX}${dir}/${filename}`
	}

	private privateOwner(key: string): string {
		const remaining = key.slice(PRIVATE_PREFIX.length)
		const index = remaining.indexOf('/')
		if (index === -1) {
			return remaining
		}
		return remaining.slice(0, index)
	}
}

export async function signR2Origin(
	secret: string,
	method: string,
	path: string,
	expires: number
): Promise<string> {
	if (!secret) {
		throw new Error('R2_ORIGIN_SIGNING_SECRET_REQUIRED')
	}

	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{
			name: 'HMAC',
			hash: 'SHA-256'
		},
		false,
		['sign']
	)
	const data = `${method}\n${path}\n${expires}`
	const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
	return toHex(new Uint8Array(signature))
}

export async function verifyR2Origin(
	secret: string,
	method: string,
	path: string,
	expires: number,
	signature: string
): Promise<boolean> {
	const expected = await signR2Origin(secret, method, path, expires)
	return expected === signature
}

function trimRightSlash(rawUrl: string): string {
	if (rawUrl.endsWith('/')) {
		return rawUrl.slice(0, -1)
	}
	return rawUrl
}

function extensionByMimeType(mimeType: string): string {
	if (mimeType === 'image/jpeg') {
		return 'jpg'
	}
	if (mimeType === 'image/webp') {
		return 'webp'
	}
	return 'png'
}

function toBytes(base64: string): Uint8Array {
	const raw = atob(base64)
	const bytes = new Uint8Array(raw.length)
	for (let i = 0; i < raw.length; i += 1) {
		bytes[i] = raw.charCodeAt(i)
	}
	return bytes
}

function toCfImageOptions(preset: R2ImageVariantPreset): RequestInitCfPropertiesImage {
	switch (preset) {
		case 'small':
			return {
				width: 320,
				fit: 'scale-down',
				quality: 75,
				format: 'jpeg'
			}
		case 'medium':
			return {
				width: 1024,
				fit: 'scale-down',
				quality: 82,
				format: 'jpeg'
			}
	}
}

function toHex(bytes: Uint8Array): string {
	let output = ''
	for (const byte of bytes) {
		output += byte.toString(16).padStart(2, '0')
	}
	return output
}
