import { resolveAIEndpoints, runWithAIFallback, type AIEndpoint } from '../../fallback'
import type { TenantShardDb } from '../../../db'
import { newR2Client } from '../../../r2'
import { createAITTSSourceTask, createAITTSTask, getAITTSTask } from '../task'
import type {
	AISimpleTTSClient,
	AISimpleTTSClientOptions,
	AITTSSourceInput,
	AITTSSpeechInput,
	AITTSResult,
	AITTSTask
} from '..'
import { SEED_TTS_MODEL_DOUBAO_SEED_PODCAST } from './constants'

type R2Env = Env & { R2: R2Bucket }

type SeedChunk = {
	code: number
	message: string
	data: string | null
}

type SeedPodcastRequest = {
	action: number
	input_text?: string
	prompt_text?: string
	nlp_texts?: {
		speaker: string
		text: string
	}[]
	input_info?: {
		input_url?: string
		input_text_max_length?: number
		max_char_length_per_round?: number
		return_audio_url?: boolean
	}
	audio_config: {
		format: 'mp3'
		sample_rate: 24000
	}
	speaker_info: {
		speakers: string[]
	}
}

type SeedPodcastFrame = {
	event: number
	payload: Uint8Array
}

type SeedPodcastEndPayload = {
	meta_info?: {
		audio_url?: string
	}
}

const SEED_PODCAST_RESOURCE_ID = 'volc.service_type.10050'
const SEED_PODCAST_APP_KEY = 'aGjiRDfUWi'
const SEED_PODCAST_START_SESSION_EVENT = 100
const SEED_PODCAST_FINISH_CONNECTION_EVENT = 2
const SEED_PODCAST_ROUND_RESPONSE_EVENT = 361
const SEED_PODCAST_END_EVENT = 363
const SEED_PODCAST_SESSION_FINISHED_EVENT = 152

export function newSeedSimpleTTSClient(
	env: Env,
	userId: string,
	tenantDb: TenantShardDb,
	options: AISimpleTTSClientOptions = {}
): AISimpleTTSClient {
	return new seedSimpleTTSClient(env, userId, tenantDb, options)
}

class seedSimpleTTSClient implements AISimpleTTSClient {
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
			env.TTS_SEED_BASE_URL,
			env.TTS_SEED_API_KEY,
			env.TTS_SEED_FALLBACK_BASE_URL,
			env.TTS_SEED_FALLBACK_API_KEY
		)
		this.model = options.model ?? env.TTS_SEED_MODEL
		this.userId = userId
		this.tenantDb = tenantDb
	}

	async generateSpeech(input: AITTSSpeechInput): Promise<AITTSResult> {
		if (this.model === SEED_TTS_MODEL_DOUBAO_SEED_PODCAST) {
			return generateSeedPodcast(this.endpoints, this.env, this.userId, toSeedPodcastScriptRequest(input), input.uploadToR2)
		}

		validateInput(input)

		const response: Response = await runWithAIFallback(this.endpoints, async (endpoint: AIEndpoint) => {
			const response: Response = await fetch(`${trimRightSlash(endpoint.baseURL)}/tts/unidirectional`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'X-Api-Key': endpoint.apiKey,
					'X-Api-Resource-Id': 'seed-tts-2.0'
				},
				body: JSON.stringify(toSeedRequest(this.userId, this.model, input))
			})
			if (!response.ok) {
				throw new Error('SEED_TTS_FAILED')
			}
			return response
		})

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

	async generateSpeechFromSource(input: AITTSSourceInput): Promise<AITTSResult> {
		if (this.model !== SEED_TTS_MODEL_DOUBAO_SEED_PODCAST) {
			throw new Error('TTS_SOURCE_NOT_SUPPORTED')
		}

		return generateSeedPodcast(this.endpoints, this.env, this.userId, toSeedPodcastSourceRequest(input), input.uploadToR2)
	}

	async generateSpeechAsync(input: AITTSSpeechInput): Promise<AITTSTask> {
		return createAITTSTask(this.env, this.tenantDb, 'seed', this.model, this.userId, input)
	}

	async generateSpeechFromSourceAsync(input: AITTSSourceInput): Promise<AITTSTask> {
		if (this.model !== SEED_TTS_MODEL_DOUBAO_SEED_PODCAST) {
			throw new Error('TTS_SOURCE_NOT_SUPPORTED')
		}

		return createAITTSSourceTask(this.env, this.tenantDb, 'seed', this.model, this.userId, input)
	}

	async getTask(id: string): Promise<AITTSTask | undefined> {
		return getAITTSTask(this.tenantDb, id)
	}
}

async function generateSeedPodcast(
	endpoints: AIEndpoint[],
	env: Env,
	userId: string,
	request: SeedPodcastRequest,
	uploadToR2?: boolean
): Promise<AITTSResult> {
	const requestId: string = crypto.randomUUID()
	const socket: WebSocket = await runWithAIFallback(endpoints, (endpoint: AIEndpoint) => {
		return openSeedPodcastSocket(endpoint, requestId)
	})
	const audioChunks: Uint8Array[] = []
	let audioUrl: string | undefined

	await new Promise<void>((resolve: () => void, reject: (reason?: unknown) => void): void => {
		socket.addEventListener('message', (event: MessageEvent): void => {
			const frame: SeedPodcastFrame = decodeSeedPodcastFrame(event.data as ArrayBuffer)
			if (frame.event === SEED_PODCAST_ROUND_RESPONSE_EVENT) {
				audioChunks.push(frame.payload)
				return
			}
			if (frame.event === SEED_PODCAST_END_EVENT) {
				audioUrl = readAudioUrl(frame.payload)
				return
			}
			if (frame.event === SEED_PODCAST_SESSION_FINISHED_EVENT) {
				socket.send(encodeSeedPodcastConnectionFrame(SEED_PODCAST_FINISH_CONNECTION_EVENT, toUtf8Bytes('{}')))
				resolve()
			}
		})
		socket.addEventListener('error', (event: Event): void => {
			reject(event)
		})
		socket.send(
			encodeSeedPodcastSessionFrame(
				SEED_PODCAST_START_SESSION_EVENT,
				requestId,
				toUtf8Bytes(JSON.stringify(request))
			)
		)
	})

	const audioBytes: Uint8Array = concatBytes(audioChunks)
	const output: AITTSResult = {
		audioBase64: bytesToBase64(audioBytes),
		mimeType: 'audio/mpeg'
	}
	if (audioUrl) {
		output.audioUrl = audioUrl
	}
	if (uploadToR2) {
		const client = newR2Client(env as R2Env, userId)
		output.r2 = await client.put({
			dir: 'audio',
			body: audioBytes,
			contentType: output.mimeType,
			filename: `${Date.now()}-${crypto.randomUUID()}.mp3`
		})
	}

	return output
}

export function toSeedPodcastScriptRequest(input: AITTSSpeechInput): SeedPodcastRequest {
	if (input.speakers.length !== 2) {
		throw new Error('INVALID_SPEAKER_COUNT')
	}

	return {
		action: 3,
		nlp_texts: input.lines.map((line) => {
			return {
				speaker: line.speakerName,
				text: line.text
			}
		}),
		audio_config: {
			format: 'mp3',
			sample_rate: 24000
		},
		speaker_info: {
			speakers: input.speakers.map((speaker) => speaker.voiceName)
		}
	}
}

export function toSeedPodcastSourceRequest(input: AITTSSourceInput): SeedPodcastRequest {
	const request: SeedPodcastRequest = {
		action: input.promptText ? 4 : 0,
		audio_config: {
			format: 'mp3',
			sample_rate: 24000
		},
		speaker_info: {
			speakers:
				input.speakers?.map((speaker) => speaker.voiceName) ??
				[
					'zh_female_mizaitongxue_v2_saturn_bigtts',
					'zh_male_dayixiansheng_v2_saturn_bigtts'
				]
		}
	}

	if (input.inputText) {
		request.input_text = input.inputText
	}
	if (input.promptText) {
		request.prompt_text = input.promptText
	}
	if (input.inputUrl || input.durationHintSeconds) {
		const textLength: number | undefined = input.durationHintSeconds
			? estimateInputTextMaxLength(input.durationHintSeconds)
			: undefined
		request.input_info = {
			input_url: input.inputUrl,
			input_text_max_length: textLength,
			max_char_length_per_round: textLength,
			return_audio_url: true
		}
	}

	return request
}

export function encodeSeedPodcastSessionFrame(
	event: number,
	sessionId: string,
	payload: Uint8Array
): Uint8Array {
	const sessionBytes: Uint8Array = toUtf8Bytes(sessionId)
	const frame: Uint8Array = new Uint8Array(16 + sessionBytes.length + payload.length)
	const view: DataView = new DataView(frame.buffer)
	frame[0] = 0x11
	frame[1] = 0x94
	frame[2] = 0x10
	frame[3] = 0x00
	view.setInt32(4, event)
	view.setUint32(8, sessionBytes.length)
	frame.set(sessionBytes, 12)
	view.setUint32(12 + sessionBytes.length, payload.length)
	frame.set(payload, 16 + sessionBytes.length)
	return frame
}

export function encodeSeedPodcastConnectionFrame(event: number, payload: Uint8Array): Uint8Array {
	const frame: Uint8Array = new Uint8Array(12 + payload.length)
	const view: DataView = new DataView(frame.buffer)
	frame[0] = 0x11
	frame[1] = 0x94
	frame[2] = 0x10
	frame[3] = 0x00
	view.setInt32(4, event)
	view.setUint32(8, payload.length)
	frame.set(payload, 12)
	return frame
}

export function decodeSeedPodcastFrame(raw: ArrayBuffer | Uint8Array): SeedPodcastFrame {
	const frame: Uint8Array = raw instanceof Uint8Array ? raw : new Uint8Array(raw)
	const view: DataView = new DataView(frame.buffer, frame.byteOffset, frame.byteLength)
	const event: number = view.getInt32(4)
	const idLength: number = view.getUint32(8)
	const payloadLengthOffset: number = 12 + idLength
	const payloadLength: number = view.getUint32(payloadLengthOffset)
	const payloadOffset: number = payloadLengthOffset + 4
	return {
		event,
		payload: frame.slice(payloadOffset, payloadOffset + payloadLength)
	}
}

function estimateInputTextMaxLength(durationHintSeconds: number): number {
	return Math.round(durationHintSeconds * 4)
}

async function openSeedPodcastSocket(endpoint: AIEndpoint, requestId: string): Promise<WebSocket> {
	const response: Response = await fetch(`${trimRightSlash(endpoint.baseURL)}/sami/podcasttts`, {
		headers: {
			Upgrade: 'websocket',
			'X-Api-Key': endpoint.apiKey,
			'X-Api-Resource-Id': SEED_PODCAST_RESOURCE_ID,
			'X-Api-App-Key': SEED_PODCAST_APP_KEY,
			'X-Api-Request-Id': requestId
		}
	})
	if (response.status !== 101 || !response.webSocket) {
		throw new Error('SEED_PODCAST_CONNECT_FAILED')
	}

	const socket: WebSocket = response.webSocket
	socket.accept()
	return socket
}

function readAudioUrl(payload: Uint8Array): string | undefined {
	const text: string = new TextDecoder().decode(payload)
	const data: SeedPodcastEndPayload = JSON.parse(text) as SeedPodcastEndPayload
	return data.meta_info?.audio_url
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
	let length: number = 0
	for (const chunk of chunks) {
		length += chunk.length
	}

	const bytes: Uint8Array = new Uint8Array(length)
	let offset: number = 0
	for (const chunk of chunks) {
		bytes.set(chunk, offset)
		offset += chunk.length
	}
	return bytes
}

function toUtf8Bytes(text: string): Uint8Array {
	return new TextEncoder().encode(text)
}

function bytesToBase64(bytes: Uint8Array): string {
	let raw = ''
	for (let i = 0; i < bytes.length; i += 1) {
		raw += String.fromCharCode(bytes[i]!)
	}
	return btoa(raw)
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
