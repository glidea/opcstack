import {
	GoogleGenAI,
	PersonGeneration,
	type Part,
	type GenerateContentResponse
} from '@google/genai'
import { resolveAIEndpoints, runWithAIFallback, type AIEndpoint } from '../../fallback'
import type { TenantShardDb } from '../../../db'
import { newR2Client } from '../../../r2'
import { resolveImageReferences } from '../reference'
import { createAIImageTask, getAIImageTask } from '../task'
import type {
	AISimpleImageClientOptions,
	AISimpleImageClientGenerateInput,
	AIImageResult,
	AISimpleImageClient,
	AIImageTask,
	AIInlineImageReference
} from '..'

export function newGeminiNativeImageClient(env: Env): GoogleGenAI {
	return new GoogleGenAI({
		apiKey: env.IMAGE_GEMINI_API_KEY,
		httpOptions: { baseUrl: env.IMAGE_GEMINI_BASE_URL }
	})
}

export function newGeminiSimpleImageClient(
	env: Env,
	userId: string,
	tenantDb: TenantShardDb,
	options: AISimpleImageClientOptions
): AISimpleImageClient {
	return new geminiSimpleImageClient(env, userId, tenantDb, options)
}

type R2Env = Env & { R2: R2Bucket }

class geminiSimpleImageClient implements AISimpleImageClient {
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
			env.IMAGE_GEMINI_BASE_URL,
			env.IMAGE_GEMINI_API_KEY,
			env.IMAGE_GEMINI_FALLBACK_BASE_URL,
			env.IMAGE_GEMINI_FALLBACK_API_KEY
		)
		this.model = options.model ?? env.IMAGE_GEMINI_MODEL
		this.userId = userId
		this.tenantDb = tenantDb
	}

	async generate(input: AISimpleImageClientGenerateInput): Promise<AIImageResult[]> {
		const references = await resolveImageReferences(this.env, this.userId, input.references)
		const result = await runWithAIFallback(this.endpoints, async (endpoint: AIEndpoint) => {
			const client = newGeminiClient(endpoint)
			return client.models.generateContent({
				model: this.model,
				contents: [
					{
						role: 'user',
						parts: toRequestParts(input, references)
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
		})

		return toImageResults(this.env, input, this.userId, result)
	}

	async generateAsync(input: AISimpleImageClientGenerateInput): Promise<AIImageTask> {
		return createAIImageTask(this.env, this.tenantDb, 'gemini', this.model, this.userId, input)
	}

	async getTask(id: string): Promise<AIImageTask | undefined> {
		return getAIImageTask(this.tenantDb, id)
	}
}

function newGeminiClient(endpoint: AIEndpoint): GoogleGenAI {
	return new GoogleGenAI({
		apiKey: endpoint.apiKey,
		httpOptions: { baseUrl: endpoint.baseURL }
	})
}

async function toImageResults(
	env: Env,
	input: AISimpleImageClientGenerateInput,
	userId: string,
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
				const client = newR2Client(env as R2Env, userId)
				output.r2 = await client.putImage({
					dir: input.r2UploadDir ?? 'images',
					imageBase64: output.imageBase64,
					mimeType: output.mimeType,
					isPublic: input.r2UploadIsPublic
				})
			}

			outputs.push(output)
		}
	}

	return outputs
}

function toRequestParts(
	input: AISimpleImageClientGenerateInput,
	references: AIInlineImageReference[]
): Part[] {
	const parts: Part[] = [{ text: input.prompt }]
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
