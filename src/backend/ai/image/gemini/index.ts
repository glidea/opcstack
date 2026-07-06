import {
	GoogleGenAI,
	PersonGeneration,
	type Part,
	type GenerateContentResponse
} from '@google/genai'
import { resolveAIEndpoints, runWithAIFallback, type AIEndpoint } from '../../fallback'
import { AIError } from '../../error'
import type { TenantShardDb } from '../../../db'
import { createR2Client } from '../../../r2'
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

type R2Env = Env & { R2: R2Bucket }

export function createGeminiNativeImageClient(env: Env): GoogleGenAI {
	return new GoogleGenAI({
		apiKey: env.IMAGE_GEMINI_API_KEY,
		httpOptions: { baseUrl: env.IMAGE_GEMINI_BASE_URL }
	})
}

export function createGeminiSimpleImageClient(
	env: Env,
	userId: string,
	tenantDb: TenantShardDb,
	options: AISimpleImageClientOptions
): AISimpleImageClient {
	return new geminiSimpleImageClient(env, userId, tenantDb, options)
}

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
			const client = createGeminiClient(endpoint)
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

function createGeminiClient(endpoint: AIEndpoint): GoogleGenAI {
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

			outputs.push({
				imageBase64: part.inlineData.data ?? '',
				mimeType: part.inlineData.mimeType ?? ''
			})
		}
	}

	return uploadImageResults(env, input, userId, outputs)
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

function base64ToBytes(base64: string): Uint8Array {
	const raw = atob(base64)
	const bytes = new Uint8Array(raw.length)
	for (let index = 0; index < raw.length; index += 1) {
		bytes[index] = raw.charCodeAt(index)
	}
	return bytes
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
