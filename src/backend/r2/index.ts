const PUBLIC_PREFIX = 'public/'
const PRIVATE_PREFIX = 'private/'
const TMP_PUBLIC_PREFIX = 'tmp/public/'
const TMP_PRIVATE_PREFIX = 'tmp/private/'

export interface R2Client {
	put(input: R2PutInput): Promise<R2PutResult>
	createUploadUrl(input: R2CreateUploadUrlInput): Promise<R2CreateUploadUrlResult>
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

export interface R2CreateUploadUrlInput {
	isTmp?: boolean
	isPublic?: boolean
	dir: string
	filename: string
	contentType: string
	size: number
}

export interface R2CreateUploadUrlResult {
	key: string
	uploadUrl: string
	readUrl: string
	expiresAt: number
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

type R2AccessResult = { status: 'ok' } | { status: 'forbidden' } | { status: 'not_found' }

type R2Env = Env & { R2?: R2Bucket }

type R2UploadSigningConfig = {
	accountId: string
	accessKeyId: string
	secretAccessKey: string
	bucket: string
}

export type R2ErrorCode =
	| 'R2_NOT_CONFIGURED'
	| 'R2_UPLOAD_PATH_INVALID'
	| 'R2_UPLOAD_USER_REQUIRED'
	| 'R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED'
	| 'R2_USER_UPLOAD_SIZE_TOO_LARGE'
	| 'R2_READ_FORBIDDEN'
	| 'R2_READ_PATH_INVALID'
	| 'R2_ORIGIN_SIGNING_SECRET_REQUIRED'
	| 'R2_PRIVATE_UPLOAD_USER_REQUIRED'
	| 'R2_UPLOAD_SIGNING_CONFIG_REQUIRED'

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
		case 'R2_UPLOAD_PATH_INVALID':
			return 'Upload path is invalid'
		case 'R2_UPLOAD_USER_REQUIRED':
			return 'User is required for private upload'
		case 'R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED':
			return 'Upload content type is not allowed'
		case 'R2_USER_UPLOAD_SIZE_TOO_LARGE':
			return 'Upload size is too large'
		case 'R2_READ_FORBIDDEN':
			return 'R2 object access is forbidden'
		case 'R2_READ_PATH_INVALID':
			return 'R2 object path is invalid'
		case 'R2_ORIGIN_SIGNING_SECRET_REQUIRED':
			return 'R2 origin signing secret is required'
		case 'R2_PRIVATE_UPLOAD_USER_REQUIRED':
			return 'User is required for private upload'
		case 'R2_UPLOAD_SIGNING_CONFIG_REQUIRED':
			return 'R2 upload signing config is required'
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

	async createUploadUrl(input: R2CreateUploadUrlInput): Promise<R2CreateUploadUrlResult> {
		if (!this.env.R2) {
			throw new R2Error('R2_NOT_CONFIGURED')
		}
		const path = buildObjectPath(input.dir, input.filename)
		if (!isUploadPath(path)) {
			throw new R2Error('R2_UPLOAD_PATH_INVALID')
		}
		if (input.isPublic !== true && !this.userId) {
			throw new R2Error('R2_UPLOAD_USER_REQUIRED')
		}
		if (!this.isUserUploadContentTypeAllowed(input.contentType)) {
			throw new R2Error('R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED')
		}
		if (input.size > this.userUploadMaxBytes()) {
			throw new R2Error('R2_USER_UPLOAD_SIZE_TOO_LARGE')
		}

		const config = this.uploadSigningConfig()
		const key = this.buildKey(input.dir, input.filename, input.isPublic, input.isTmp)
		const expiresAt = Math.floor(Date.now() / 1000) + 60
		const uploadUrl = await createR2PresignedPutUrl(config, key, input.contentType, expiresAt)
		return {
			key,
			uploadUrl,
			readUrl: `${trimRightSlash(this.env.APP_BASE_URL)}/api/r2/${key}`,
			expiresAt
		}
	}

	async createReadUrl(input: R2CreateReadUrlInput): Promise<R2CreateReadUrlResult> {
		const access = this.checkAccess(input.key)
		if (access.status === 'forbidden') {
			throw new R2Error('R2_READ_FORBIDDEN')
		}
		if (access.status === 'not_found') {
			throw new R2Error('R2_READ_PATH_INVALID')
		}
		return {
			key: input.key,
			readUrl: await createR2OriginReadUrl(this.env, input.key, input.expiresAt),
			expiresAt: input.expiresAt
		}
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

	private checkAccess(key: string): R2AccessResult {
		if (key.startsWith(PRIVATE_PREFIX)) {
			const owner = this.privateOwner(key)
			if (!this.userId || owner !== this.userId) {
				return { status: 'forbidden' }
			}
			return { status: 'ok' }
		}

		if (key.startsWith(TMP_PRIVATE_PREFIX)) {
			const owner = this.tmpOwner(key, TMP_PRIVATE_PREFIX)
			if (!this.userId || owner !== this.userId) {
				return { status: 'forbidden' }
			}
			return { status: 'ok' }
		}

		if (key.startsWith(PUBLIC_PREFIX)) {
			return { status: 'ok' }
		}

		if (key.startsWith(TMP_PUBLIC_PREFIX)) {
			return { status: 'ok' }
		}

		return { status: 'not_found' }
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

	private uploadSigningConfig(): R2UploadSigningConfig {
		if (
			!this.env.R2_ACCOUNT_ID ||
			!this.env.R2_ACCESS_KEY_ID ||
			!this.env.R2_SECRET_ACCESS_KEY ||
			!this.env.APP_NAME
		) {
			throw new R2Error('R2_UPLOAD_SIGNING_CONFIG_REQUIRED')
		}

		return {
			accountId: this.env.R2_ACCOUNT_ID,
			accessKeyId: this.env.R2_ACCESS_KEY_ID,
			secretAccessKey: this.env.R2_SECRET_ACCESS_KEY,
			bucket: this.env.APP_NAME
		}
	}

	private isUserUploadContentTypeAllowed(contentType: string): boolean {
		const allowedTypes = this.env.R2_USER_UPLOAD_ALLOWED_CONTENT_TYPES.split(';')
		return allowedTypes.includes(contentType)
	}

	private userUploadMaxBytes(): number {
		return Number(this.env.R2_USER_UPLOAD_MAX_BYTES)
	}
}

async function createR2PresignedPutUrl(
	config: R2UploadSigningConfig,
	key: string,
	contentType: string,
	expiresAt: number
): Promise<string> {
	const now = new Date((expiresAt - 60) * 1000)
	const date = awsDate(now)
	const dateScope = date.slice(0, 8)
	const credentialScope = `${dateScope}/auto/s3/aws4_request`
	const host = `${config.accountId}.r2.cloudflarestorage.com`
	const encodedKey = key.split('/').map(encodeURIComponent).join('/')
	const path = `/${config.bucket}/${encodedKey}`
	const params = new URLSearchParams()
	params.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256')
	params.set('X-Amz-Credential', `${config.accessKeyId}/${credentialScope}`)
	params.set('X-Amz-Date', date)
	params.set('X-Amz-Expires', '60')
	params.set('X-Amz-SignedHeaders', 'content-type;host')

	const canonicalRequest = [
		'PUT',
		path,
		params.toString(),
		`content-type:${contentType}\nhost:${host}\n`,
		'content-type;host',
		'UNSIGNED-PAYLOAD'
	].join('\n')
	const stringToSign = [
		'AWS4-HMAC-SHA256',
		date,
		credentialScope,
		await sha256Hex(canonicalRequest)
	].join('\n')
	const signingKey = await awsSigningKey(config.secretAccessKey, dateScope)
	const signature = toHex(await hmacBytes(signingKey, stringToSign))
	params.set('X-Amz-Signature', signature)
	return `https://${host}${path}?${params.toString()}`
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

function isUploadPath(path: string): boolean {
	if (path.length === 0) {
		return false
	}
	if (path.startsWith('/')) {
		return false
	}
	return !path.split('/').includes('..')
}

function buildObjectPath(dir: string, filename: string): string {
	if (dir.length === 0) {
		return filename
	}
	return `${dir}/${filename}`
}

function awsDate(date: Date): string {
	return date.toISOString().replaceAll('-', '').replaceAll(':', '').slice(0, 15) + 'Z'
}

async function sha256Hex(value: string): Promise<string> {
	const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
	return toHex(new Uint8Array(hash))
}

async function hmacBytes(key: Uint8Array, value: string): Promise<Uint8Array> {
	const keyBytes = new Uint8Array(key)
	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		keyBytes.buffer,
		{
			name: 'HMAC',
			hash: 'SHA-256'
		},
		false,
		['sign']
	)
	const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value))
	return new Uint8Array(signature)
}

async function awsSigningKey(secretAccessKey: string, dateScope: string): Promise<Uint8Array> {
	const dateKey = await hmacBytes(new TextEncoder().encode(`AWS4${secretAccessKey}`), dateScope)
	const regionKey = await hmacBytes(dateKey, 'auto')
	const serviceKey = await hmacBytes(regionKey, 's3')
	return hmacBytes(serviceKey, 'aws4_request')
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
