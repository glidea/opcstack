import type { GoogleGenAI } from '@google/genai'
import type OpenAI from 'openai'
import { newGeminiNativeImageClient, newGeminiSimpleImageClient } from './gemini'
import { newOpenAINativeImageClient, newOpenAISimpleImageClient } from './openai'

export interface AIImageClients {
	simple: AISimpleImageClient
	gemini?: GoogleGenAI
	openai?: OpenAI
}

export function newAIImageClients(env: Env, options: AISimpleImageClientOptions = {}): AIImageClients {
	const provider = options.provider ?? 'gemini'
	if (provider === 'gemini') {
		return {
			simple: newGeminiSimpleImageClient(env, options),
			gemini: newGeminiNativeImageClient(env)
		}
	}
	if (provider === 'openai') {
		return {
			simple: newOpenAISimpleImageClient(env, options),
			openai: newOpenAINativeImageClient(env)
		}
	}

	throw new Error(`UNSUPPORTED_AI_PROVIDER: ${provider}`)
}

export interface AISimpleImageClient {
	generate(input: AISimpleImageClientGenerateInput): Promise<AIImageResult[]>
}

export interface AISimpleImageClientOptions {
	provider?: 'gemini' | 'openai'
	model?: string
}

export type AIImageAspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9'
export type AIImageSize = '1K' | '2K' | '4K'

export interface AIImageReference {
	imageBase64: string
	mimeType: string
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
	// User id used for R2 path scoping
	// Public is used when userId is undefined
	userId?: string
}

export interface AIImageResult {
	imageBase64: string
	mimeType: string
	r2?: {
		key: string
		url: string
	}
}
