import OpenAI, { toFile } from 'openai'
import type {
	ImageEditParamsStreaming,
	ImageEditStreamEvent,
	ImageGenerateParamsStreaming,
	ImageGenStreamEvent
} from 'openai/resources/images'
import { resolveAIEndpoints, runWithAIFallback, type AIEndpoint } from '../../fallback'
import type { TenantShardDb } from '../../../db'
import { createR2Client } from '../../../r2'
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

export function createOpenAINativeImageClient(env: Env): OpenAI {
	return new OpenAI({
		apiKey: env.IMAGE_OPENAI_API_KEY,
		baseURL: env.IMAGE_OPENAI_BASE_URL
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

type R2Env = Env & { R2: R2Bucket }

class openAISimpleImageClient implements AISimpleImageClient {
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
			env.IMAGE_OPENAI_BASE_URL,
			env.IMAGE_OPENAI_API_KEY,
			env.IMAGE_OPENAI_FALLBACK_BASE_URL,
			env.IMAGE_OPENAI_FALLBACK_API_KEY
		)
		this.model = options.model ?? env.IMAGE_OPENAI_MODEL
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
			const stream = await runWithAIFallback(this.endpoints, async (endpoint: AIEndpoint) => {
				const client = createOpenAIClient(endpoint)
				return client.images.edit(request)
			})
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
		const stream = await runWithAIFallback(this.endpoints, async (endpoint: AIEndpoint) => {
			const client = createOpenAIClient(endpoint)
			return client.images.generate(request)
		})
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

async function uploadImageResults(
	env: Env,
	input: AISimpleImageClientGenerateInput,
	userId: string,
	outputs: AIImageResult[]
): Promise<AIImageResult[]> {
	if (!input.uploadToR2) {
		return outputs
	}

	const client = createR2Client(env as R2Env, userId)
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

function toModeration(lowCensorship: boolean | undefined): 'low' | 'auto' {
	return lowCensorship ? 'low' : 'auto'
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
