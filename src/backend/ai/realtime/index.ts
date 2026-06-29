import { createDoubaoRealtimeClient } from './doubao'

export * from './doubao/constants'

export type AIRealtimeProvider = 'doubao'

export interface AIRealtimeClientOptions {
	provider?: AIRealtimeProvider
	model?: string
}

export interface AIRealtimeClient {
	startSession(input: AIRealtimeStartSessionInput): Promise<AIRealtimeSession>
}

export interface AIRealtimeSession {
	sessionId: string
	events: ReadableStream<AIRealtimeEvent>
	sendAudio(audio: Uint8Array): Promise<void>
	sendText(text: string): Promise<void>
	interrupt(): Promise<void>
	finish(): Promise<void>
}

export interface AIRealtimeStartSessionInput {
	speaker: string
	prompt?: string
}

export interface AIRealtimeProviderStartSessionInput extends AIRealtimeStartSessionInput {
	sessionId: string
	userId: string
	model: string
}

export type AIRealtimeEvent =
	| AIRealtimeSessionStartedEvent
	| AIRealtimeUserTranscriptEvent
	| AIRealtimeAssistantTextEvent
	| AIRealtimeAssistantAudioEvent
	| AIRealtimeAssistantAudioEndedEvent
	| AIRealtimeInterruptedEvent
	| AIRealtimeFinishedEvent
	| AIRealtimeErrorEvent

export interface AIRealtimeSessionStartedEvent {
	type: 'session_started'
	sessionId: string
}

export interface AIRealtimeUserTranscriptEvent {
	type: 'user_transcript'
	sessionId: string
	text: string
}

export interface AIRealtimeAssistantTextEvent {
	type: 'assistant_text'
	sessionId: string
	text: string
}

export interface AIRealtimeAssistantAudioEvent {
	type: 'assistant_audio'
	sessionId: string
	audio: Uint8Array
}

export interface AIRealtimeAssistantAudioEndedEvent {
	type: 'assistant_audio_ended'
	sessionId: string
}

export interface AIRealtimeInterruptedEvent {
	type: 'interrupted'
	sessionId: string
}

export interface AIRealtimeFinishedEvent {
	type: 'finished'
	sessionId: string
}

export interface AIRealtimeErrorEvent {
	type: 'error'
	sessionId: string
	code: string
	message: string
}

export function createAIRealtimeClient(
	env: Env,
	userId: string,
	options: AIRealtimeClientOptions = {}
): AIRealtimeClient {
	const provider: AIRealtimeProvider = options.provider ?? 'doubao'
	const model: string = options.model ?? readDefaultModel(env, provider)
	switch (provider) {
		case 'doubao':
			return createDoubaoRealtimeClient(env, userId, model)
	}
}

function readDefaultModel(env: Env, provider: AIRealtimeProvider): string {
	switch (provider) {
		case 'doubao':
			return env.REALTIME_DOUBAO_MODEL
	}
}
