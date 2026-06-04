import type { GoogleGenAI } from '@google/genai'
import type OpenAI from 'openai'
import type { TenantShardDb } from '../../db'
import type { R2ImageVariantPreset } from '../../r2'
import { newGeminiNativeImageClient, newGeminiSimpleImageClient } from './gemini'
import { newOpenAINativeImageClient, newOpenAISimpleImageClient } from './openai'

export interface AIImageClients {
	simple: AISimpleImageClient
	gemini?: GoogleGenAI
	openai?: OpenAI
}

export function newAIImageClients(
	env: Env,
	userId: string,
	tenantDb: TenantShardDb,
	options: AISimpleImageClientOptions
): AIImageClients {
	const provider = options.provider ?? 'gemini'
	if (provider === 'gemini') {
		return {
			simple: newGeminiSimpleImageClient(env, userId, tenantDb, options),
			gemini: newGeminiNativeImageClient(env)
		}
	}
	if (provider === 'openai') {
		return {
			simple: newOpenAISimpleImageClient(env, userId, tenantDb, options),
			openai: newOpenAINativeImageClient(env)
		}
	}

	throw new Error(`UNSUPPORTED_AI_PROVIDER: ${provider}`)
}

export interface AISimpleImageClient {
	generate(input: AISimpleImageClientGenerateInput): Promise<AIImageResult[]>
	generateAsync(input: AISimpleImageClientGenerateInput): Promise<AIImageTask>
	getTask(id: string): Promise<AIImageTask | undefined>
}

export interface AISimpleImageClientOptions {
	provider?: 'gemini' | 'openai'
	model?: string
}

export type AIImageAspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9'
export type AIImageSize = '1K' | '2K' | '4K'

export type AIImageReference = AIInlineImageReference | AIR2ImageReference

export interface AIInlineImageReference {
	imageBase64: string
	mimeType: string
}

export interface AIR2ImageReference {
	r2: {
		key: string
		variant?: R2ImageVariantPreset
	}
}

export interface AISimpleImageClientGenerateInput {
	// Text instruction for image generation or editing
	prompt: string
	// Number of output images
	numberOfImages?: number
	// Edit mode when references is non-empty
	// Generate mode when references is missing or empty
	references?: AIImageReference[]
	// Output aspect ratio like "1:1" or "16:9"
	aspectRatio?: AIImageAspectRatio
	// Output size tier
	imageSize?: AIImageSize
	// Use lower censorship mode when true
	lowCensorship?: boolean
	// Upload generated images to R2 when true
	uploadToR2?: boolean
	// Relative R2 upload dir under public/ or private/{userId}/. Defaults to images
	r2UploadDir?: string
	// Generated image R2 public flag. Defaults to private
	r2UploadIsPublic?: boolean
}

export interface AIImageResult {
	imageBase64: string
	mimeType: string
	r2?: {
		key: string
		url: string
	}
}

export type AIImageTaskStatus = 'processing' | 'completed' | 'failed'

export interface AIImageTask {
	id: string
	userId: string
	status: AIImageTaskStatus
	provider: 'gemini' | 'openai'
	model?: string
	prompt: string
	numberOfImages?: number
	aspectRatio?: AIImageAspectRatio
	imageSize?: AIImageSize
	lowCensorship: boolean
	uploadToR2: boolean
	r2UploadDir?: string
	r2UploadIsPublic: boolean
	references: AIImageReference[]
	result?: {
		images: AIImageResult[]
	}
	attemptCount: number
	lastErrorMessage?: string
	createdAt: number
	updatedAt: number
	completedAt?: number
}
