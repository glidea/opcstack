import {
	GoogleGenAI,
	PersonGeneration,
	type Part,
	type GenerateContentResponse
} from '@google/genai'
import type { AIEndpoint } from '../../endpoint'
import { AIError } from '../../error'
import type { TenantShardDb } from '../../../db'
import { createR2Client } from '../../../r2'
import { base64ToBytes } from '../../../lib/base64'
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

export function createGeminiNativeImageClient(endpoint: AIEndpoint): GoogleGenAI {
	return new GoogleGenAI({
		apiKey: endpoint.apiKey,
		httpOptions: { baseUrl: endpoint.baseURL }
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
		const client = createGeminiClient(this.endpoint)
		const result = await client.models.generateContent({
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

		return toImageResults(this.env, input, this.userId, result)
	}

	async generateAsync(input: AISimpleImageClientGenerateInput): Promise<AIImageTask> {
		return createAIImageTask(this.env, this.tenantDb, 'image_gemini', this.model, this.userId, input)
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
