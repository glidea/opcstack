import { describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../../testing/bdd'
import type { TenantShardDb } from '../../../db'
import type { AITTSSpeechInput } from '..'
import { newSeedSimpleTTSClient } from './index'

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
