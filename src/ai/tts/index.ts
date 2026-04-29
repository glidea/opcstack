import type { GoogleGenAI } from '@google/genai'
import { newGeminiNativeTTSClient, newGeminiSimpleTTSClient } from './gemini'

export interface AITTSClients {
	simple: AISimpleTTSClient
	gemini?: GoogleGenAI
}

export function newAITTSClients(env: Env, options: AISimpleTTSClientOptions = {}): AITTSClients {
	const provider = options.provider ?? 'gemini'
	if (provider === 'gemini') {
		return {
			simple: newGeminiSimpleTTSClient(env, options),
			gemini: newGeminiNativeTTSClient(env)
		}
	}

	throw new Error(`UNSUPPORTED_AI_PROVIDER: ${provider}`)
}

export interface AISimpleTTSClient {
	generateSpeech(input: AITTSSpeechInput): Promise<AITTSResult>
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
	userId?: string
}

export interface AITTSResult {
	audioBase64: string
	mimeType: 'audio/wav'
	r2?: {
		key: string
		url: string
	}
}
