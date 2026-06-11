import type { TenantShardDb } from '../../../db'
import { newR2Client } from '../../../r2'
import { createAITTSTask, getAITTSTask } from '../task'
import type {
	AISimpleTTSClient,
	AISimpleTTSClientOptions,
	AITTSSpeechInput,
	AITTSResult,
	AITTSTask
} from '..'

type R2Env = Env & { R2: R2Bucket }

type SeedChunk = {
	code: number
	message: string
	data: string | null
}

export function newSeedSimpleTTSClient(
	env: Env,
	userId: string,
	tenantDb: TenantShardDb,
	options: AISimpleTTSClientOptions = {}
): AISimpleTTSClient {
	return new seedSimpleTTSClient(env, userId, tenantDb, options)
}

class seedSimpleTTSClient implements AISimpleTTSClient {
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
		this.model = options.model ?? env.TTS_SEED_MODEL
		this.userId = userId
		this.tenantDb = tenantDb
	}

	async generateSpeech(input: AITTSSpeechInput): Promise<AITTSResult> {
		validateInput(input)

		const response: Response = await fetch(`${trimRightSlash(this.env.TTS_SEED_BASE_URL)}/tts/unidirectional`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'X-Api-Key': this.env.TTS_SEED_API_KEY,
				'X-Api-Resource-Id': 'seed-tts-2.0'
			},
			body: JSON.stringify(toSeedRequest(this.userId, this.model, input))
		})
		if (!response.ok) {
			throw new Error('SEED_TTS_FAILED')
		}

		const output: AITTSResult = {
			audioBase64: await readAudioBase64(response),
			mimeType: 'audio/mpeg'
		}
		if (input.uploadToR2) {
			const client = newR2Client(this.env as R2Env, this.userId)
			output.r2 = await client.put({
				dir: 'audio',
				body: toBytes(output.audioBase64),
				contentType: output.mimeType,
				filename: `${Date.now()}-${crypto.randomUUID()}.mp3`
			})
		}

		return output
	}

	async generateSpeechAsync(input: AITTSSpeechInput): Promise<AITTSTask> {
		return createAITTSTask(this.env, this.tenantDb, 'seed', this.model, this.userId, input)
	}

	async getTask(id: string): Promise<AITTSTask | undefined> {
		return getAITTSTask(this.tenantDb, id)
	}
}

function validateInput(input: AITTSSpeechInput): void {
	if (input.speakers.length !== 1) {
		throw new Error('INVALID_SPEAKER_COUNT')
	}

	const speakerNames = new Set(input.speakers.map((speaker) => speaker.name))
	for (const line of input.lines) {
		if (!speakerNames.has(line.speakerName)) {
			throw new Error(`UNKNOWN_SPEAKER: ${line.speakerName}`)
		}
	}
}

function toSeedRequest(
	userId: string,
	model: string,
	input: AITTSSpeechInput
): {
	user: { uid: string }
	namespace: 'BidirectionalTTS'
	req_params: {
		text: string
		model: string
		speaker: string
		audio_params: {
			format: 'mp3'
			sample_rate: 24000
		}
	}
} {
	return {
		user: {
			uid: userId
		},
		namespace: 'BidirectionalTTS',
		req_params: {
			text: toSeedText(input),
			model,
			speaker: input.speakers[0]!.voiceName,
			audio_params: {
				format: 'mp3',
				sample_rate: 24000
			}
		}
	}
}

function toSeedText(input: AITTSSpeechInput): string {
	return input.lines.map((line) => line.text).join('\n')
}

async function readAudioBase64(response: Response): Promise<string> {
	const reader = response.body?.getReader()
	if (!reader) {
		throw new Error('SEED_TTS_FAILED')
	}

	const decoder = new TextDecoder()
	let buffer = ''
	let audioBase64 = ''
	while (true) {
		const result = await reader.read()
		if (result.done) {
			break
		}

		buffer += decoder.decode(result.value, { stream: true })
		const lines = buffer.split('\n')
		buffer = lines.pop() ?? ''
		for (const line of lines) {
			audioBase64 += parseSeedLine(line)
		}
	}

	buffer += decoder.decode()
	if (buffer.trim()) {
		audioBase64 += parseSeedLine(buffer)
	}

	return audioBase64
}

function parseSeedLine(line: string): string {
	const trimmed = line.trim()
	if (!trimmed) {
		return ''
	}

	const chunk = JSON.parse(trimmed) as SeedChunk
	if (chunk.code !== 0 && chunk.code !== 20000000) {
		throw new Error(chunk.message || 'SEED_TTS_FAILED')
	}
	return chunk.data ?? ''
}

function toBytes(base64: string): Uint8Array {
	const raw = atob(base64)
	const bytes = new Uint8Array(raw.length)
	for (let i = 0; i < raw.length; i += 1) {
		bytes[i] = raw.charCodeAt(i)
	}
	return bytes
}

function trimRightSlash(rawUrl: string): string {
	if (rawUrl.endsWith('/')) {
		return rawUrl.slice(0, -1)
	}
	return rawUrl
}
