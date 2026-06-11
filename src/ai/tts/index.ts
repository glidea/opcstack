import type { GoogleGenAI } from '@google/genai'
import type { TenantShardDb } from '../../db'
import { newGeminiNativeTTSClient, newGeminiSimpleTTSClient } from './gemini'

export const GEMINI_TTS_MODEL_GEMINI_3_1_FLASH_TTS_PREVIEW = 'gemini-3.1-flash-tts-preview'
export const GEMINI_TTS_MODEL_GEMINI_2_5_FLASH_PREVIEW_TTS = 'gemini-2.5-flash-preview-tts'
export const GEMINI_TTS_MODEL_GEMINI_2_5_PRO_PREVIEW_TTS = 'gemini-2.5-pro-preview-tts'

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

	throw new Error(`UNSUPPORTED_AI_PROVIDER: ${provider}`)
}

export interface AISimpleTTSClient {
	generateSpeech(input: AITTSSpeechInput): Promise<AITTSResult>
	generateSpeechAsync(input: AITTSSpeechInput): Promise<AITTSTask>
	getTask(id: string): Promise<AITTSTask | undefined>
}

export interface AISimpleTTSClientOptions {
	provider?: 'gemini'
	model?: string
}

export type GeminiTTSVoiceName = string

export interface AITTSSpeaker {
	name: string
	voiceName: GeminiTTSVoiceName
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
	mimeType: 'audio/wav'
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
	provider: 'gemini'
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
