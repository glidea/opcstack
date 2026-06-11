import type { GoogleGenAI } from '@google/genai'
import type { TenantShardDb } from '../../db'
import { newGeminiNativeTTSClient, newGeminiSimpleTTSClient } from './gemini'
import { newSeedSimpleTTSClient } from './seed'

export const GEMINI_TTS_MODEL_GEMINI_3_1_FLASH_TTS_PREVIEW = 'gemini-3.1-flash-tts-preview'
export const GEMINI_TTS_MODEL_GEMINI_2_5_FLASH_PREVIEW_TTS = 'gemini-2.5-flash-preview-tts'
export const GEMINI_TTS_MODEL_GEMINI_2_5_PRO_PREVIEW_TTS = 'gemini-2.5-pro-preview-tts'
export const SEED_TTS_MODEL_SEED_TTS_2_0_STANDARD = 'seed-tts-2.0-standard'

export interface AITTSClients {
	simple: AISimpleTTSClient
	gemini?: GoogleGenAI
}

export function newAITTSClients(
	env: Env,
	userId: string,
	tenantDb: TenantShardDb,
	options: AISimpleTTSClientOptions = {}
): AITTSClients {
	const provider = options.provider ?? 'gemini'
	if (provider === 'gemini') {
		return {
			simple: newGeminiSimpleTTSClient(env, userId, tenantDb, options),
			gemini: newGeminiNativeTTSClient(env)
		}
	}
	if (provider === 'seed') {
		return {
			simple: newSeedSimpleTTSClient(env, userId, tenantDb, options)
		}
	}

	throw new Error(`UNSUPPORTED_AI_PROVIDER: ${provider}`)
}

export interface AISimpleTTSClient {
	generateSpeech(input: AITTSSpeechInput): Promise<AITTSResult>
	generateSpeechAsync(input: AITTSSpeechInput): Promise<AITTSTask>
	getTask(id: string): Promise<AITTSTask | undefined>
}

export interface AISimpleTTSClientOptions {
	provider?: AITTSProvider
	model?: string
}

export type AITTSProvider = 'gemini' | 'seed'

export interface AITTSSpeaker {
	name: string
	voiceName: string
	profile?: string
	speechStyle?: string
}

export interface AITTSLine {
	speakerName: string
	text: string
}

export interface AITTSSpeechInput {
	instruction?: string
	speakers: AITTSSpeaker[]
	lines: AITTSLine[]
	uploadToR2?: boolean
}

export interface AITTSResult {
	audioBase64: string
	mimeType: 'audio/wav' | 'audio/mpeg'
	r2?: {
		key: string
		url: string
	}
}

export type AITTSTaskStatus = 'processing' | 'completed' | 'failed'

export interface AITTSTask {
	id: string
	userId: string
	status: AITTSTaskStatus
	provider: AITTSProvider
	model?: string
	instruction?: string
	speakers: AITTSSpeaker[]
	lines: AITTSLine[]
	uploadToR2: boolean
	result?: {
		audio: AITTSResult
	}
	attemptCount: number
	lastErrorMessage?: string
	createdAt: number
	updatedAt: number
	completedAt?: number
}
