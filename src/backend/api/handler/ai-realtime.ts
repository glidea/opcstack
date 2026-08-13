import type { Context } from 'hono'
import {
	createAIRealtimeClient,
	type AIRealtimeClient,
	type AIRealtimeEvent,
	type AIRealtimeSession,
	type AIRealtimeStartSessionInput
} from '../../ai/realtime'
import type { ApiEnv } from '..'
import {
	getAIProviderCandidates,
	getAIRuntimeConfig,
	type AIRuntimeConfig
} from '../../ai/config'
import { rankAIProviders, type AIRankedProvider } from '../../ai/provider-routing'
import { createTenantShardAccess } from '../../db/shard-router'
import type { TenantShardDb } from '../../db'

export interface AIRealtimeWebSocket {
	accept(): void
	send(message: string | ArrayBuffer | ArrayBufferView): void
	addEventListener(type: string, handler: (event: MessageEvent) => void): void
}

export type AIRealtimeWebSocketClientJsonMessage =
	| AIRealtimeWebSocketStartSessionMessage
	| AIRealtimeWebSocketInputTextMessage
	| AIRealtimeWebSocketInterruptMessage
	| AIRealtimeWebSocketFinishSessionMessage

export interface AIRealtimeWebSocketStartSessionMessage {
	type: 'start_session'
	model: string
	speaker: string
	prompt?: string
}

export interface AIRealtimeWebSocketInputTextMessage {
	type: 'input_text'
	text: string
}

export interface AIRealtimeWebSocketInterruptMessage {
	type: 'interrupt'
}

export interface AIRealtimeWebSocketFinishSessionMessage {
	type: 'finish_session'
}

export async function aiRealtimeConnectHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const config: AIRuntimeConfig = await getAIRuntimeConfig(
		ctx.get('metaDb'),
		ctx.env.CONFIG_ENCRYPTION_KEY
	)
	const pair = new WebSocketPair()
	const clientSocket: WebSocket = pair[0]
	const serverSocket: WebSocket = pair[1]
	const tenant = await createTenantShardAccess(ctx.get('metaDb'), ctx.env).openUserDb(
		ctx.get('userId')
	)
	bindAIRealtimeWebSocket(serverSocket, ctx.get('userId'), config, tenant.db)

	return new Response(null, {
		status: 101,
		webSocket: clientSocket
	})
}

export function bindAIRealtimeWebSocket(
	socket: AIRealtimeWebSocket,
	userId: string,
	config: AIRuntimeConfig,
	tenantDb: TenantShardDb
): void {
	let session: AIRealtimeSession | undefined = undefined
	let pendingMessage: Promise<void> = Promise.resolve()
	socket.accept()
	socket.addEventListener('message', (event: MessageEvent): void => {
		pendingMessage = pendingMessage.then(async (): Promise<void> => {
			await handleAIRealtimeWebSocketMessage(
				socket,
				config,
				tenantDb,
				userId,
				event.data,
				(value: AIRealtimeSession): void => {
					session = value
				},
				(): AIRealtimeSession => {
					return session!
				}
			)
		})
	})
}

async function handleAIRealtimeWebSocketMessage(
	socket: AIRealtimeWebSocket,
	config: AIRuntimeConfig,
	tenantDb: TenantShardDb,
	userId: string,
	data: string | ArrayBuffer | ArrayBufferView,
	setSession: (session: AIRealtimeSession) => void,
	getSession: () => AIRealtimeSession
): Promise<void> {
	if (typeof data !== 'string') {
		await getSession().sendAudio(toBytes(data))
		return
	}

	const message: AIRealtimeWebSocketClientJsonMessage = JSON.parse(data) as AIRealtimeWebSocketClientJsonMessage
	switch (message.type) {
		case 'start_session': {
			const candidates = getAIProviderCandidates(config, 'realtime_doubao', message.model)
			const ranked: AIRankedProvider[] = await rankAIProviders(
				tenantDb,
				candidates,
				config.routing,
				{ model: message.model, excludedProviderIds: [], nowMs: Date.now() }
			)
			const provider = ranked[0]!.provider
			const client: AIRealtimeClient = createAIRealtimeClient(userId, {
				type: 'realtime_doubao',
				model: message.model,
				endpoint: provider.endpoint
			})
			const session: AIRealtimeSession = await client.startSession({
				speaker: message.speaker,
				prompt: message.prompt
			})

			setSession(session)
			void forwardAIRealtimeEvents(socket, session.events)
			return
		}
		case 'input_text':
			await getSession().sendText(message.text)
			return
		case 'interrupt':
			await getSession().interrupt()
			return
		case 'finish_session':
			await getSession().finish()
			return
	}
}

async function forwardAIRealtimeEvents(
	socket: AIRealtimeWebSocket,
	events: ReadableStream<AIRealtimeEvent>
): Promise<void> {
	const reader: ReadableStreamDefaultReader<AIRealtimeEvent> = events.getReader()
	while (true) {
		const result: ReadableStreamReadResult<AIRealtimeEvent> = await reader.read()
			if (result.done) {
				break
			}

			sendAIRealtimeEvent(socket, result.value)
	}
}

function sendAIRealtimeEvent(socket: AIRealtimeWebSocket, event: AIRealtimeEvent): void {
	switch (event.type) {
		case 'session_started':
			socket.send(JSON.stringify({ type: 'session_started' }))
			return
		case 'user_transcript':
			socket.send(JSON.stringify({ type: 'user_transcript', text: event.text }))
			return
		case 'assistant_text':
			socket.send(JSON.stringify({ type: 'assistant_text', text: event.text }))
			return
		case 'assistant_audio':
			socket.send(event.audio)
			return
		case 'assistant_audio_ended':
			socket.send(JSON.stringify({ type: 'assistant_audio_ended' }))
			return
		case 'interrupted':
			socket.send(JSON.stringify({ type: 'interrupted' }))
			return
		case 'finished':
			socket.send(JSON.stringify({ type: 'finished' }))
			return
		case 'error':
			socket.send(JSON.stringify({ type: 'error', code: event.code, message: event.message }))
			return
	}
}

function toBytes(data: ArrayBuffer | ArrayBufferView): Uint8Array {
	if (data instanceof ArrayBuffer) {
		return new Uint8Array(data)
	}
	return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
}
