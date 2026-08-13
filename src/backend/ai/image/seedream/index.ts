import OpenAI from 'openai'
import type { AIEndpoint } from '../../endpoint'
import { AIError } from '../../error'
import type { TenantShardDb } from '../../../db'
import { createR2Client } from '../../../r2'
import { base64ToBytes } from '../../../lib/base64'
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

type R2Env = Env & { R2: R2Bucket }

export function createSeedDreamNativeImageClient(endpoint: AIEndpoint): OpenAI {
	return new OpenAI({
		apiKey: endpoint.apiKey,
		baseURL: endpoint.baseURL
	})
}

export function createSeedDreamSimpleImageClient(
	env: Env,
	userId: string,
	tenantDb: TenantShardDb,
	options: AISimpleImageClientOptions
): AISimpleImageClient {
	return new seedDreamSimpleImageClient(env, userId, tenantDb, options)
}

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
		const client = createOpenAIClient(this.endpoint)
		const stream = (await client.images.generate(
			request as Parameters<OpenAI['images']['generate']>[0]
		)) as unknown as AsyncIterable<SeedDreamImageStreamEvent>
		const outputs = await toImageResultsFromStream(stream)

		return uploadImageResults(this.env, input, this.userId, outputs)
	}

	async generateAsync(input: AISimpleImageClientGenerateInput): Promise<AIImageTask> {
		return createAIImageTask(this.env, this.tenantDb, 'image_seedream', this.model, this.userId, input)
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
				throw new AIError(
					'SEEDDREAM_IMAGE_GENERATION_FAILED',
					event.error ?? 'SEEDDREAM_IMAGE_GENERATION_FAILED'
				)
			case 'image_generation.partial_image':
			case 'image_generation.completed':
				break
		}
	}

	return outputs
}

function toSeedDreamImageSize(input: AISimpleImageClientGenerateInput): string {
	const imageSize = input.imageSize ?? '2K'
	const aspectRatio = input.aspectRatio ?? '1:1'
	if (imageSize === '1K') {
		throw new AIError('UNSUPPORTED_SEEDDREAM_IMAGE_SIZE', 'SeedDream image size is unsupported: 1K')
	}

	return SEEDDREAM_SIZE_MAP[imageSize][aspectRatio]
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
