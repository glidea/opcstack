import OpenAI, { toFile } from 'openai'
import type {
	ImageEditParamsNonStreaming,
	ImageGenerateParamsNonStreaming,
	ImagesResponse
} from 'openai/resources/images'
import { newR2Client } from '../../../r2'
import type {
	AISimpleImageClient,
	AIImageAspectRatio,
	AISimpleImageClientGenerateInput,
	AISimpleImageClientOptions,
	AIImageSize,
	AIImageReference,
	AIImageResult
} from '..'

export function newOpenAINativeImageClient(env: Env): OpenAI {
	return new OpenAI({
		apiKey: env.IMAGE_OPENAI_API_KEY,
		baseURL: env.IMAGE_OPENAI_BASE_URL
	})
}

export function newOpenAISimpleImageClient(
	env: Env,
	options: AISimpleImageClientOptions = {}
): AISimpleImageClient {
	return new openAISimpleImageClient(env, options)
}

type R2Env = Env & { R2: R2Bucket }

class openAISimpleImageClient implements AISimpleImageClient {
	private readonly client: OpenAI
	private readonly env: Env
	private readonly model: string

	constructor(env: Env, options: AISimpleImageClientOptions) {
		this.env = env
		this.client = newOpenAINativeImageClient(env)
		this.model = options.model ?? env.IMAGE_OPENAI_MODEL
	}

	async generate(input: AISimpleImageClientGenerateInput): Promise<AIImageResult[]> {
		if (input.references && input.references.length > 0) {
			const image = await toReferenceFiles(input.references)
			const request: ImageEditParamsNonStreaming & { moderation?: 'low' | 'auto' } = {
				model: this.model,
				image,
				prompt: input.prompt,
				n: input.numberOfImages,
				moderation: toModeration(input.lowCensorship),
				size: toOpenAIImageSize(input) as ImageEditParamsNonStreaming['size']
			}
			const result = await this.client.images.edit(request)

			return toImageResults(this.env, input, result)
		}

		const request: ImageGenerateParamsNonStreaming = {
			model: this.model,
			prompt: input.prompt,
			n: input.numberOfImages,
			moderation: toModeration(input.lowCensorship),
			size: toOpenAIImageSize(input) as ImageGenerateParamsNonStreaming['size']
		}
		const result = await this.client.images.generate(request)

		return toImageResults(this.env, input, result)
	}
}

async function toImageResults(
	env: Env,
	input: AISimpleImageClientGenerateInput,
	result: ImagesResponse
): Promise<AIImageResult[]> {
	const generated = result.data ?? []
	const outputs: AIImageResult[] = []
	for (const item of generated) {
		const output: AIImageResult = {
			imageBase64: item.b64_json ?? '',
			mimeType: toMimeType(result.output_format)
		}

		if (input.uploadToR2) {
			const client = newR2Client(env as R2Env, input.userId)
			output.r2 = await client.putImage({
				dir: 'images',
				imageBase64: output.imageBase64,
				mimeType: output.mimeType
			})
		}

		outputs.push(output)
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

async function toReferenceFiles(references: AIImageReference[]): Promise<File[]> {
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
