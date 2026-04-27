const PUBLIC_PREFIX = 'public/'
const PRIVATE_PREFIX = 'private/'

export interface R2Client {
	put(input: R2PutInput): Promise<R2PutResult>
	putImage(input: R2PutImageInput): Promise<R2PutResult>
	get(key: string): Promise<R2GetResult>
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

		if (key.startsWith(PRIVATE_PREFIX)) {
			const owner = this.privateOwner(key)
			if (!this.userId || owner !== this.userId) {
				return { status: 'forbidden' }
			}
		} else if (!key.startsWith(PUBLIC_PREFIX)) {
			return { status: 'not_found' }
		}

		const object = await this.env.R2.get(key)
		if (!object) {
			return { status: 'not_found' }
		}

		return {
			status: 'ok',
			isPublic: key.startsWith(PRIVATE_PREFIX),
			body: object.body as ReadableStream,
			contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
			etag: object.httpEtag
		}
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
