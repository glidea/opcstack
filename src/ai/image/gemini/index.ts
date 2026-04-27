import {
	GoogleGenAI,
	PersonGeneration,
	type Part,
	type GenerateContentResponse
} from '@google/genai'
import { newR2Client } from '../../../r2'
import type {
	AISimpleImageClientOptions,
	AISimpleImageClientGenerateInput,
	AIImageResult,
	AISimpleImageClient
} from '..'

export function newGeminiNativeImageClient(env: Env): GoogleGenAI {
	return new GoogleGenAI({
		apiKey: env.IMAGE_GEMINI_API_KEY,
		httpOptions: { baseUrl: env.IMAGE_GEMINI_BASE_URL }
	})
}

export function newGeminiSimpleImageClient(
	env: Env,
	options: AISimpleImageClientOptions = {}
): AISimpleImageClient {
	return new geminiSimpleImageClient(env, options)
}

type R2Env = Env & { R2: R2Bucket }

class geminiSimpleImageClient implements AISimpleImageClient {
	private readonly client: GoogleGenAI
	private readonly env: Env
	private readonly model: string

	constructor(env: Env, options: AISimpleImageClientOptions) {
		this.env = env
		this.client = newGeminiNativeImageClient(env)
		this.model = options.model ?? env.IMAGE_GEMINI_MODEL
	}

	async generate(input: AISimpleImageClientGenerateInput): Promise<AIImageResult[]> {
		const result = await this.client.models.generateContent({
			model: this.model,
			contents: [
				{
					role: 'user',
					parts: toRequestParts(input)
				}
			],
			config: {
				responseModalities: ['IMAGE'],
				...(input.numberOfImages ? { candidateCount: input.numberOfImages } : {}),
				imageConfig: {
					aspectRatio: input.aspectRatio ?? '1:1',
					...(input.imageSize ? { imageSize: input.imageSize } : {}),
					...(input.lowCensorship ? { personGeneration: PersonGeneration.ALLOW_ALL } : {})
				}
			}
		})

		return toImageResults(this.env, input, result)
	}
}

async function toImageResults(
	env: Env,
	input: AISimpleImageClientGenerateInput,
	result: GenerateContentResponse
): Promise<AIImageResult[]> {
	const outputs: AIImageResult[] = []
	const candidates = result.candidates ?? []
	for (const candidate of candidates) {
		const parts = candidate.content?.parts ?? []
		for (const part of parts) {
			if (!part.inlineData) {
				continue
			}

			const output: AIImageResult = {
				imageBase64: part.inlineData.data ?? '',
				mimeType: part.inlineData.mimeType ?? ''
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
	}

	return outputs
}

function toRequestParts(input: AISimpleImageClientGenerateInput): Part[] {
	const parts: Part[] = [{ text: input.prompt }]
	const references = input.references ?? []
	for (const reference of references) {
		parts.push({
			inlineData: {
				data: reference.imageBase64,
				mimeType: reference.mimeType
			}
		})
	}
	return parts
}
