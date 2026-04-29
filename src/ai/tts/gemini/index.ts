import { GoogleGenAI, type GenerateContentResponse } from '@google/genai'
import { newR2Client } from '../../../r2'
import type {
	AISimpleTTSClient,
	AISimpleTTSClientOptions,
	AITTSSpeechInput,
	AITTSResult
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
	options: AISimpleTTSClientOptions = {}
): AISimpleTTSClient {
	return new geminiSimpleTTSClient(env, options)
}

class geminiSimpleTTSClient implements AISimpleTTSClient {
	private readonly client: GoogleGenAI
	private readonly env: Env
	private readonly model: string

	constructor(env: Env, options: AISimpleTTSClientOptions) {
		this.env = env
		this.client = newGeminiNativeTTSClient(env)
		this.model = options.model ?? env.TTS_GEMINI_MODEL
	}

	async generateSpeech(input: AITTSSpeechInput): Promise<AITTSResult> {
		validateInput(input)

		const result = await this.client.models.generateContent({
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

		return toSpeechResult(this.env, input, result)
	}
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
	input: AITTSSpeechInput,
	result: GenerateContentResponse
): Promise<AITTSResult> {
	const audio = firstAudioPart(result)
	const output: AITTSResult = {
		audioBase64: audio?.data ?? '',
		mimeType: 'audio/wav'
	}

	if (input.uploadToR2) {
		const client = newR2Client(env as R2Env, input.userId)
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
