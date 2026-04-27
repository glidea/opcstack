import { describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../../testing/bdd'
import { newGeminiSimpleImageClient } from './index'
import type { AISimpleImageClientGenerateInput } from '..'

type GenerateContentResponseLike = {
	candidates?: Array<{
		content?: {
			parts?: Array<{
				text?: string
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

const { generateContentMock, r2PutImageMock, newR2ClientMock } = vi.hoisted(() => {
	return {
		generateContentMock: vi.fn(),
		r2PutImageMock: vi.fn(),
		newR2ClientMock: vi.fn()
	}
})

vi.mock('@google/genai', () => {
	class MockGoogleGenAI {
		models: {
			generateContent: typeof generateContentMock
		}

		constructor(_config: { apiKey: string; httpOptions: { baseUrl: string } }) {
			this.models = {
				generateContent: generateContentMock
			}
		}
	}

	return {
		GoogleGenAI: MockGoogleGenAI,
		PersonGeneration: {
			ALLOW_ALL: 'ALLOW_ALL'
		}
	}
})

vi.mock('../../../r2', () => {
	newR2ClientMock.mockImplementation(() => {
		return {
			putImage: r2PutImageMock
		}
	})
	return {
		newR2Client: newR2ClientMock
	}
})

describe('newGeminiSimpleImageClient.generate', () => {
	type GivenDetail = {
		envModel: string
		optionsModel?: string
		generateContentResponse?: GenerateContentResponseLike
		r2Results?: R2PutResult[]
	}
	type WhenDetail = {
		input: AISimpleImageClientGenerateInput
	}
	type ThenExpected = {
		outputCount: number
		firstMimeType: string
		generateContentCalled: number
		modelUsed: string
		aspectRatioInConfig: string
		imageSizeInConfig: string
		personGenerationInConfig: string
		candidateCountInConfig: number
		responseModalityFirst: string
		referencePartCount: number
		r2PutCalls: number
		firstR2Key: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'generate mode uses generateContent and forwards image config',
			given: 'env model and generateContent response with two image parts',
			when: 'calling simple generate without references',
			then: 'returns two outputs and forwards size ratio and count',
			givenDetail: {
				envModel: 'env-model',
				generateContentResponse: {
					candidates: [
						{
							content: {
								parts: [{ inlineData: { data: 'a', mimeType: 'image/png' } }]
							}
						},
						{
							content: {
								parts: [{ inlineData: { data: 'b', mimeType: 'image/png' } }]
							}
						}
					]
				}
			},
			whenDetail: {
				input: {
					prompt: 'draw',
					numberOfImages: 2,
					aspectRatio: '16:9',
					imageSize: '2K'
				}
			},
			thenExpected: {
				outputCount: 2,
				firstMimeType: 'image/png',
				generateContentCalled: 1,
				modelUsed: 'env-model',
				aspectRatioInConfig: '16:9',
				imageSizeInConfig: '2K',
				personGenerationInConfig: 'absent',
				candidateCountInConfig: 2,
				responseModalityFirst: 'IMAGE',
				referencePartCount: 0,
				r2PutCalls: 0,
				firstR2Key: ''
			}
		},
		{
			scenario: 'references are passed as inline data parts',
			given: 'options model override and one image response',
			when: 'calling simple generate with one reference image',
			then: 'uses generateContent and includes one reference part',
			givenDetail: {
				envModel: 'env-model',
				optionsModel: 'opt-model',
				generateContentResponse: {
					candidates: [
						{
							content: {
								parts: [{ inlineData: { data: 'c', mimeType: 'image/webp' } }]
							}
						}
					]
				}
			},
			whenDetail: {
				input: {
					prompt: 'edit',
					references: [{ imageBase64: 'ref', mimeType: 'image/png' }],
					numberOfImages: 1,
					aspectRatio: '1:1'
				}
			},
			thenExpected: {
				outputCount: 1,
				firstMimeType: 'image/webp',
				generateContentCalled: 1,
				modelUsed: 'opt-model',
				aspectRatioInConfig: '1:1',
				imageSizeInConfig: '',
				personGenerationInConfig: 'absent',
				candidateCountInConfig: 1,
				responseModalityFirst: 'IMAGE',
				referencePartCount: 1,
				r2PutCalls: 0,
				firstR2Key: ''
			}
		},
		{
			scenario: 'low censorship mode sets personGeneration in image config',
			given: 'env model and one image response',
			when: 'calling simple generate with lowCensorship true',
			then: 'forwards ALLOW_ALL in imageConfig',
			givenDetail: {
				envModel: 'env-model',
				generateContentResponse: {
					candidates: [
						{
							content: {
								parts: [{ inlineData: { data: 'u', mimeType: 'image/png' } }]
							}
						}
					]
				}
			},
			whenDetail: {
				input: {
					prompt: 'draw low censorship',
					lowCensorship: true
				}
			},
			thenExpected: {
				outputCount: 1,
				firstMimeType: 'image/png',
				generateContentCalled: 1,
				modelUsed: 'env-model',
				aspectRatioInConfig: '1:1',
				imageSizeInConfig: '',
				personGenerationInConfig: 'ALLOW_ALL',
				candidateCountInConfig: 0,
				responseModalityFirst: 'IMAGE',
				referencePartCount: 0,
				r2PutCalls: 0,
				firstR2Key: ''
			}
		},
		{
			scenario: 'uploadToR2 uploads each generated image',
			given: 'response with two image candidates and two r2 results',
			when: 'calling simple generate with uploadToR2',
			then: 'attaches r2 metadata for each output',
			givenDetail: {
				envModel: 'env-model',
				generateContentResponse: {
					candidates: [
						{
							content: {
								parts: [{ inlineData: { data: 'x', mimeType: 'image/png' } }]
							}
						},
						{
							content: {
								parts: [{ inlineData: { data: 'y', mimeType: 'image/png' } }]
							}
						}
					]
				},
				r2Results: [
					{ key: 'public/images/1.png', url: 'http://localhost:5173/api/r2/public/images/1.png' },
					{ key: 'public/images/2.png', url: 'http://localhost:5173/api/r2/public/images/2.png' }
				]
			},
			whenDetail: {
				input: {
					prompt: 'multi',
					numberOfImages: 2,
					uploadToR2: true
				}
			},
			thenExpected: {
				outputCount: 2,
				firstMimeType: 'image/png',
				generateContentCalled: 1,
				modelUsed: 'env-model',
				aspectRatioInConfig: '1:1',
				imageSizeInConfig: '',
				personGenerationInConfig: 'absent',
				candidateCountInConfig: 2,
				responseModalityFirst: 'IMAGE',
				referencePartCount: 0,
				r2PutCalls: 2,
				firstR2Key: 'public/images/1.png'
			}
		}
	]

	runCases(cases, async (given, when) => {
		vi.clearAllMocks()

		const response: GenerateContentResponseLike = given.generateContentResponse ?? { candidates: [] }
		generateContentMock.mockResolvedValue(response)

		let r2Index = 0
		r2PutImageMock.mockImplementation(async () => {
			const result = given.r2Results?.[r2Index]
			r2Index += 1
			return result ?? { key: '', url: '' }
		})

		const env: Env = createEnv(given.envModel)
		const client = newGeminiSimpleImageClient(env, {
			model: given.optionsModel
		})
		const outputs = await client.generate(when.input)

		const generateContentArg = generateContentMock.mock.calls[0]?.[0] as
			| {
					model?: string
					config?: Record<string, unknown>
					contents?: Array<{
						parts?: Array<{
							text?: string
							inlineData?: {
								data?: string
								mimeType?: string
							}
						}>
					}>
			  }
			| undefined

		const config = (generateContentArg?.config ?? {}) as Record<string, unknown>
		const imageConfig = (config['imageConfig'] ?? {}) as Record<string, unknown>
		const responseModalities = Array.isArray(config['responseModalities'])
			? (config['responseModalities'] as string[])
			: []
		const requestParts = generateContentArg?.contents?.[0]?.parts ?? []

		return {
			outputCount: outputs.length,
			firstMimeType: outputs[0]?.mimeType ?? '',
			generateContentCalled: generateContentMock.mock.calls.length,
			modelUsed: generateContentArg?.model ?? '',
			aspectRatioInConfig:
				typeof imageConfig['aspectRatio'] === 'string' ? (imageConfig['aspectRatio'] as string) : '',
			imageSizeInConfig:
				typeof imageConfig['imageSize'] === 'string' ? (imageConfig['imageSize'] as string) : '',
			personGenerationInConfig: Object.prototype.hasOwnProperty.call(imageConfig, 'personGeneration')
				? String(imageConfig['personGeneration'])
				: 'absent',
			candidateCountInConfig:
				typeof config['candidateCount'] === 'number' ? (config['candidateCount'] as number) : 0,
			responseModalityFirst: responseModalities[0] ?? '',
			referencePartCount: requestParts.filter((part) => part.inlineData !== undefined).length,
			r2PutCalls: r2PutImageMock.mock.calls.length,
			firstR2Key: outputs[0]?.r2?.key ?? ''
		}
	})
})

function createEnv(model: string): Env {
	return {
		IMAGE_GEMINI_API_KEY: 'k',
		IMAGE_GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com',
		IMAGE_GEMINI_MODEL: model
	} as unknown as Env
}
