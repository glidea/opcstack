import { describe, expect, it, vi } from 'vitest'
import { runCases, type TestCase } from '../../../testing/bdd'
import { createGeminiSimpleTTSClient } from './index'
import type { TenantShardDb } from '../../../db'
import type { AITTSSpeechInput } from '..'

type GenerateContentResponseLike = {
	candidates?: Array<{
		content?: {
			parts?: Array<{
				inlineData?: {
					data?: string
					mimeType?: string
				}
			}>
		}
	}>
}

type R2PutResult = {
	key: string
	url: string
}

const { googleConstructorMock, generateContentMock, r2PutMock, createR2ClientMock } = vi.hoisted(() => {
	return {
		googleConstructorMock: vi.fn(),
		generateContentMock: vi.fn(),
		r2PutMock: vi.fn(),
		createR2ClientMock: vi.fn()
	}
})

vi.mock('@google/genai', () => {
	class MockGoogleGenAI {
		models: {
			generateContent: typeof generateContentMock
		}

		constructor(config: { apiKey: string; httpOptions: { baseUrl: string } }) {
			googleConstructorMock(config)
			this.models = {
				generateContent: generateContentMock
			}
		}
	}

	return {
		GoogleGenAI: MockGoogleGenAI
	}
})

vi.mock('../../../r2', () => {
	createR2ClientMock.mockImplementation(() => {
		return {
			put: r2PutMock
		}
	})

	return {
		createR2Client: createR2ClientMock
	}
})

describe('createGeminiSimpleTTSClient.generateSpeech', () => {
	type GivenDetail = {
		envModel: string
		optionsModel?: string
		generateContentResponse?: GenerateContentResponseLike
		r2Result?: R2PutResult
	}
	type WhenDetail = {
		input: AITTSSpeechInput
	}
	type ThenExpected = {
		audioBase64: string
		mimeType: string
		generateContentCalled: number
		modelUsed: string
		responseModalityFirst: string
		singleVoiceName: string
		multiSpeakerCount: number
		firstMultiSpeakerName: string
		firstMultiVoiceName: string
		promptContainsInstruction: boolean
		promptContainsTranscript: boolean
		r2PutCalls: number
		r2Key: string
		r2ClientUserId: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'single speaker mode uses voiceConfig and returns wav audio',
			given: 'one speaker and one audio inline data',
			when: 'calling generateSpeech',
			then: 'it sends AUDIO modality and returns the first audio part',
			givenDetail: {
				envModel: 'env-model',
				generateContentResponse: {
					candidates: [
						{
							content: {
								parts: [{ inlineData: { data: 'aGVsbG8=', mimeType: 'audio/wav' } }]
							}
						}
					]
				}
			},
			whenDetail: {
				input: {
					instruction: 'zh podcast style',
					speakers: [{ name: 'Host', voiceName: 'Charon', speechStyle: 'calm' }],
					lines: [{ speakerName: 'Host', text: 'Hello world' }]
				}
			},
			thenExpected: {
				audioBase64: 'aGVsbG8=',
				mimeType: 'audio/wav',
				generateContentCalled: 1,
				modelUsed: 'env-model',
				responseModalityFirst: 'AUDIO',
				singleVoiceName: 'Charon',
				multiSpeakerCount: 0,
				firstMultiSpeakerName: '',
				firstMultiVoiceName: '',
				promptContainsInstruction: true,
				promptContainsTranscript: true,
				r2PutCalls: 0,
				r2Key: '',
				r2ClientUserId: ''
			}
		},
		{
			scenario: 'two speakers mode uses multiSpeakerVoiceConfig',
			given: 'two speakers and one audio inline data',
			when: 'calling generateSpeech with model override',
			then: 'it sends multi speaker mappings with speaker names and voice names',
			givenDetail: {
				envModel: 'env-model',
				optionsModel: 'opt-model',
				generateContentResponse: {
					candidates: [
						{
							content: {
								parts: [{ inlineData: { data: 'd29ybGQ=', mimeType: 'audio/wav' } }]
							}
						}
					]
				}
			},
			whenDetail: {
				input: {
					speakers: [
						{ name: 'Host', voiceName: 'Charon', profile: 'Backend engineer' },
						{ name: 'Guest', voiceName: 'Puck', profile: 'PaaS engineer' }
					],
					lines: [
						{ speakerName: 'Host', text: 'Line one' },
						{ speakerName: 'Guest', text: 'Line two' }
					]
				}
			},
			thenExpected: {
				audioBase64: 'd29ybGQ=',
				mimeType: 'audio/wav',
				generateContentCalled: 1,
				modelUsed: 'opt-model',
				responseModalityFirst: 'AUDIO',
				singleVoiceName: '',
				multiSpeakerCount: 2,
				firstMultiSpeakerName: 'Host',
				firstMultiVoiceName: 'Charon',
				promptContainsInstruction: false,
				promptContainsTranscript: true,
				r2PutCalls: 0,
				r2Key: '',
				r2ClientUserId: ''
			}
		},
		{
			scenario: 'uploadToR2 uploads generated wav audio',
			given: 'one speaker one audio inline data and one r2 put result',
			when: 'calling generateSpeech with uploadToR2 true',
			then: 'it uploads bytes to r2 and attaches r2 metadata',
			givenDetail: {
				envModel: 'env-model',
				generateContentResponse: {
					candidates: [
						{
							content: {
								parts: [{ inlineData: { data: 'YXVkaW8=', mimeType: 'audio/wav' } }]
							}
						}
					]
				},
				r2Result: {
					key: 'public/audio/1.wav',
					url: 'http://localhost:5173/api/r2/public/audio/1.wav'
				}
			},
			whenDetail: {
				input: {
					speakers: [{ name: 'Host', voiceName: 'Kore' }],
					lines: [{ speakerName: 'Host', text: 'Audio line' }],
					uploadToR2: true
				}
			},
			thenExpected: {
				audioBase64: 'YXVkaW8=',
				mimeType: 'audio/wav',
				generateContentCalled: 1,
				modelUsed: 'env-model',
				responseModalityFirst: 'AUDIO',
				singleVoiceName: 'Kore',
				multiSpeakerCount: 0,
				firstMultiSpeakerName: '',
				firstMultiVoiceName: '',
				promptContainsInstruction: false,
				promptContainsTranscript: true,
				r2PutCalls: 1,
				r2Key: 'public/audio/1.wav',
				r2ClientUserId: 'u1'
			}
		}
	]

	runCases(cases, async (given, when) => {
		vi.clearAllMocks()

		const response: GenerateContentResponseLike = given.generateContentResponse ?? { candidates: [] }
		generateContentMock.mockResolvedValue(response)
		r2PutMock.mockResolvedValue(given.r2Result ?? { key: '', url: '' })

		const env = createEnv(given.envModel)
		const tenantDb: TenantShardDb = {} as TenantShardDb
		const client = createGeminiSimpleTTSClient(env, 'u1', tenantDb, {
			model: given.optionsModel ?? given.envModel,
			endpoint: { baseURL: 'https://generativelanguage.googleapis.com', apiKey: 'k' }
		})
		const output = await client.generateSpeech(when.input)

		const generateArg = generateContentMock.mock.calls[0]?.[0] as
			| {
					model?: string
					config?: Record<string, unknown>
					contents?: Array<{
						parts?: Array<{ text?: string }>
					}>
			  }
			| undefined

		const config = (generateArg?.config ?? {}) as Record<string, unknown>
		const responseModalities = Array.isArray(config['responseModalities'])
			? (config['responseModalities'] as string[])
			: []
		const speechConfig = (config['speechConfig'] ?? {}) as Record<string, unknown>
		const voiceConfig = (speechConfig['voiceConfig'] ?? {}) as Record<string, unknown>
		const prebuiltVoiceConfig = (voiceConfig['prebuiltVoiceConfig'] ?? {}) as Record<string, unknown>
		const multiSpeakerVoiceConfig = (speechConfig['multiSpeakerVoiceConfig'] ?? {}) as Record<
			string,
			unknown
		>
		const speakerVoiceConfigs = Array.isArray(multiSpeakerVoiceConfig['speakerVoiceConfigs'])
			? (multiSpeakerVoiceConfig['speakerVoiceConfigs'] as Array<Record<string, unknown>>)
			: []
		const firstSpeakerConfig = (speakerVoiceConfigs[0]?.['voiceConfig'] ?? {}) as Record<
			string,
			unknown
		>
		const firstPrebuiltConfig = (firstSpeakerConfig['prebuiltVoiceConfig'] ?? {}) as Record<
			string,
			unknown
		>
		const prompt = generateArg?.contents?.[0]?.parts?.[0]?.text ?? ''

		return {
			audioBase64: output.audioBase64,
			mimeType: output.mimeType,
			generateContentCalled: generateContentMock.mock.calls.length,
			modelUsed: generateArg?.model ?? '',
			responseModalityFirst: responseModalities[0] ?? '',
			singleVoiceName:
				typeof prebuiltVoiceConfig['voiceName'] === 'string'
					? (prebuiltVoiceConfig['voiceName'] as string)
					: '',
			multiSpeakerCount: speakerVoiceConfigs.length,
			firstMultiSpeakerName:
				typeof speakerVoiceConfigs[0]?.['speaker'] === 'string'
					? (speakerVoiceConfigs[0]?.['speaker'] as string)
					: '',
			firstMultiVoiceName:
				typeof firstPrebuiltConfig['voiceName'] === 'string'
					? (firstPrebuiltConfig['voiceName'] as string)
					: '',
			promptContainsInstruction: prompt.includes('Instruction:'),
			promptContainsTranscript: prompt.includes('Transcript:'),
			r2PutCalls: r2PutMock.mock.calls.length,
			r2Key: output.r2?.key ?? '',
			r2ClientUserId: (createR2ClientMock.mock.calls[0]?.[1] as string | undefined) ?? ''
		}
	})

	it('uses the explicit channel endpoint', async () => {
		vi.clearAllMocks()
		generateContentMock.mockResolvedValue({
			candidates: [{ content: { parts: [{ inlineData: { data: 'a', mimeType: 'audio/wav' } }] } }]
		})

		const client = createGeminiSimpleTTSClient(
			createEnv('env-model'),
			'u',
			{} as TenantShardDb,
			{
				model: 'env-model',
				endpoint: { baseURL: 'https://channel.example', apiKey: 'channel-key' }
			}
		)
		await client.generateSpeech({
			speakers: [{ name: 'Host', voiceName: 'Charon' }],
			lines: [{ speakerName: 'Host', text: 'Hello' }]
		})

		expect(googleConstructorMock).toHaveBeenCalledWith({
			apiKey: 'channel-key',
			httpOptions: { baseUrl: 'https://channel.example' }
		})
	})
})

function createEnv(model: string): Env {
	void model
	return {} as Env
}
