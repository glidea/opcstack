import { GoogleGenAI, type GenerateContentResponse } from '@google/genai'
import { resolveAIEndpoints, runWithAIFallback, type AIEndpoint } from '../../fallback'
import type { TenantShardDb } from '../../../db'
import { newR2Client } from '../../../r2'
import { createAITTSTask, getAITTSTask } from '../task'
import type {
	AISimpleTTSClient,
	AISimpleTTSClientOptions,
	AITTSSourceInput,
	AITTSSpeechInput,
	AITTSResult,
	AITTSTask
} from '..'

type R2Env = Env & { R2: R2Bucket }

export function newGeminiNativeTTSClient(env: Env): GoogleGenAI {
	return new GoogleGenAI({
		apiKey: env.TTS_GEMINI_API_KEY,
		httpOptions: { baseUrl: env.TTS_GEMINI_BASE_URL }
	})
}

export function newGeminiSimpleTTSClient(
	env: Env,
	userId: string,
	tenantDb: TenantShardDb,
	options: AISimpleTTSClientOptions = {}
): AISimpleTTSClient {
	return new geminiSimpleTTSClient(env, userId, tenantDb, options)
}

class geminiSimpleTTSClient implements AISimpleTTSClient {
	private readonly endpoints: AIEndpoint[]
	private readonly env: Env
	private readonly model: string
	private readonly userId: string
	private readonly tenantDb: TenantShardDb

	constructor(
		env: Env,
		userId: string,
		tenantDb: TenantShardDb,
		options: AISimpleTTSClientOptions
	) {
		this.env = env
		this.endpoints = resolveAIEndpoints(
			env.TTS_GEMINI_BASE_URL,
			env.TTS_GEMINI_API_KEY,
			env.TTS_GEMINI_FALLBACK_BASE_URL,
			env.TTS_GEMINI_FALLBACK_API_KEY
		)
		this.model = options.model ?? env.TTS_GEMINI_MODEL
		this.userId = userId
		this.tenantDb = tenantDb
	}

	async generateSpeech(input: AITTSSpeechInput): Promise<AITTSResult> {
		validateInput(input)

		const result = await runWithAIFallback(this.endpoints, async (endpoint: AIEndpoint) => {
			const client = newGeminiClient(endpoint)
			return client.models.generateContent({
				model: this.model,
				contents: [
					{
						role: 'user',
						parts: [{ text: toPrompt(input) }]
					}
				],
				config: {
					responseModalities: ['AUDIO'],
					speechConfig: toSpeechConfig(input)
				}
			})
		})

		return toSpeechResult(this.env, this.userId, input, result)
	}

	async generateSpeechFromSource(_input: AITTSSourceInput): Promise<AITTSResult> {
		throw new Error('TTS_SOURCE_NOT_SUPPORTED')
	}

	async generateSpeechAsync(input: AITTSSpeechInput): Promise<AITTSTask> {
		return createAITTSTask(this.env, this.tenantDb, 'gemini', this.model, this.userId, input)
	}

	async generateSpeechFromSourceAsync(_input: AITTSSourceInput): Promise<AITTSTask> {
		throw new Error('TTS_SOURCE_NOT_SUPPORTED')
	}

	async getTask(id: string): Promise<AITTSTask | undefined> {
		return getAITTSTask(this.tenantDb, id)
	}
}

function newGeminiClient(endpoint: AIEndpoint): GoogleGenAI {
	return new GoogleGenAI({
		apiKey: endpoint.apiKey,
		httpOptions: { baseUrl: endpoint.baseURL }
	})
}

function validateInput(input: AITTSSpeechInput): void {
	if (input.speakers.length < 1 || input.speakers.length > 2) {
		throw new Error('INVALID_SPEAKER_COUNT')
	}

	const speakerNames = new Set(input.speakers.map((speaker) => speaker.name))
	for (const line of input.lines) {
		if (!speakerNames.has(line.speakerName)) {
			throw new Error(`UNKNOWN_SPEAKER: ${line.speakerName}`)
		}
	}
}

async function toSpeechResult(
	env: Env,
	userId: string,
	input: AITTSSpeechInput,
	result: GenerateContentResponse
): Promise<AITTSResult> {
	const audio = firstAudioPart(result)
	const output: AITTSResult = {
		audioBase64: audio?.data ?? '',
		mimeType: 'audio/wav'
	}

	if (input.uploadToR2) {
		const client = newR2Client(env as R2Env, userId)
		output.r2 = await client.put({
			dir: 'audio',
			body: toBytes(output.audioBase64),
			contentType: output.mimeType,
			filename: `${Date.now()}-${crypto.randomUUID()}.wav`
		})
	}

	return output
}

function firstAudioPart(
	result: GenerateContentResponse
): { data?: string; mimeType?: string } | undefined {
	const candidates = result.candidates ?? []
	for (const candidate of candidates) {
		const parts = candidate.content?.parts ?? []
		for (const part of parts) {
			if (part.inlineData) {
				return part.inlineData
			}
		}
	}
	return undefined
}

function toSpeechConfig(input: AITTSSpeechInput): Record<string, unknown> {
	if (input.speakers.length === 1) {
		const speaker = input.speakers[0]
		return {
			voiceConfig: {
				prebuiltVoiceConfig: {
					voiceName: speaker!.voiceName
				}
			}
		}
	}

	return {
		multiSpeakerVoiceConfig: {
			speakerVoiceConfigs: input.speakers.map((speaker) => {
				return {
					speaker: speaker.name,
					voiceConfig: {
						prebuiltVoiceConfig: {
							voiceName: speaker.voiceName
						}
					}
				}
			})
		}
	}
}

function toPrompt(input: AITTSSpeechInput): string {
	const sections: string[] = []

	if (input.instruction) {
		sections.push(`Instruction:\n${input.instruction}`)
	}

	const speakerLines = input.speakers.map((speaker) => {
		const descriptions: string[] = []
		if (speaker.profile) {
			descriptions.push(speaker.profile)
		}
		if (speaker.speechStyle) {
			descriptions.push(`Speech style: ${speaker.speechStyle}`)
		}
		if (descriptions.length === 0) {
			return speaker.name
		}
		return `${speaker.name}: ${descriptions.join(' | ')}`
	})

	const transcriptLines = input.lines.map((line) => `${line.speakerName}: ${line.text}`)

	sections.push(`Speakers:\n${speakerLines.join('\n')}`)
	sections.push(`Transcript:\n${transcriptLines.join('\n')}`)
	return sections.join('\n\n')
}

function toBytes(base64: string): Uint8Array {
	const raw = atob(base64)
	const bytes = new Uint8Array(raw.length)
	for (let i = 0; i < raw.length; i += 1) {
		bytes[i] = raw.charCodeAt(i)
	}
	return bytes
}
