import { resolveAIEndpoints, runWithAIFallback, type AIEndpoint } from '../../fallback'
import type { TenantShardDb } from '../../../db'
import { newR2Client } from '../../../r2'
import { resolveImageReferences } from '../reference'
import { createAIImageTask, getAIImageTask } from '../task'
import type {
	AIImageAspectRatio,
	AIImageResult,
	AIImageSize,
	AIImageTask,
	AIInlineImageReference,
	AISimpleImageClient,
	AISimpleImageClientGenerateInput,
	AISimpleImageClientOptions
} from '..'

export interface AliyunNativeImageClient {
	baseURL: string
	apiKey: string
}

export function newAliyunNativeImageClient(env: Env): AliyunNativeImageClient {
	return {
		baseURL: env.IMAGE_ALIYUN_BASE_URL,
		apiKey: env.IMAGE_ALIYUN_API_KEY
	}
}

export function newAliyunSimpleImageClient(
	env: Env,
	userId: string,
	tenantDb: TenantShardDb,
	options: AISimpleImageClientOptions
): AISimpleImageClient {
	return new aliyunSimpleImageClient(env, userId, tenantDb, options)
}

type R2Env = Env & { R2: R2Bucket }

interface AliyunImageRequest {
	model: string
	input: AliyunImageInput
	parameters: AliyunImageParameters
}

interface AliyunImageInput {
	prompt?: string
	messages?: AliyunMessage[]
}

interface AliyunMessage {
	role: 'user'
	content: AliyunContent[]
}

type AliyunContent = AliyunTextContent | AliyunImageContent

interface AliyunTextContent {
	text: string
}

interface AliyunImageContent {
	image: string
}

interface AliyunImageParameters {
	size: string
	n?: number
	watermark: false
	prompt_extend: false
}

interface AliyunImageResponse {
	output: {
		results: AliyunImageOutput[]
	}
}

interface AliyunImageOutput {
	url: string
}

class aliyunSimpleImageClient implements AISimpleImageClient {
	private readonly endpoints: AIEndpoint[]
	private readonly env: Env
	private readonly model: string
	private readonly userId: string
	private readonly tenantDb: TenantShardDb

	constructor(
		env: Env,
		userId: string,
		tenantDb: TenantShardDb,
		options: AISimpleImageClientOptions
	) {
		this.env = env
		this.endpoints = resolveAIEndpoints(
			env.IMAGE_ALIYUN_BASE_URL,
			env.IMAGE_ALIYUN_API_KEY,
			env.IMAGE_ALIYUN_FALLBACK_BASE_URL,
			env.IMAGE_ALIYUN_FALLBACK_API_KEY
		)
		this.model = options.model ?? env.IMAGE_ALIYUN_MODEL
		this.userId = userId
		this.tenantDb = tenantDb
	}

	async generate(input: AISimpleImageClientGenerateInput): Promise<AIImageResult[]> {
		validateInput(this.model, input)

		const references: AIInlineImageReference[] = await resolveImageReferences(
			this.env,
			this.userId,
			input.references
		)
		const request: AliyunImageRequest = toAliyunImageRequest(this.model, input, references)
		const response: Response = await runWithAIFallback(this.endpoints, async (endpoint: AIEndpoint) => {
			const response: Response = await fetch(`${endpoint.baseURL}/services/aigc/multimodal-generation/generation`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${endpoint.apiKey}`,
					'Content-Type': 'application/json',
					'X-DashScope-Async': 'disable'
				},
				body: JSON.stringify(request)
			})
			if (!response.ok) {
				throw new Error(`ALIYUN_IMAGE_GENERATION_FAILED: ${response.status}`)
			}
			return response
		})

		const body: AliyunImageResponse = (await response.json()) as AliyunImageResponse
		const outputs: AIImageResult[] = await downloadImageResults(body.output.results)
		return uploadImageResults(this.env, input, this.userId, outputs)
	}

	async generateAsync(input: AISimpleImageClientGenerateInput): Promise<AIImageTask> {
		return createAIImageTask(this.env, this.tenantDb, 'aliyun', this.model, this.userId, input)
	}

	async getTask(id: string): Promise<AIImageTask | undefined> {
		return getAIImageTask(this.tenantDb, id)
	}
}

function validateInput(model: string, input: AISimpleImageClientGenerateInput): void {
	if (input.lowCensorship) {
		throw new Error('ALIYUN_LOW_CENSORSHIP_UNSUPPORTED')
	}
	if (input.imageSize === '4K') {
		throw new Error('UNSUPPORTED_ALIYUN_IMAGE_SIZE: 4K')
	}

	const referenceCount: number = input.references?.length ?? 0
	switch (model) {
		case 'qwen-image-2.0-pro':
			if ((input.numberOfImages ?? 1) > 6) {
				throw new Error('ALIYUN_QWEN_NUMBER_OF_IMAGES_UNSUPPORTED')
			}
			return
		case 'z-image-turbo':
			if (referenceCount > 0) {
				throw new Error('ALIYUN_Z_IMAGE_REFERENCES_UNSUPPORTED')
			}
			if ((input.numberOfImages ?? 1) > 1) {
				throw new Error('ALIYUN_Z_IMAGE_NUMBER_OF_IMAGES_UNSUPPORTED')
			}
			return
		default:
			throw new Error(`UNSUPPORTED_ALIYUN_IMAGE_MODEL: ${model}`)
	}
}

function toAliyunImageRequest(
	model: string,
	input: AISimpleImageClientGenerateInput,
	references: AIInlineImageReference[]
): AliyunImageRequest {
	return {
		model,
		input: toAliyunImageInput(input, references),
		parameters: {
			size: toAliyunImageSize(input),
			...(input.numberOfImages ? { n: input.numberOfImages } : {}),
			watermark: false,
			prompt_extend: false
		}
	}
}

function toAliyunImageInput(
	input: AISimpleImageClientGenerateInput,
	references: AIInlineImageReference[]
): AliyunImageInput {
	if (references.length === 0) {
		return {
			prompt: input.prompt
		}
	}

	const content: AliyunContent[] = []
	for (const reference of references) {
		content.push({
			image: `data:${reference.mimeType};base64,${reference.imageBase64}`
		})
	}
	content.push({
		text: input.prompt
	})

	return {
		messages: [
			{
				role: 'user',
				content
			}
		]
	}
}

function toAliyunImageSize(input: AISimpleImageClientGenerateInput): string {
	const imageSize: AIImageSize = input.imageSize ?? '1K'
	if (imageSize === '4K') {
		throw new Error('UNSUPPORTED_ALIYUN_IMAGE_SIZE: 4K')
	}

	const aspectRatio: AIImageAspectRatio = input.aspectRatio ?? '1:1'
	return ALIYUN_SIZE_MAP[imageSize][aspectRatio]
}

const ALIYUN_SIZE_MAP: Record<Exclude<AIImageSize, '4K'>, Record<AIImageAspectRatio, string>> = {
	'1K': {
		'1:1': '1024*1024',
		'3:4': '960*1280',
		'4:3': '1280*960',
		'9:16': '720*1280',
		'16:9': '1280*720'
	},
	'2K': {
		'1:1': '2048*2048',
		'3:4': '1728*2368',
		'4:3': '2368*1728',
		'9:16': '1536*2688',
		'16:9': '2688*1536'
	}
}

async function downloadImageResults(results: AliyunImageOutput[]): Promise<AIImageResult[]> {
	const outputs: AIImageResult[] = []
	for (const result of results) {
		const response: Response = await fetch(result.url)
		if (!response.ok) {
			throw new Error(`ALIYUN_IMAGE_DOWNLOAD_FAILED: ${response.status}`)
		}

		outputs.push({
			imageBase64: arrayBufferToBase64(await response.arrayBuffer()),
			mimeType: toSupportedMimeType(response.headers.get('content-type'))
		})
	}

	return outputs
}

function toSupportedMimeType(contentType: string | null): string {
	if (!contentType) {
		return 'image/png'
	}
	if (contentType === 'image/png' || contentType === 'image/jpeg' || contentType === 'image/webp') {
		return contentType
	}

	throw new Error(`ALIYUN_UNSUPPORTED_IMAGE_MIME_TYPE: ${contentType}`)
}

async function uploadImageResults(
	env: Env,
	input: AISimpleImageClientGenerateInput,
	userId: string,
	outputs: AIImageResult[]
): Promise<AIImageResult[]> {
	if (!input.uploadToR2) {
		return outputs
	}

	const client = newR2Client(env as R2Env, userId)
	for (const output of outputs) {
		output.r2 = await client.putImage({
			dir: input.r2UploadDir ?? 'images',
			imageBase64: output.imageBase64,
			mimeType: output.mimeType,
			isPublic: input.r2UploadIsPublic
		})
	}

	return outputs
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes: Uint8Array = new Uint8Array(buffer)
	let raw = ''
	for (const byte of bytes) {
		raw += String.fromCharCode(byte)
	}
	return btoa(raw)
}
