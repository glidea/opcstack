import OpenAI from 'openai'
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

export function newSeedDreamNativeImageClient(env: Env): OpenAI {
	return new OpenAI({
		apiKey: env.IMAGE_SEEDDREAM_API_KEY,
		baseURL: env.IMAGE_SEEDDREAM_BASE_URL
	})
}

export function newSeedDreamSimpleImageClient(
	env: Env,
	userId: string,
	tenantDb: TenantShardDb,
	options: AISimpleImageClientOptions
): AISimpleImageClient {
	return new seedDreamSimpleImageClient(env, userId, tenantDb, options)
}

type R2Env = Env & { R2: R2Bucket }

type SeedDreamImageStreamEvent = {
	type:
		| 'image_generation.partial_succeeded'
		| 'image_generation.partial_failed'
		| 'image_generation.partial_image'
		| 'image_generation.completed'
	b64_json?: string
	error?: string
}

class seedDreamSimpleImageClient implements AISimpleImageClient {
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
			env.IMAGE_SEEDDREAM_BASE_URL,
			env.IMAGE_SEEDDREAM_API_KEY,
			env.IMAGE_SEEDDREAM_FALLBACK_BASE_URL,
			env.IMAGE_SEEDDREAM_FALLBACK_API_KEY
		)
		this.model = options.model ?? env.IMAGE_SEEDDREAM_MODEL
		this.userId = userId
		this.tenantDb = tenantDb
	}

	async generate(input: AISimpleImageClientGenerateInput): Promise<AIImageResult[]> {
		const references = await resolveImageReferences(this.env, this.userId, input.references)
		const request = {
			model: this.model,
			prompt: input.prompt,
			n: input.numberOfImages,
			size: toSeedDreamImageSize(input),
			response_format: 'b64_json',
			stream: true,
			extra_body: {
				...(references.length > 0 ? { image: toSeedDreamImages(references) } : {}),
				output_format: 'png',
				watermark: false,
				sequential_image_generation: 'disabled'
			}
		}
		const stream = (await runWithAIFallback(this.endpoints, async (endpoint: AIEndpoint) => {
			const client = newOpenAIClient(endpoint)
			return client.images.generate(request as Parameters<OpenAI['images']['generate']>[0])
		})) as unknown as AsyncIterable<SeedDreamImageStreamEvent>
		const outputs = await toImageResultsFromStream(stream)

		return uploadImageResults(this.env, input, this.userId, outputs)
	}

	async generateAsync(input: AISimpleImageClientGenerateInput): Promise<AIImageTask> {
		return createAIImageTask(this.env, this.tenantDb, 'seedream', this.model, this.userId, input)
	}

	async getTask(id: string): Promise<AIImageTask | undefined> {
		return getAIImageTask(this.tenantDb, id)
	}
}

function newOpenAIClient(endpoint: AIEndpoint): OpenAI {
	return new OpenAI({
		apiKey: endpoint.apiKey,
		baseURL: endpoint.baseURL
	})
}

async function toImageResultsFromStream(
	stream: AsyncIterable<SeedDreamImageStreamEvent>
): Promise<AIImageResult[]> {
	const outputs: AIImageResult[] = []
	for await (const event of stream) {
		switch (event.type) {
			case 'image_generation.partial_succeeded':
				outputs.push({
					imageBase64: event.b64_json ?? '',
					mimeType: 'image/png'
				})
				break
			case 'image_generation.partial_failed':
				throw new Error(event.error ?? 'SEEDDREAM_IMAGE_GENERATION_FAILED')
			case 'image_generation.partial_image':
			case 'image_generation.completed':
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

function toSeedDreamImageSize(input: AISimpleImageClientGenerateInput): string {
	const imageSize = input.imageSize ?? '2K'
	const aspectRatio = input.aspectRatio ?? '1:1'
	if (imageSize === '1K') {
		throw new Error('UNSUPPORTED_SEEDDREAM_IMAGE_SIZE: 1K')
	}

	return SEEDDREAM_SIZE_MAP[imageSize][aspectRatio]
}

const SEEDDREAM_SIZE_MAP: Record<Exclude<AIImageSize, '1K'>, Record<AIImageAspectRatio, string>> = {
	'2K': {
		'1:1': '2048x2048',
		'3:4': '1728x2304',
		'4:3': '2304x1728',
		'9:16': '1600x2848',
		'16:9': '2848x1600'
	},
	'4K': {
		'1:1': '4096x4096',
		'3:4': '3520x4704',
		'4:3': '4704x3520',
		'9:16': '3040x5504',
		'16:9': '5504x3040'
	}
}

function toSeedDreamImages(references: AIInlineImageReference[]): string | string[] {
	const images: string[] = []
	for (const reference of references) {
		images.push(`data:${reference.mimeType};base64,${reference.imageBase64}`)
	}

	if (images.length === 1) {
		const image = images[0] as string
		return image
	}

	return images
}
