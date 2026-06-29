import { describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import {
	type AIRealtimeClient,
	type AIRealtimeClientOptions,
	type AIRealtimeEvent,
	type AIRealtimeSession,
	type AIRealtimeStartSessionInput
} from '../../ai/realtime'
import { bindAIRealtimeWebSocket } from './ai-realtime'

type ClientCall = {
	type: string
	userId: string
	model: string
	speaker: string
	prompt: string
	text: string
	audioBytes: number[]
}

const {
	calls,
	eventStream
} = vi.hoisted(() => {
	return {
		calls: [] as ClientCall[],
		eventStream: new ReadableStream<AIRealtimeEvent>({
			start(controller: ReadableStreamDefaultController<AIRealtimeEvent>): void {
				controller.enqueue({ type: 'session_started', sessionId: 'session-1' })
				controller.enqueue({ type: 'assistant_text', sessionId: 'session-1', text: 'answer' })
				controller.enqueue({ type: 'assistant_audio', sessionId: 'session-1', audio: new Uint8Array([9, 8, 7]) })
				controller.enqueue({ type: 'assistant_audio_ended', sessionId: 'session-1' })
				controller.enqueue({ type: 'finished', sessionId: 'session-1' })
				controller.close()
			}
		})
	}
})

vi.mock('../../ai/realtime', async () => {
	const actual = await vi.importActual<typeof import('../../ai/realtime')>('../../ai/realtime')
	class FakeRealtimeClient implements AIRealtimeClient {
		private readonly userId: string
		private readonly model: string

		constructor(userId: string, model: string) {
			this.userId = userId
			this.model = model
		}

		async startSession(input: AIRealtimeStartSessionInput): Promise<AIRealtimeSession> {
			calls.push({
				type: 'startSession',
				userId: this.userId,
				model: this.model,
				speaker: input.speaker,
				prompt: input.prompt ?? '',
				text: '',
				audioBytes: []
			})
			return {
				sessionId: 'session-1',
				events: eventStream,
				sendAudio: async (audio: Uint8Array): Promise<void> => {
					calls.push({
						type: 'sendAudio',
						userId: this.userId,
						model: this.model,
						speaker: '',
						prompt: '',
						text: '',
						audioBytes: Array.from(audio)
					})
				},
				sendText: async (text: string): Promise<void> => {
					calls.push({
						type: 'sendText',
						userId: this.userId,
						model: this.model,
						speaker: '',
						prompt: '',
						text,
						audioBytes: []
					})
				},
				interrupt: async (): Promise<void> => {
					calls.push({
						type: 'interrupt',
						userId: this.userId,
						model: this.model,
						speaker: '',
						prompt: '',
						text: '',
						audioBytes: []
					})
				},
				finish: async (): Promise<void> => {
					calls.push({
						type: 'finish',
						userId: this.userId,
						model: this.model,
						speaker: '',
						prompt: '',
						text: '',
						audioBytes: []
					})
				}
			}
		}
	}
	return {
		...actual,
		createAIRealtimeClient: (_env: Env, userId: string, options: AIRealtimeClientOptions): AIRealtimeClient => {
			return new FakeRealtimeClient(userId, options.model ?? 'doubao-realtime-o2')
		}
	}
})

describe('bindAIRealtimeWebSocket', () => {
	type GivenDetail = Record<string, never>
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		accepted: boolean
		calls: ClientCall[]
		textMessages: string[]
		binaryMessages: number[][]
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'bridge websocket messages to realtime client',
			given: 'start session then audio text interrupt and finish',
			when: 'client and provider exchange messages',
			then: 'json and binary frames are mapped both ways',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				accepted: true,
				calls: [
					{
						type: 'startSession',
						userId: 'u1',
						model: 'doubao-realtime-o2',
						speaker: 'zh_female_vv_jupiter_bigtts',
						prompt: 'article',
						text: '',
						audioBytes: []
					},
					{
						type: 'sendAudio',
						userId: 'u1',
						model: 'doubao-realtime-o2',
						speaker: '',
						prompt: '',
						text: '',
						audioBytes: [1, 2, 3]
					},
					{
						type: 'sendText',
						userId: 'u1',
						model: 'doubao-realtime-o2',
						speaker: '',
						prompt: '',
						text: 'hello',
						audioBytes: []
					},
					{
						type: 'interrupt',
						userId: 'u1',
						model: 'doubao-realtime-o2',
						speaker: '',
						prompt: '',
						text: '',
						audioBytes: []
					},
					{
						type: 'finish',
						userId: 'u1',
						model: 'doubao-realtime-o2',
						speaker: '',
						prompt: '',
						text: '',
						audioBytes: []
					}
				],
				textMessages: [
					'{"type":"session_started"}',
					'{"type":"assistant_text","text":"answer"}',
					'{"type":"assistant_audio_ended"}',
					'{"type":"finished"}'
				],
				binaryMessages: [[9, 8, 7]]
			}
		}
	]

	runCases(cases, async (): Promise<ThenExpected> => {
		calls.length = 0
		const socket = new FakeWebSocket()
		const env: Env = {
			REALTIME_DOUBAO_MODEL: 'doubao-realtime-o2'
		} as unknown as Env
		bindAIRealtimeWebSocket(socket, 'u1', env)

		socket.dispatchMessage(JSON.stringify({
			type: 'start_session',
			provider: 'doubao',
			speaker: 'zh_female_vv_jupiter_bigtts',
			prompt: 'article'
		}))
		await nextTick()
		socket.dispatchMessage(new Uint8Array([1, 2, 3]))
		socket.dispatchMessage(JSON.stringify({ type: 'input_text', text: 'hello' }))
		socket.dispatchMessage(JSON.stringify({ type: 'interrupt' }))
		socket.dispatchMessage(JSON.stringify({ type: 'finish_session' }))
		await nextTick()

		return {
			accepted: socket.accepted,
			calls: JSON.parse(JSON.stringify(calls)) as ClientCall[],
			textMessages: JSON.parse(JSON.stringify(socket.sentText)) as string[],
			binaryMessages: JSON.parse(JSON.stringify(socket.sentBinary)) as number[][]
		}
	})
})

class FakeWebSocket {
	accepted: boolean = false
	readonly sentText: string[] = []
	readonly sentBinary: number[][] = []
	private messageHandler?: (event: MessageEvent) => void

	accept(): void {
		this.accepted = true
	}

	send(message: string | ArrayBuffer | ArrayBufferView): void {
		if (typeof message === 'string') {
			this.sentText.push(message)
			return
		}
		const bytes: Uint8Array = message instanceof ArrayBuffer
			? new Uint8Array(message)
			: new Uint8Array(message.buffer, message.byteOffset, message.byteLength)
		this.sentBinary.push(Array.from(bytes))
	}

	addEventListener(type: string, handler: (event: MessageEvent) => void): void {
		if (type === 'message') {
			this.messageHandler = handler
		}
	}

	dispatchMessage(data: string | Uint8Array): void {
		this.messageHandler?.({ data } as MessageEvent)
	}
}

async function nextTick(): Promise<void> {
	await new Promise<void>((resolve: () => void): void => {
		setTimeout(resolve, 0)
	})
}
