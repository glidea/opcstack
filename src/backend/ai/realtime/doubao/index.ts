import type {
	AIRealtimeClient,
	AIRealtimeEvent,
	AIRealtimeProviderStartSessionInput,
	AIRealtimeStartSessionInput,
	AIRealtimeSession
} from '..'
import { resolveAIEndpoints, runWithAIFallback, type AIEndpoint } from '../../fallback'
import {
	decodeDoubaoRealtimeFrame,
	encodeDoubaoRealtimeConnectionFrame,
	encodeDoubaoRealtimeSessionFrame,
	toUtf8Bytes,
	type DoubaoRealtimeFrame
} from './frame'
import {
	DOUBAO_REALTIME_MODEL_O2,
	DOUBAO_REALTIME_MODEL_SC2,
	type DoubaoRealtimeModel
} from './constants'

export interface DoubaoRealtimeStartSessionPayload {
	model: string
	dialog: {
		context?: string
	}
	asr: {
		extra: Record<string, never>
	}
	tts: {
		speaker: string
		audio_config: {
			format: 'pcm'
			sample_rate: 16000
			channel: 1
		}
	}
}

type DoubaoRealtimeTextPayload = {
	text?: string
	result?: string
	code?: string
	message?: string
}

const DOUBAO_REALTIME_RESOURCE_ID = 'volc.speech.dialog'
const DOUBAO_REALTIME_APP_KEY = 'PlgvMymc7f3tQnJ6'
const DOUBAO_REALTIME_START_CONNECTION_EVENT = 1
const DOUBAO_REALTIME_FINISH_CONNECTION_EVENT = 2
const DOUBAO_REALTIME_START_SESSION_EVENT = 100
const DOUBAO_REALTIME_FINISH_SESSION_EVENT = 102
const DOUBAO_REALTIME_TASK_REQUEST_EVENT = 200
const DOUBAO_REALTIME_CHAT_TEXT_QUERY_EVENT = 501
const DOUBAO_REALTIME_CLIENT_INTERRUPT_EVENT = 515
const DOUBAO_REALTIME_SESSION_STARTED_EVENT = 150
const DOUBAO_REALTIME_SESSION_FINISHED_EVENT = 152
const DOUBAO_REALTIME_TTS_RESPONSE_EVENT = 352
const DOUBAO_REALTIME_TTS_ENDED_EVENT = 359
const DOUBAO_REALTIME_ASR_RESPONSE_EVENT = 451
const DOUBAO_REALTIME_CHAT_RESPONSE_EVENT = 550

export function createDoubaoRealtimeClient(env: Env, userId: string, model: string): AIRealtimeClient {
	return new WebSocketDoubaoRealtimeClient(env, userId, model)
}

export function createDoubaoRealtimeSocketRequest(env: Env, connectId: string): Request {
	return createDoubaoRealtimeSocketRequestFromEndpoint({
		baseURL: env.REALTIME_DOUBAO_BASE_URL,
		apiKey: env.REALTIME_DOUBAO_API_KEY
	}, connectId)
}

function createDoubaoRealtimeSocketRequestFromEndpoint(endpoint: AIEndpoint, connectId: string): Request {
	return new Request(`${trimRightSlash(toHttpUrl(endpoint.baseURL))}/realtime/dialogue`, {
		headers: {
			Upgrade: 'websocket',
			'X-Api-Key': endpoint.apiKey,
			'X-Api-Resource-Id': DOUBAO_REALTIME_RESOURCE_ID,
			'X-Api-App-Key': DOUBAO_REALTIME_APP_KEY,
			'X-Api-Connect-Id': connectId
		}
	})
}

export function toDoubaoRealtimeStartSessionPayload(
	input: AIRealtimeProviderStartSessionInput
): DoubaoRealtimeStartSessionPayload {
	const payload: DoubaoRealtimeStartSessionPayload = {
		model: toVolcRealtimeModel(toDoubaoRealtimeModel(input.model)),
		dialog: {},
		asr: {
			extra: {}
		},
		tts: {
			speaker: input.speaker,
			audio_config: {
				format: 'pcm',
				sample_rate: 16000,
				channel: 1
			}
		}
	}
	if (input.prompt) {
		payload.dialog.context = input.prompt
	}
	return payload
}

export function encodeDoubaoRealtimeAudioRequestFrame(sessionId: string, audio: Uint8Array): Uint8Array {
	return encodeDoubaoRealtimeSessionFrame(DOUBAO_REALTIME_TASK_REQUEST_EVENT, sessionId, audio)
}

export function encodeDoubaoRealtimeTextQueryFrame(sessionId: string, text: string): Uint8Array {
	return encodeDoubaoRealtimeSessionFrame(
		DOUBAO_REALTIME_CHAT_TEXT_QUERY_EVENT,
		sessionId,
		toUtf8Bytes(JSON.stringify({ text }))
	)
}

export function encodeDoubaoRealtimeInterruptFrame(sessionId: string): Uint8Array {
	return encodeDoubaoRealtimeSessionFrame(
		DOUBAO_REALTIME_CLIENT_INTERRUPT_EVENT,
		sessionId,
		toUtf8Bytes('{}')
	)
}

class WebSocketDoubaoRealtimeClient implements AIRealtimeClient {
	private readonly endpoints: AIEndpoint[]
	private readonly userId: string
	private readonly model: string

	constructor(env: Env, userId: string, model: string) {
		this.endpoints = resolveAIEndpoints(
			env.REALTIME_DOUBAO_BASE_URL,
			env.REALTIME_DOUBAO_API_KEY,
			env.REALTIME_DOUBAO_FALLBACK_BASE_URL,
			env.REALTIME_DOUBAO_FALLBACK_API_KEY
		)
		this.userId = userId
		this.model = model
	}

	async startSession(input: AIRealtimeStartSessionInput): Promise<AIRealtimeSession> {
		const sessionInput: AIRealtimeProviderStartSessionInput = {
			sessionId: crypto.randomUUID(),
			userId: this.userId,
			model: this.model,
			speaker: input.speaker,
			prompt: input.prompt
		}
		const socket: WebSocket = await runWithAIFallback(this.endpoints, (endpoint: AIEndpoint) => {
			return openDoubaoRealtimeSocket(endpoint, crypto.randomUUID())
		})

		const events: ReadableStream<AIRealtimeEvent> = createEventStream(socket, sessionInput.sessionId)
		socket.send(encodeDoubaoRealtimeConnectionFrame(DOUBAO_REALTIME_START_CONNECTION_EVENT, toUtf8Bytes('{}')))
		socket.send(
			encodeDoubaoRealtimeSessionFrame(
				DOUBAO_REALTIME_START_SESSION_EVENT,
				sessionInput.sessionId,
				toUtf8Bytes(JSON.stringify(toDoubaoRealtimeStartSessionPayload(sessionInput)))
			)
		)
		return new WebSocketDoubaoRealtimeSession(socket, sessionInput.sessionId, events)
	}
}

class WebSocketDoubaoRealtimeSession implements AIRealtimeSession {
	readonly sessionId: string
	readonly events: ReadableStream<AIRealtimeEvent>
	private readonly socket: WebSocket

	constructor(socket: WebSocket, sessionId: string, events: ReadableStream<AIRealtimeEvent>) {
		this.socket = socket
		this.sessionId = sessionId
		this.events = events
	}

	async sendAudio(audio: Uint8Array): Promise<void> {
		this.socket.send(encodeDoubaoRealtimeAudioRequestFrame(this.sessionId, audio))
	}

	async sendText(text: string): Promise<void> {
		this.socket.send(encodeDoubaoRealtimeTextQueryFrame(this.sessionId, text))
	}

	async interrupt(): Promise<void> {
		this.socket.send(encodeDoubaoRealtimeInterruptFrame(this.sessionId))
	}

	async finish(): Promise<void> {
		this.socket.send(encodeDoubaoRealtimeSessionFrame(
			DOUBAO_REALTIME_FINISH_SESSION_EVENT,
			this.sessionId,
			toUtf8Bytes('{}')
		))
		this.socket.send(encodeDoubaoRealtimeConnectionFrame(
			DOUBAO_REALTIME_FINISH_CONNECTION_EVENT,
			toUtf8Bytes('{}')
		))
	}
}

async function openDoubaoRealtimeSocket(endpoint: AIEndpoint, connectId: string): Promise<WebSocket> {
	const response: Response = await fetch(createDoubaoRealtimeSocketRequestFromEndpoint(endpoint, connectId))
	if (response.status !== 101 || !response.webSocket) {
		throw new Error('DOUBAO_REALTIME_CONNECT_FAILED')
	}
	const socket: WebSocket = response.webSocket
	socket.accept()
	return socket
}

function createEventStream(socket: WebSocket, sessionId: string): ReadableStream<AIRealtimeEvent> {
	return new ReadableStream<AIRealtimeEvent>({
		start(controller: ReadableStreamDefaultController<AIRealtimeEvent>): void {
			socket.addEventListener('message', (event: MessageEvent): void => {
				const frame: DoubaoRealtimeFrame = decodeDoubaoRealtimeFrame(event.data as ArrayBuffer)
				const realtimeEvent: AIRealtimeEvent | undefined = toAIRealtimeEvent(sessionId, frame)
				if (realtimeEvent) {
					controller.enqueue(realtimeEvent)
				}
			})
			socket.addEventListener('close', (): void => {
				controller.close()
			})
			socket.addEventListener('error', (): void => {
				controller.enqueue({
					type: 'error',
					sessionId,
					code: 'DOUBAO_REALTIME_SOCKET_ERROR',
					message: 'Doubao realtime socket error'
				})
			})
		}
	})
}

function toAIRealtimeEvent(sessionId: string, frame: DoubaoRealtimeFrame): AIRealtimeEvent | undefined {
	switch (frame.event) {
		case DOUBAO_REALTIME_SESSION_STARTED_EVENT:
			return { type: 'session_started', sessionId }
		case DOUBAO_REALTIME_ASR_RESPONSE_EVENT:
			return { type: 'user_transcript', sessionId, text: readPayloadText(frame.payload) }
		case DOUBAO_REALTIME_CHAT_RESPONSE_EVENT:
			return { type: 'assistant_text', sessionId, text: readPayloadText(frame.payload) }
		case DOUBAO_REALTIME_TTS_RESPONSE_EVENT:
			return { type: 'assistant_audio', sessionId, audio: frame.payload }
		case DOUBAO_REALTIME_TTS_ENDED_EVENT:
			return { type: 'assistant_audio_ended', sessionId }
		case DOUBAO_REALTIME_SESSION_FINISHED_EVENT:
			return { type: 'finished', sessionId }
		default:
			return undefined
	}
}

function readPayloadText(payload: Uint8Array): string {
	const data: DoubaoRealtimeTextPayload = JSON.parse(new TextDecoder().decode(payload)) as DoubaoRealtimeTextPayload
	return data.text ?? data.result ?? ''
}

function toVolcRealtimeModel(model: DoubaoRealtimeModel): string {
	switch (model) {
		case DOUBAO_REALTIME_MODEL_O2:
			return '1.2.1.1'
		case DOUBAO_REALTIME_MODEL_SC2:
			return '2.2.0.0'
	}
}

function toDoubaoRealtimeModel(model: string): DoubaoRealtimeModel {
	switch (model) {
		case DOUBAO_REALTIME_MODEL_O2:
			return DOUBAO_REALTIME_MODEL_O2
		case DOUBAO_REALTIME_MODEL_SC2:
			return DOUBAO_REALTIME_MODEL_SC2
		default:
			throw new Error('DOUBAO_REALTIME_MODEL_UNSUPPORTED')
	}
}

function toHttpUrl(url: string): string {
	return url.replace('wss://', 'https://').replace('ws://', 'http://')
}

function trimRightSlash(value: string): string {
	return value.replace(/\/+$/, '')
}
