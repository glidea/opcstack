const PUBLIC_PREFIX = 'public/'
const PRIVATE_PREFIX = 'private/'
const TMP_PUBLIC_PREFIX = 'tmp/public/'
const TMP_PRIVATE_PREFIX = 'tmp/private/'

export interface R2Client {
	put(input: R2PutInput): Promise<R2PutResult>
	createReadUrl(input: R2CreateReadUrlInput): Promise<R2CreateReadUrlResult>
	get(key: string): Promise<R2GetResult>
	getImageVariant(key: string, preset: R2ImageVariantPreset): Promise<R2GetResult>
}

export interface R2PutInput {
	isTmp?: boolean
	isPublic?: boolean
	dir: string
	filename?: string
	body: string | ArrayBuffer | Uint8Array | ReadableStream
	contentType: string
}

export interface R2PutResult {
	key: string
	url: string
}

export interface R2CreateReadUrlInput {
	key: string
	expiresAt: number
}

export interface R2CreateReadUrlResult {
	key: string
	readUrl: string
	expiresAt: number
}

export interface R2GetResult {
	isPublic: boolean
	body: ReadableStream
	contentType: string
	etag: string
	size: number
}

export type R2ImageVariantPreset = 'small' | 'medium'

type R2Env = Env & { R2?: R2Bucket }

export type R2ErrorCode =
	| 'R2_NOT_CONFIGURED'
	| 'R2_READ_FORBIDDEN'
	| 'R2_READ_NOT_FOUND'
	| 'R2_READ_PATH_INVALID'
	| 'R2_READ_FAILED'
	| 'R2_ORIGIN_SIGNING_SECRET_REQUIRED'
	| 'R2_PRIVATE_UPLOAD_USER_REQUIRED'

export class R2Error extends Error {
	public readonly code: R2ErrorCode

	constructor(code: R2ErrorCode, message?: string) {
		super(message ?? r2ErrorMessage(code))
		this.code = code
	}
}

function r2ErrorMessage(code: R2ErrorCode): string {
	switch (code) {
		case 'R2_NOT_CONFIGURED':
			return 'R2 bucket is not configured'
		case 'R2_READ_FORBIDDEN':
			return 'R2 object access is forbidden'
		case 'R2_READ_NOT_FOUND':
			return 'R2 object was not found'
		case 'R2_READ_PATH_INVALID':
			return 'R2 object path is invalid'
		case 'R2_READ_FAILED':
			return 'R2 object read failed'
		case 'R2_ORIGIN_SIGNING_SECRET_REQUIRED':
			return 'R2 origin signing secret is required'
		case 'R2_PRIVATE_UPLOAD_USER_REQUIRED':
			return 'User is required for private upload'
	}
}

export function createR2Client(env: R2Env, userId?: string): R2Client {
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
			throw new R2Error('R2_NOT_CONFIGURED')
		}

		const filename = input.filename ?? `${Date.now()}-${crypto.randomUUID()}`
		const key = this.buildKey(input.dir, filename, input.isPublic, input.isTmp)

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

	async createReadUrl(input: R2CreateReadUrlInput): Promise<R2CreateReadUrlResult> {
		this.assertReadableKey(input.key)
		return {
			key: input.key,
			readUrl: await createR2OriginReadUrl(this.env, input.key, input.expiresAt),
			expiresAt: input.expiresAt
		}
	}

	async get(key: string): Promise<R2GetResult> {
		if (!this.env.R2) {
			throw new R2Error('R2_NOT_CONFIGURED')
		}

		this.assertReadableKey(key)

		const object = await this.env.R2.get(key)
		if (!object) {
			throw new R2Error('R2_READ_NOT_FOUND')
		}

		return {
			isPublic: key.startsWith(PUBLIC_PREFIX),
			body: object.body as ReadableStream,
			contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
			etag: object.httpEtag,
			size: object.size
		}
	}

	async getImageVariant(key: string, preset: R2ImageVariantPreset): Promise<R2GetResult> {
		if (!this.env.R2) {
			throw new R2Error('R2_NOT_CONFIGURED')
		}

		this.assertReadableKey(key)

		const secret = this.env.R2_ORIGIN_SIGNING_SECRET
		if (!secret) {
			throw new R2Error('R2_ORIGIN_SIGNING_SECRET_REQUIRED')
		}

		const expires = Math.floor(Date.now() / 1000) + 60
		const url = (await this.createReadUrl({ key, expiresAt: expires })).readUrl
		const request = new Request(url)
		const response = await fetch(request, {
			cf: {
				image: toCfImageOptions(preset)
			}
		})

		if (response.status === 403) {
			throw new R2Error('R2_READ_FORBIDDEN')
		}
		if (response.status === 404) {
			throw new R2Error('R2_READ_NOT_FOUND')
		}
		if (!response.ok) {
			throw new R2Error('R2_READ_FAILED')
		}

		return {
			isPublic: key.startsWith(PUBLIC_PREFIX),
			body: response.body as ReadableStream,
			contentType: response.headers.get('content-type') ?? 'image/jpeg',
			etag: response.headers.get('etag') ?? '',
			size: Number(response.headers.get('content-length') ?? '0')
		}
	}

	private assertReadableKey(key: string): void {
		if (key.startsWith(PRIVATE_PREFIX)) {
			const owner = this.privateOwner(key)
			if (!this.userId || owner !== this.userId) {
				throw new R2Error('R2_READ_FORBIDDEN')
			}
			return
		}

		if (key.startsWith(TMP_PRIVATE_PREFIX)) {
			const owner = this.tmpOwner(key, TMP_PRIVATE_PREFIX)
			if (!this.userId || owner !== this.userId) {
				throw new R2Error('R2_READ_FORBIDDEN')
			}
			return
		}

		if (key.startsWith(PUBLIC_PREFIX)) {
			return
		}

		if (key.startsWith(TMP_PUBLIC_PREFIX)) {
			return
		}

		throw new R2Error('R2_READ_PATH_INVALID')
	}

	private buildKey(dir: string, filename: string, isPublic?: boolean, isTmp?: boolean): string {
		const resolvedIsPublic = isPublic ?? !this.userId
		const path = buildObjectPath(dir, filename)
		if (isTmp) {
			if (resolvedIsPublic) {
				return `${TMP_PUBLIC_PREFIX}${path}`
			}
			if (!this.userId) {
				throw new R2Error('R2_PRIVATE_UPLOAD_USER_REQUIRED')
			}
			return `${TMP_PRIVATE_PREFIX}${this.userId}/${path}`
		}
		if (resolvedIsPublic) {
			return `${PUBLIC_PREFIX}${path}`
		}
		if (!this.userId) {
			throw new R2Error('R2_PRIVATE_UPLOAD_USER_REQUIRED')
		}
		return `${PRIVATE_PREFIX}${this.userId}/${path}`
	}

	private privateOwner(key: string): string {
		const remaining = key.slice(PRIVATE_PREFIX.length)
		const index = remaining.indexOf('/')
		if (index === -1) {
			return remaining
		}
		return remaining.slice(0, index)
	}

	private tmpOwner(key: string, prefix: string): string {
		const remaining = key.slice(prefix.length)
		const index = remaining.indexOf('/')
		if (index === -1) {
			return remaining
		}
		return remaining.slice(0, index)
	}

}

async function createR2OriginReadUrl(
	env: Pick<Env, 'APP_BASE_URL' | 'R2_ORIGIN_SIGNING_SECRET'>,
	key: string,
	expires: number
): Promise<string> {
	const originPath: string = `/api/internal/r2_image_origin/${key}`
	const signature: string = await signR2Origin(env.R2_ORIGIN_SIGNING_SECRET, 'GET', originPath, expires)
	const url = new URL(`${trimRightSlash(env.APP_BASE_URL)}${originPath}`)
	url.searchParams.set('expires', String(expires))
	url.searchParams.set('signature', signature)
	return url.toString()
}

export async function signR2Origin(
	secret: string,
	method: string,
	path: string,
	expires: number
): Promise<string> {
	if (!secret) {
		throw new R2Error('R2_ORIGIN_SIGNING_SECRET_REQUIRED')
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

function buildObjectPath(dir: string, filename: string): string {
	if (dir.length === 0) {
		return filename
	}
	return `${dir}/${filename}`
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
