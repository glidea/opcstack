import type { GoogleGenAI } from '@google/genai'
import type { TenantShardDb } from '../../db'
import { AIError } from '../error'
import type { AIEndpoint } from '../endpoint'
import { createGeminiNativeTTSClient, createGeminiSimpleTTSClient } from './gemini'
import { createSeedSimpleTTSClient } from './seed'

export * from './gemini/constants'
export * from './seed/constants'

export interface AITTSClients {
	simple: AISimpleTTSClient
	gemini?: GoogleGenAI
}

export function createAITTSClients(
	env: Env,
	userId: string,
	tenantDb: TenantShardDb,
	options: AISimpleTTSClientOptions = {}
): AITTSClients {
	const provider = options.provider ?? 'gemini'
	if (provider === 'gemini') {
		return {
			simple: createGeminiSimpleTTSClient(env, userId, tenantDb, options),
			gemini: createGeminiNativeTTSClient(env)
		}
	}
	if (provider === 'seed') {
		return {
			simple: createSeedSimpleTTSClient(env, userId, tenantDb, options)
		}
	}

	throw new AIError('UNSUPPORTED_AI_PROVIDER', `Unsupported AI provider: ${provider}`)
}

export interface AISimpleTTSClient {
	generateSpeech(input: AITTSSpeechInput): Promise<AITTSResult>
	generateSpeechFromSource(input: AITTSSourceInput): Promise<AITTSResult>
	generateSpeechAsync(input: AITTSSpeechInput): Promise<AITTSTask>
	generateSpeechFromSourceAsync(input: AITTSSourceInput): Promise<AITTSTask>
	getTask(id: string): Promise<AITTSTask | undefined>
}

export interface AISimpleTTSClientOptions {
	provider?: AITTSProvider
	model?: string
	endpoint?: AIEndpoint
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

export interface AITTSSourceInput {
	inputText?: string
	inputUrl?: string
	promptText?: string
	speakers?: AITTSSpeaker[]
	durationHintSeconds?: number
	uploadToR2?: boolean
}

export interface AITTSResult {
	audioBase64: string
	mimeType: 'audio/wav' | 'audio/mpeg'
	audioUrl?: string
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
	source?: AITTSSourceInput
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
