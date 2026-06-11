import type { GoogleGenAI } from '@google/genai'
import type OpenAI from 'openai'
import type { TenantShardDb } from '../../db'
import type { R2ImageVariantPreset } from '../../r2'
import {
	newAliyunNativeImageClient,
	newAliyunSimpleImageClient,
	type AliyunNativeImageClient
} from './aliyun'
import { newGeminiNativeImageClient, newGeminiSimpleImageClient } from './gemini'
import { newOpenAINativeImageClient, newOpenAISimpleImageClient } from './openai'
import { newSeedDreamNativeImageClient, newSeedDreamSimpleImageClient } from './seedream'

export const GEMINI_IMAGE_MODEL_GEMINI_3_1_FLASH_IMAGE_PREVIEW =
	'gemini-3.1-flash-image-preview'
export const GEMINI_IMAGE_MODEL_GEMINI_3_PRO_IMAGE_PREVIEW = 'gemini-3-pro-image-preview'
export const GEMINI_IMAGE_MODEL_GEMINI_2_5_FLASH_IMAGE_PREVIEW =
	'gemini-2.5-flash-image-preview'
export const OPENAI_IMAGE_MODEL_GPT_IMAGE_2 = 'gpt-image-2'
export const SEEDDREAM_MODEL_SEEDDREAM_5_0_260128 = 'doubao-seedream-5-0-260128'
export const SEEDDREAM_MODEL_SEEDDREAM_5_0_LITE_260128 = 'doubao-seedream-5-0-lite-260128'
export const ALIYUN_IMAGE_MODEL_QWEN_IMAGE_2_0_PRO = 'qwen-image-2.0-pro'
export const ALIYUN_IMAGE_MODEL_Z_IMAGE_TURBO = 'z-image-turbo'

export interface AIImageClients {
	simple: AISimpleImageClient
	gemini?: GoogleGenAI
	openai?: OpenAI
	seedream?: OpenAI
	aliyun?: AliyunNativeImageClient
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
	if (provider === 'seedream') {
		return {
			simple: newSeedDreamSimpleImageClient(env, userId, tenantDb, options),
			seedream: newSeedDreamNativeImageClient(env)
		}
	}
	if (provider === 'aliyun') {
		return {
			simple: newAliyunSimpleImageClient(env, userId, tenantDb, options),
			aliyun: newAliyunNativeImageClient(env)
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
	provider?: AIImageProvider
	model?: string
}

export type AIImageProvider = 'gemini' | 'openai' | 'seedream' | 'aliyun'

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
	provider: AIImageProvider
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
