import { describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../../testing/bdd'
import { createSeedDreamNativeImageClient, createSeedDreamSimpleImageClient } from './index'
import type { AISimpleImageClientGenerateInput } from '..'
import type { TenantShardDb } from '../../../db'

type SeedDreamImageEvent = {
	type:
		| 'image_generation.partial_succeeded'
		| 'image_generation.partial_failed'
		| 'image_generation.partial_image'
		| 'image_generation.completed'
	b64_json?: string
	error?: string
}

type R2PutResult = {
	key: string
	url: string
}

const {
	openAIConstructorMock,
	generateMock,
	r2PutMock,
	r2GetMock,
	r2GetImageVariantMock,
	createR2ClientMock
} = vi.hoisted(() => {
	return {
		openAIConstructorMock: vi.fn(),
		generateMock: vi.fn(),
		r2PutMock: vi.fn(),
		r2GetMock: vi.fn(),
		r2GetImageVariantMock: vi.fn(),
		createR2ClientMock: vi.fn()
	}
})

vi.mock('openai', () => {
	class MockOpenAI {
		images: {
			generate: typeof generateMock
		}

		constructor(config: { apiKey: string; baseURL: string }) {
			openAIConstructorMock(config)
			this.images = {
				generate: generateMock
			}
		}
	}

	return {
		default: MockOpenAI
	}
})

vi.mock('../../../r2', () => {
	createR2ClientMock.mockImplementation(() => {
		return {
			put: r2PutMock,
			get: r2GetMock,
			getImageVariant: r2GetImageVariantMock
		}
	})
	return {
		createR2Client: createR2ClientMock
	}
})

describe('createSeedDreamSimpleImageClient.generate', () => {
	type GivenDetail = {
		envModel: string
		optionsModel?: string
		optionsUserId?: string
		events?: SeedDreamImageEvent[]
		r2Results?: R2PutResult[]
	}
	type WhenDetail = {
		input: AISimpleImageClientGenerateInput
	}
	type ThenExpected = {
		outputCount: number
		firstMimeType: string
		modelUsed: string
		sizeUsed: string
		responseFormat: string
		stream: boolean
		outputFormat: string
		watermark: boolean
		sequentialImageGeneration: string
		imageType: string
		imageCount: number
		firstImage: string
		r2PutCalls: number
		firstR2PutDir: string
		firstR2PutIsPublic: boolean
		r2GetCalls: number
		r2GetImageVariantCalls: number
		firstR2Key: string
		errorMessage: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: '2K landscape maps to SeedDream recommended dimensions',
			given: 'env model and one streamed image',
			when: 'generating with 2K and 16:9',
			then: 'calls generate with mapped size and stream enabled',
			givenDetail: {
				envModel: 'env-model',
				events: [
					{ type: 'image_generation.partial_image', b64_json: 'preview' },
					{ type: 'image_generation.partial_succeeded', b64_json: 'a' },
					{ type: 'image_generation.completed' }
				]
			},
			whenDetail: {
				input: {
					prompt: 'draw',
					numberOfImages: 1,
					imageSize: '2K',
					aspectRatio: '16:9'
				}
			},
			thenExpected: {
				outputCount: 1,
				firstMimeType: 'image/png',
				modelUsed: 'env-model',
				sizeUsed: '2848x1600',
				responseFormat: 'b64_json',
				stream: true,
				outputFormat: 'png',
				watermark: false,
				sequentialImageGeneration: 'disabled',
				imageType: 'none',
				imageCount: 0,
				firstImage: '',
				r2PutCalls: 0,
				firstR2PutDir: '',
				firstR2PutIsPublic: false,
				r2GetCalls: 0,
				r2GetImageVariantCalls: 0,
				firstR2Key: '',
				errorMessage: ''
			}
		},
		{
			scenario: '4K portrait maps to SeedDream recommended dimensions',
			given: 'options model and one streamed image',
			when: 'generating with 4K and 9:16',
			then: 'uses options model and mapped size',
			givenDetail: {
				envModel: 'env-model',
				optionsModel: 'opt-model',
				events: [
					{ type: 'image_generation.partial_succeeded', b64_json: 'b' },
					{ type: 'image_generation.completed' }
				]
			},
			whenDetail: {
				input: {
					prompt: 'draw portrait',
					imageSize: '4K',
					aspectRatio: '9:16'
				}
			},
			thenExpected: {
				outputCount: 1,
				firstMimeType: 'image/png',
				modelUsed: 'opt-model',
				sizeUsed: '3040x5504',
				responseFormat: 'b64_json',
				stream: true,
				outputFormat: 'png',
				watermark: false,
				sequentialImageGeneration: 'disabled',
				imageType: 'none',
				imageCount: 0,
				firstImage: '',
				r2PutCalls: 0,
				firstR2PutDir: '',
				firstR2PutIsPublic: false,
				r2GetCalls: 0,
				r2GetImageVariantCalls: 0,
				firstR2Key: '',
				errorMessage: ''
			}
		},
		{
			scenario: 'references are passed as SeedDream data urls',
			given: 'one inline reference and one streamed image',
			when: 'generating with reference image',
			then: 'passes image in extra body',
			givenDetail: {
				envModel: 'env-model',
				events: [
					{ type: 'image_generation.partial_succeeded', b64_json: 'c' },
					{ type: 'image_generation.completed' }
				]
			},
			whenDetail: {
				input: {
					prompt: 'edit',
					references: [{ imageBase64: 'cmVm', mimeType: 'image/png' }]
				}
			},
			thenExpected: {
				outputCount: 1,
				firstMimeType: 'image/png',
				modelUsed: 'env-model',
				sizeUsed: '2048x2048',
				responseFormat: 'b64_json',
				stream: true,
				outputFormat: 'png',
				watermark: false,
				sequentialImageGeneration: 'disabled',
				imageType: 'string',
				imageCount: 1,
				firstImage: 'data:image/png;base64,cmVm',
				r2PutCalls: 0,
				firstR2PutDir: '',
				firstR2PutIsPublic: false,
				r2GetCalls: 0,
				r2GetImageVariantCalls: 0,
				firstR2Key: '',
				errorMessage: ''
			}
		},
		{
			scenario: 'multiple references are passed as SeedDream image array',
			given: 'two references and one streamed image',
			when: 'generating with multiple reference images',
			then: 'passes image array in extra body',
			givenDetail: {
				envModel: 'env-model',
				events: [
					{ type: 'image_generation.partial_succeeded', b64_json: 'd' },
					{ type: 'image_generation.completed' }
				]
			},
			whenDetail: {
				input: {
					prompt: 'merge',
					references: [
						{ imageBase64: 'MQ==', mimeType: 'image/png' },
						{ imageBase64: 'Mg==', mimeType: 'image/jpeg' }
					]
				}
			},
			thenExpected: {
				outputCount: 1,
				firstMimeType: 'image/png',
				modelUsed: 'env-model',
				sizeUsed: '2048x2048',
				responseFormat: 'b64_json',
				stream: true,
				outputFormat: 'png',
				watermark: false,
				sequentialImageGeneration: 'disabled',
				imageType: 'array',
				imageCount: 2,
				firstImage: 'data:image/png;base64,MQ==',
				r2PutCalls: 0,
				firstR2PutDir: '',
				firstR2PutIsPublic: false,
				r2GetCalls: 0,
				r2GetImageVariantCalls: 0,
				firstR2Key: '',
				errorMessage: ''
			}
		},
		{
			scenario: 'uploadToR2 uploads generated image',
			given: 'streamed image and one r2 result',
			when: 'generating with uploadToR2 enabled',
			then: 'attaches r2 key in output',
			givenDetail: {
				envModel: 'env-model',
				events: [
					{ type: 'image_generation.partial_succeeded', b64_json: 'ZQ==' },
					{ type: 'image_generation.completed' }
				],
				r2Results: [{ key: 'public/images/1.png', url: 'http://localhost/api/r2/public/images/1.png' }]
			},
			whenDetail: {
				input: {
					prompt: 'upload',
					uploadToR2: true,
					r2UploadDir: 'custom/images',
					r2UploadIsPublic: true
				}
			},
			thenExpected: {
				outputCount: 1,
				firstMimeType: 'image/png',
				modelUsed: 'env-model',
				sizeUsed: '2048x2048',
				responseFormat: 'b64_json',
				stream: true,
				outputFormat: 'png',
				watermark: false,
				sequentialImageGeneration: 'disabled',
				imageType: 'none',
				imageCount: 0,
				firstImage: '',
				r2PutCalls: 1,
				firstR2PutDir: 'custom/images',
				firstR2PutIsPublic: true,
				r2GetCalls: 0,
				r2GetImageVariantCalls: 0,
				firstR2Key: 'public/images/1.png',
				errorMessage: ''
			}
		},
		{
			scenario: 'unsupported 1K size fails early',
			given: 'env model',
			when: 'generating with 1K',
			then: 'throws unsupported SeedDream image size',
			givenDetail: {
				envModel: 'env-model',
				events: []
			},
			whenDetail: {
				input: {
					prompt: 'draw 1k',
					imageSize: '1K'
				}
			},
			thenExpected: {
				outputCount: 0,
				firstMimeType: '',
				modelUsed: '',
				sizeUsed: '',
				responseFormat: '',
				stream: false,
				outputFormat: '',
				watermark: false,
				sequentialImageGeneration: '',
				imageType: 'none',
				imageCount: 0,
				firstImage: '',
				r2PutCalls: 0,
				firstR2PutDir: '',
				firstR2PutIsPublic: false,
				r2GetCalls: 0,
				r2GetImageVariantCalls: 0,
				firstR2Key: '',
				errorMessage: 'SeedDream image size is unsupported: 1K'
			}
		}
	]

	runCases(cases, async (given, when): Promise<ThenExpected> => {
		vi.clearAllMocks()

		generateMock.mockResolvedValue(createEventStream(given.events ?? []))
		let r2Index = 0
		r2PutMock.mockImplementation(async () => {
			const result = given.r2Results?.[r2Index]
			r2Index += 1
			return result ?? { key: '', url: '' }
		})
		r2GetMock.mockResolvedValue({
			status: 'ok',
			body: new ReadableStream<Uint8Array>({
				start(controller): void {
					controller.enqueue(new TextEncoder().encode('origin'))
					controller.close()
				}
			}),
			contentType: 'image/png'
		})
		r2GetImageVariantMock.mockResolvedValue({
			status: 'ok',
			body: new ReadableStream<Uint8Array>({
				start(controller): void {
					controller.enqueue(new TextEncoder().encode('variant'))
					controller.close()
				}
			}),
			contentType: 'image/png'
		})

		const env: Env = createEnv(given.envModel)
		const client = createSeedDreamSimpleImageClient(
			env,
			given.optionsUserId ?? 'u',
			{} as TenantShardDb,
			{ model: given.optionsModel }
		)

		try {
			const outputs = await client.generate(when.input)
			const arg = generateMock.mock.calls[0]?.[0] as SeedDreamRequest | undefined
			const image = arg?.extra_body?.image
			return toThenExpected(outputs, arg, image, '')
		} catch (error) {
			return toThenExpected([], undefined, undefined, error instanceof Error ? error.message : String(error))
		}
	})
})

async function* createEventStream(events: SeedDreamImageEvent[]): AsyncIterable<SeedDreamImageEvent> {
	for (const event of events) {
		yield event
	}
}

type SeedDreamRequest = {
	model?: string
	size?: string
	response_format?: string
	stream?: boolean
	extra_body?: {
		image?: string | string[]
		output_format?: string
		watermark?: boolean
		sequential_image_generation?: string
	}
}

function toThenExpected(
	outputs: Array<{ mimeType: string; r2?: { key: string } }>,
	arg: SeedDreamRequest | undefined,
	image: string | string[] | undefined,
	errorMessage: string
): {
	outputCount: number
	firstMimeType: string
	modelUsed: string
	sizeUsed: string
	responseFormat: string
	stream: boolean
	outputFormat: string
	watermark: boolean
	sequentialImageGeneration: string
	imageType: string
	imageCount: number
	firstImage: string
	r2PutCalls: number
	firstR2PutDir: string
	firstR2PutIsPublic: boolean
	r2GetCalls: number
	r2GetImageVariantCalls: number
	firstR2Key: string
	errorMessage: string
} {
	return {
		outputCount: outputs.length,
		firstMimeType: outputs[0]?.mimeType ?? '',
		modelUsed: arg?.model ?? '',
		sizeUsed: arg?.size ?? '',
		responseFormat: arg?.response_format ?? '',
		stream: arg?.stream ?? false,
		outputFormat: arg?.extra_body?.output_format ?? '',
		watermark: arg?.extra_body?.watermark ?? false,
		sequentialImageGeneration: arg?.extra_body?.sequential_image_generation ?? '',
		imageType: Array.isArray(image) ? 'array' : image ? 'string' : 'none',
		imageCount: Array.isArray(image) ? image.length : image ? 1 : 0,
		firstImage: Array.isArray(image) ? image[0] ?? '' : image ?? '',
		r2PutCalls: r2PutMock.mock.calls.length,
		firstR2PutDir: (r2PutMock.mock.calls[0]?.[0] as { dir?: string } | undefined)?.dir ?? '',
		firstR2PutIsPublic:
			(r2PutMock.mock.calls[0]?.[0] as { isPublic?: boolean } | undefined)?.isPublic ??
			false,
		r2GetCalls: r2GetMock.mock.calls.length,
		r2GetImageVariantCalls: r2GetImageVariantMock.mock.calls.length,
		firstR2Key: outputs[0]?.r2?.key ?? '',
		errorMessage
	}
}

describe('createSeedDreamNativeImageClient', () => {
	type GivenDetail = {
		apiKey: string
		baseURL: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		constructorCallCount: number
		apiKey: string
		baseURL: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'creates native SeedDream image client with env config',
			given: 'SeedDream api key and base url',
			when: 'creating native client',
			then: 'passes SeedDream env config to OpenAI constructor',
			givenDetail: {
				apiKey: 'k1',
				baseURL: 'https://ark.cn-beijing.volces.com/api/v3'
			},
			whenDetail: {},
			thenExpected: {
				constructorCallCount: 1,
				apiKey: 'k1',
				baseURL: 'https://ark.cn-beijing.volces.com/api/v3'
			}
		}
	]

	runCases(cases, (given): ThenExpected => {
		vi.clearAllMocks()
		const env = createEnv('env-model', given.apiKey, given.baseURL)
		createSeedDreamNativeImageClient(env)

		const config = openAIConstructorMock.mock.calls[0]?.[0] as
			| {
					apiKey?: string
					baseURL?: string
			  }
			| undefined

		return {
			constructorCallCount: openAIConstructorMock.mock.calls.length,
			apiKey: config?.apiKey ?? '',
			baseURL: config?.baseURL ?? ''
		}
	})
})

function createEnv(
	model: string,
	apiKey = 'k',
	baseURL = 'https://ark.cn-beijing.volces.com/api/v3'
): Env {
	return {
		IMAGE_SEEDDREAM_API_KEY: apiKey,
		IMAGE_SEEDDREAM_BASE_URL: baseURL,
		IMAGE_SEEDDREAM_FALLBACK_API_KEY: '',
		IMAGE_SEEDDREAM_FALLBACK_BASE_URL: '',
		IMAGE_SEEDDREAM_MODEL: model
	} as unknown as Env
}
