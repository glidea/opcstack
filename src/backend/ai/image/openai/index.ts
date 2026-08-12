import OpenAI, { toFile } from 'openai'
import type {
	ImageEditParamsStreaming,
	ImageEditStreamEvent,
	ImageGenerateParamsStreaming,
	ImageGenStreamEvent
} from 'openai/resources/images'
import type { AIEndpoint } from '../../endpoint'
import { AIError } from '../../error'
import type { TenantShardDb } from '../../../db'
import { createR2Client } from '../../../r2'
import { base64ToBytes } from '../../../lib/base64'
import { resolveImageReferences } from '../reference'
import { createAIImageTask, getAIImageTask } from '../task'
import type {
	AISimpleImageClient,
	AIImageAspectRatio,
	AISimpleImageClientGenerateInput,
	AISimpleImageClientOptions,
	AIImageSize,
	AIImageResult,
	AIImageTask,
	AIInlineImageReference
} from '..'

type R2Env = Env & { R2: R2Bucket }

export function createOpenAINativeImageClient(endpoint: AIEndpoint): OpenAI {
	return new OpenAI({
		apiKey: endpoint.apiKey,
		baseURL: endpoint.baseURL
	})
}

export function createOpenAISimpleImageClient(
	env: Env,
	userId: string,
	tenantDb: TenantShardDb,
	options: AISimpleImageClientOptions
): AISimpleImageClient {
	return new openAISimpleImageClient(env, userId, tenantDb, options)
}

class openAISimpleImageClient implements AISimpleImageClient {
	private readonly endpoint: AIEndpoint
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
		this.endpoint = options.endpoint
		this.model = options.model
		this.userId = userId
		this.tenantDb = tenantDb
	}

	async generate(input: AISimpleImageClientGenerateInput): Promise<AIImageResult[]> {
		const references = await resolveImageReferences(this.env, this.userId, input.references)
		if (references.length > 0) {
			const image = await toReferenceFiles(references)
			const request: ImageEditParamsStreaming & { moderation?: 'low' | 'auto' } = {
				model: this.model,
				image,
				prompt: input.prompt,
				n: input.numberOfImages,
				moderation: toModeration(input.lowCensorship),
				size: toOpenAIImageSize(input) as ImageEditParamsStreaming['size'],
				stream: true,
				partial_images: 1
			}
			const client = createOpenAIClient(this.endpoint)
			const stream = await client.images.edit(request)
			const outputs = await toImageResultsFromStream(stream)

			return uploadImageResults(this.env, input, this.userId, outputs)
		}

		const request: ImageGenerateParamsStreaming = {
			model: this.model,
			prompt: input.prompt,
			n: input.numberOfImages,
			moderation: toModeration(input.lowCensorship),
			size: toOpenAIImageSize(input) as ImageGenerateParamsStreaming['size'],
			stream: true,
			partial_images: 1
		}
		const client = createOpenAIClient(this.endpoint)
		const stream = await client.images.generate(request)
		const outputs = await toImageResultsFromStream(stream)

		return uploadImageResults(this.env, input, this.userId, outputs)
	}

	async generateAsync(input: AISimpleImageClientGenerateInput): Promise<AIImageTask> {
		return createAIImageTask(this.env, this.tenantDb, 'openai', this.model, this.userId, input)
	}

	async getTask(id: string): Promise<AIImageTask | undefined> {
		return getAIImageTask(this.tenantDb, id)
	}
}

function createOpenAIClient(endpoint: AIEndpoint): OpenAI {
	return new OpenAI({
		apiKey: endpoint.apiKey,
		baseURL: endpoint.baseURL
	})
}

async function toImageResultsFromStream(
	stream: AsyncIterable<ImageGenStreamEvent | ImageEditStreamEvent>
): Promise<AIImageResult[]> {
	const outputs: AIImageResult[] = []
	for await (const event of stream) {
		switch (event.type) {
			case 'image_generation.completed':
			case 'image_edit.completed':
				outputs.push({
					imageBase64: event.b64_json,
					mimeType: toMimeType(event.output_format)
				})
				break
			case 'image_generation.partial_image':
			case 'image_edit.partial_image':
				break
		}
	}

	return outputs
}

function toModeration(lowCensorship: boolean | undefined): 'low' | 'auto' {
	return lowCensorship ? 'low' : 'auto'
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
	if (!input.r2UploadDir) {
		throw new AIError('AI_IMAGE_R2_UPLOAD_DIR_REQUIRED')
	}
	if (input.r2UploadIsPublic === undefined) {
		throw new AIError('AI_IMAGE_R2_UPLOAD_IS_PUBLIC_REQUIRED')
	}

	const client = createR2Client(env as R2Env, userId)
	for (const output of outputs) {
		output.r2 = await client.put({
			dir: input.r2UploadDir,
			body: base64ToBytes(output.imageBase64),
			contentType: output.mimeType,
			isPublic: input.r2UploadIsPublic
		})
	}

	return outputs
}

function toOpenAIImageSize(input: AISimpleImageClientGenerateInput): string {
	const imageSize = input.imageSize ?? '1K'
	const aspectRatio = input.aspectRatio ?? '1:1'
	return OPENAI_SIZE_MAP[imageSize][aspectRatio]
}

const OPENAI_SIZE_MAP: Record<AIImageSize, Record<AIImageAspectRatio, string>> = {
	'1K': {
		'1:1': '1024x1024',
		'3:4': '768x1024',
		'4:3': '1024x768',
		'9:16': '608x1088',
		'16:9': '1088x608'
	},
	'2K': {
		'1:1': '2048x2048',
		'3:4': '1536x2048',
		'4:3': '2048x1536',
		'9:16': '1152x2048',
		'16:9': '2048x1152'
	},
	'4K': {
		'1:1': '2880x2880',
		'3:4': '2480x3312',
		'4:3': '3312x2480',
		'9:16': '2160x3840',
		'16:9': '3840x2160'
	}
}

function toMimeType(format: string | undefined): string {
	if (format === 'jpeg') {
		return 'image/jpeg'
	}
	if (format === 'webp') {
		return 'image/webp'
	}
	return 'image/png'
}

async function toReferenceFiles(references: AIInlineImageReference[]): Promise<File[]> {
	const files: File[] = []
	for (const [index, reference] of references.entries()) {
		const name = `image-${index + 1}.${toImageExt(reference.mimeType)}`
		const file = await toFile(Buffer.from(reference.imageBase64, 'base64'), name, {
			type: reference.mimeType
		})
		files.push(file)
	}

	return files
}

function toImageExt(mimeType: string): string {
	if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
		return 'jpg'
	}
	if (mimeType === 'image/webp') {
		return 'webp'
	}
	return 'png'
}
