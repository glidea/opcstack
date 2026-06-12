import { describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../../testing/bdd'
import type { TenantShardDb } from '../../../db'
import type { AITTSSourceInput, AITTSSpeechInput } from '..'
import {
	decodeSeedPodcastFrame,
	encodeSeedPodcastConnectionFrame,
	encodeSeedPodcastSessionFrame,
	newSeedSimpleTTSClient,
	toSeedPodcastScriptRequest,
	toSeedPodcastSourceRequest
} from './index'

type R2PutResult = {
	key: string
	url: string
}

const mocks = vi.hoisted(() => {
	return {
		fetch: vi.fn(),
		r2Put: vi.fn(),
		newR2Client: vi.fn()
	}
})

vi.stubGlobal('fetch', mocks.fetch)

vi.mock('../../../r2', () => {
	mocks.newR2Client.mockImplementation(() => {
		return {
			put: mocks.r2Put
		}
	})

	return {
		newR2Client: mocks.newR2Client
	}
})

describe('newSeedSimpleTTSClient.generateSpeech', () => {
	type GivenDetail = {
		envModel: string
		optionsModel?: string
		baseUrl?: string
		responseText: string
		responseOk?: boolean
		r2Result?: R2PutResult
	}
	type WhenDetail = {
		input: AITTSSpeechInput
	}
	type ThenExpected = {
		audioBase64: string
		mimeType: string
		fetchUrl: string
		apiKey: string
		resourceId: string
		model: string
		text: string
		speaker: string
		format: string
		sampleRate: number
		r2PutCalls: number
		r2ContentType: string
		r2FilenameExt: string
		r2Key: string
		r2ClientUserId: string
		errorMessage: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'single speaker request maps to seed HTTP Chunked',
			given: 'two audio chunks and one finish chunk',
			when: 'calling generateSpeech',
			then: 'it sends seed request and joins audio data',
			givenDetail: {
				envModel: 'seed-tts-2.0-standard',
				responseText:
					'{"code":0,"message":"","data":"aaa"}\n{"code":0,"message":"","data":"bbb"}\n{"code":20000000,"message":"ok","data":null}\n'
			},
			whenDetail: {
				input: {
					instruction: 'do not send this',
					speakers: [{ name: 'Host', voiceName: 'zh_female_cancan_mars_bigtts' }],
					lines: [
						{ speakerName: 'Host', text: 'Hello' },
						{ speakerName: 'Host', text: 'World' }
					]
				}
			},
			thenExpected: {
				audioBase64: 'aaabbb',
				mimeType: 'audio/mpeg',
				fetchUrl: 'https://openspeech.bytedance.com/api/v3/tts/unidirectional',
				apiKey: 'api-key',
				resourceId: 'seed-tts-2.0',
				model: 'seed-tts-2.0-standard',
				text: 'Hello\nWorld',
				speaker: 'zh_female_cancan_mars_bigtts',
				format: 'mp3',
				sampleRate: 24000,
				r2PutCalls: 0,
				r2ContentType: '',
				r2FilenameExt: '',
				r2Key: '',
				r2ClientUserId: '',
				errorMessage: ''
			}
		},
		{
			scenario: 'options model overrides env model and upload stores mp3',
			given: 'one audio chunk and one r2 put result',
			when: 'calling generateSpeech with uploadToR2',
			then: 'it uploads mp3 bytes to r2',
			givenDetail: {
				envModel: 'seed-tts-2.0-standard',
				optionsModel: 'seed-tts-2.0-expressive',
				responseText:
					'{"code":0,"message":"","data":"YXVkaW8="}\n{"code":20000000,"message":"ok","data":null}\n',
				r2Result: {
					key: 'private/u1/audio/1.mp3',
					url: 'http://localhost:5173/api/r2/private/audio/1.mp3'
				}
			},
			whenDetail: {
				input: {
					speakers: [{ name: 'Host', voiceName: 'zh_female_cancan_mars_bigtts' }],
					lines: [{ speakerName: 'Host', text: 'Audio line' }],
					uploadToR2: true
				}
			},
			thenExpected: {
				audioBase64: 'YXVkaW8=',
				mimeType: 'audio/mpeg',
				fetchUrl: 'https://openspeech.bytedance.com/api/v3/tts/unidirectional',
				apiKey: 'api-key',
				resourceId: 'seed-tts-2.0',
				model: 'seed-tts-2.0-expressive',
				text: 'Audio line',
				speaker: 'zh_female_cancan_mars_bigtts',
				format: 'mp3',
				sampleRate: 24000,
				r2PutCalls: 1,
				r2ContentType: 'audio/mpeg',
				r2FilenameExt: '.mp3',
				r2Key: 'private/u1/audio/1.mp3',
				r2ClientUserId: 'u1',
				errorMessage: ''
			}
		},
		{
			scenario: 'multi speaker input is rejected',
			given: 'two speakers',
			when: 'calling generateSpeech',
			then: 'it throws invalid speaker count',
			givenDetail: {
				envModel: 'seed-tts-2.0-standard',
				responseText: ''
			},
			whenDetail: {
				input: {
					speakers: [
						{ name: 'Host', voiceName: 'a' },
						{ name: 'Guest', voiceName: 'b' }
					],
					lines: [{ speakerName: 'Host', text: 'Hello' }]
				}
			},
			thenExpected: createErrorExpected('INVALID_SPEAKER_COUNT')
		},
		{
			scenario: 'unknown speaker line is rejected',
			given: 'line speaker is not declared',
			when: 'calling generateSpeech',
			then: 'it throws unknown speaker',
			givenDetail: {
				envModel: 'seed-tts-2.0-standard',
				responseText: ''
			},
			whenDetail: {
				input: {
					speakers: [{ name: 'Host', voiceName: 'a' }],
					lines: [{ speakerName: 'Guest', text: 'Hello' }]
				}
			},
			thenExpected: createErrorExpected('UNKNOWN_SPEAKER: Guest')
		}
	]

	runCases(cases, async (given: GivenDetail, when: WhenDetail): Promise<ThenExpected> => {
		vi.clearAllMocks()
		mocks.r2Put.mockResolvedValue(given.r2Result ?? { key: '', url: '' })
		mocks.fetch.mockResolvedValue(
			new Response(toStream(given.responseText), {
				status: given.responseOk ?? true ? 200 : 500
			})
		)

		const env: Env = createEnv(given.envModel, given.baseUrl)
		const tenantDb: TenantShardDb = {} as TenantShardDb
		const client = newSeedSimpleTTSClient(env, 'u1', tenantDb, {
			model: given.optionsModel
		})

		try {
			const output = await client.generateSpeech(when.input)
			const request = mocks.fetch.mock.calls[0] as [string, RequestInit] | undefined
			const headers = (request?.[1].headers ?? {}) as Record<string, string>
			const body = JSON.parse((request?.[1].body ?? '{}') as string) as {
				req_params?: {
					text?: string
					model?: string
					speaker?: string
					audio_params?: {
						format?: string
						sample_rate?: number
					}
				}
			}
			const r2PutArg = mocks.r2Put.mock.calls[0]?.[0] as
				| {
						contentType?: string
						filename?: string
				  }
				| undefined

			return {
				audioBase64: output.audioBase64,
				mimeType: output.mimeType,
				fetchUrl: request?.[0] ?? '',
				apiKey: headers['X-Api-Key'] ?? '',
				resourceId: headers['X-Api-Resource-Id'] ?? '',
				model: body.req_params?.model ?? '',
				text: body.req_params?.text ?? '',
				speaker: body.req_params?.speaker ?? '',
				format: body.req_params?.audio_params?.format ?? '',
				sampleRate: body.req_params?.audio_params?.sample_rate ?? 0,
				r2PutCalls: mocks.r2Put.mock.calls.length,
				r2ContentType: r2PutArg?.contentType ?? '',
				r2FilenameExt: r2PutArg?.filename?.endsWith('.mp3') ? '.mp3' : '',
				r2Key: output.r2?.key ?? '',
				r2ClientUserId: (mocks.newR2Client.mock.calls[0]?.[1] as string | undefined) ?? '',
				errorMessage: ''
			}
		} catch (error) {
			return createErrorExpected(error instanceof Error ? error.message : String(error))
		}
	})
})

describe('seed podcast request mapping', () => {
	type GivenDetail = {
		speech?: AITTSSpeechInput
		source?: AITTSSourceInput
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		action: number
		inputText: string
		inputUrl: string
		promptText: string
		nlpTextCount: number
		speakerCount: number
		durationTextLength: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'script input maps to podcast action 3',
			given: 'two speaker script',
			when: 'building seed podcast request',
			then: 'uses nlp text payload',
			givenDetail: {
				speech: {
					speakers: [
						{ name: 'host', voiceName: 'zh_female_mizaitongxue_v2_saturn_bigtts' },
						{ name: 'guest', voiceName: 'zh_male_dayixiansheng_v2_saturn_bigtts' }
					],
					lines: [
						{ speakerName: 'host', text: '今天聊 D1' },
						{ speakerName: 'guest', text: '先说结论' }
					]
				}
			},
			whenDetail: {},
			thenExpected: {
				action: 3,
				inputText: '',
				inputUrl: '',
				promptText: '',
				nlpTextCount: 2,
				speakerCount: 2,
				durationTextLength: 0
			}
		},
		{
			scenario: 'url source maps to podcast action 0',
			given: 'article url and duration hint',
			when: 'building seed podcast request',
			then: 'uses input url and estimated text length',
			givenDetail: {
				source: {
					inputUrl: 'https://example.com/article',
					durationHintSeconds: 300
				}
			},
			whenDetail: {},
			thenExpected: {
				action: 0,
				inputText: '',
				inputUrl: 'https://example.com/article',
				promptText: '',
				nlpTextCount: 0,
				speakerCount: 2,
				durationTextLength: 1200
			}
		},
		{
			scenario: 'prompt source maps to podcast action 4',
			given: 'web summary prompt',
			when: 'building seed podcast request',
			then: 'uses prompt text',
			givenDetail: {
				source: {
					promptText: '总结今天 AI 新闻并生成播客'
				}
			},
			whenDetail: {},
			thenExpected: {
				action: 4,
				inputText: '',
				inputUrl: '',
				promptText: '总结今天 AI 新闻并生成播客',
				nlpTextCount: 0,
				speakerCount: 2,
				durationTextLength: 0
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		const request = given.speech
			? toSeedPodcastScriptRequest(given.speech)
			: toSeedPodcastSourceRequest(given.source!)

		return {
			action: request.action,
			inputText: request.input_text ?? '',
			inputUrl: request.input_info?.input_url ?? '',
			promptText: request.prompt_text ?? '',
			nlpTextCount: request.nlp_texts?.length ?? 0,
			speakerCount: request.speaker_info.speakers.length,
			durationTextLength: request.input_info?.input_text_max_length ?? 0
		}
	})
})

describe('seed podcast websocket frame', () => {
	type GivenDetail = Record<string, never>
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		sessionEvent: number
		sessionId: string
		sessionPayload: string
		connectionEvent: number
		connectionPayload: string
		decodedEvent: number
		decodedPayload: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'encodes and decodes websocket v3 frames',
			given: 'start session and podcast end frame',
			when: 'reading binary fields',
			then: 'preserves event id session id and payload',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				sessionEvent: 100,
				sessionId: 'session-1',
				sessionPayload: '{"action":0}',
				connectionEvent: 2,
				connectionPayload: '{}',
				decodedEvent: 363,
				decodedPayload: '{"meta_info":{"audio_url":"https://example.com/a.mp3"}}'
			}
		}
	]

	runCases(cases, async (): Promise<ThenExpected> => {
		const sessionFrame = encodeSeedPodcastSessionFrame(
			100,
			'session-1',
			new TextEncoder().encode('{"action":0}')
		)
		const connectionFrame = encodeSeedPodcastConnectionFrame(2, new TextEncoder().encode('{}'))
		const responseFrame = encodeSeedPodcastSessionFrame(
			363,
			'connection-1',
			new TextEncoder().encode('{"meta_info":{"audio_url":"https://example.com/a.mp3"}}')
		)
		const decoded = decodeSeedPodcastFrame(responseFrame)

		return {
			sessionEvent: new DataView(sessionFrame.buffer).getInt32(4),
			sessionId: new TextDecoder().decode(sessionFrame.slice(12, 21)),
			sessionPayload: new TextDecoder().decode(sessionFrame.slice(25)),
			connectionEvent: new DataView(connectionFrame.buffer).getInt32(4),
			connectionPayload: new TextDecoder().decode(connectionFrame.slice(12)),
			decodedEvent: decoded.event,
			decodedPayload: new TextDecoder().decode(decoded.payload)
		}
	})
})

function createEnv(model: string, baseUrl?: string): Env {
	return {
		TTS_SEED_BASE_URL: baseUrl ?? 'https://openspeech.bytedance.com/api/v3',
		TTS_SEED_API_KEY: 'api-key',
		TTS_SEED_MODEL: model
	} as unknown as Env
}

function toStream(value: string): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		start(controller: ReadableStreamDefaultController<Uint8Array>): void {
			controller.enqueue(new TextEncoder().encode(value))
			controller.close()
		}
	})
}

function createErrorExpected(errorMessage: string): {
	audioBase64: string
	mimeType: string
	fetchUrl: string
	apiKey: string
	resourceId: string
	model: string
	text: string
	speaker: string
	format: string
	sampleRate: number
	r2PutCalls: number
	r2ContentType: string
	r2FilenameExt: string
	r2Key: string
	r2ClientUserId: string
	errorMessage: string
} {
	return {
		audioBase64: '',
		mimeType: '',
		fetchUrl: '',
		apiKey: '',
		resourceId: '',
		model: '',
		text: '',
		speaker: '',
		format: '',
		sampleRate: 0,
		r2PutCalls: 0,
		r2ContentType: '',
		r2FilenameExt: '',
		r2Key: '',
		r2ClientUserId: '',
		errorMessage
	}
}
