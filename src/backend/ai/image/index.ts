import type { GoogleGenAI } from '@google/genai'
import type OpenAI from 'openai'
import type { TenantShardDb } from '../../db'
import type { R2ImageVariantPreset } from '../../r2'
import {
	createAliyunNativeImageClient,
	createAliyunSimpleImageClient,
	type AliyunNativeImageClient
} from './aliyun'
import { createGeminiNativeImageClient, createGeminiSimpleImageClient } from './gemini'
import { createOpenAINativeImageClient, createOpenAISimpleImageClient } from './openai'
import { createSeedDreamNativeImageClient, createSeedDreamSimpleImageClient } from './seedream'
import { AIError } from '../error'
import type { AIEndpoint } from '../endpoint'
import type { AIImageProviderType } from '../config'

export * from './aliyun/constants'
export * from './gemini/constants'
export * from './openai/constants'
export * from './seedream/constants'

export interface AIImageClients {
	simple: AISimpleImageClient
	gemini?: GoogleGenAI
	openai?: OpenAI
	seedream?: OpenAI
	aliyun?: AliyunNativeImageClient
}

export function createAIImageClients(
	env: Env,
	userId: string,
	tenantDb: TenantShardDb,
	options: AIImageClientFactoryOptions
): AIImageClients {
	switch (options.type) {
		case 'image_gemini':
			return {
				simple: createGeminiSimpleImageClient(env, userId, tenantDb, options),
				gemini: createGeminiNativeImageClient(options.endpoint)
			}
		case 'image_openai':
			return {
				simple: createOpenAISimpleImageClient(env, userId, tenantDb, options),
				openai: createOpenAINativeImageClient(options.endpoint)
			}
		case 'image_seedream':
			return {
				simple: createSeedDreamSimpleImageClient(env, userId, tenantDb, options),
				seedream: createSeedDreamNativeImageClient(options.endpoint)
			}
		case 'image_aliyun':
			return {
				simple: createAliyunSimpleImageClient(env, userId, tenantDb, options),
				aliyun: createAliyunNativeImageClient(options.endpoint)
			}
		default:
			throw new AIError('UNSUPPORTED_AI_PROVIDER', `Unsupported AI provider type: ${options.type}`)
	}
}

export interface AISimpleImageClient {
	generate(input: AISimpleImageClientGenerateInput): Promise<AIImageResult[]>
	generateAsync(input: AISimpleImageClientGenerateInput): Promise<AIImageTask>
	getTask(id: string): Promise<AIImageTask | undefined>
}

export interface AIImageClientFactoryOptions extends AISimpleImageClientOptions {
	type: AIImageProviderType
}

export interface AISimpleImageClientOptions {
	model: string
	endpoint: AIEndpoint
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
	// Relative R2 upload dir under public/ or private/{userId}/. Required when uploadToR2 is true
	r2UploadDir?: string
	// Generated image R2 public flag. Required when uploadToR2 is true
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
	providerType: AIImageProviderType
	providerId?: string
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
