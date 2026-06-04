import { describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../../testing/bdd'
import { newOpenAINativeImageClient, newOpenAISimpleImageClient } from './index'
import type { AISimpleImageClientGenerateInput } from '..'
import type { TenantShardDb } from '../../../db'

type OpenAIImageResponse = {
	type: 'image_generation.partial_image' | 'image_generation.completed' | 'image_edit.partial_image' | 'image_edit.completed'
	b64_json: string
	output_format: 'png' | 'jpeg' | 'webp'
}

type R2PutResult = {
	key: string
	url: string
}

const {
	openAIConstructorMock,
	generateMock,
	editMock,
	toFileMock,
	r2PutImageMock,
	r2GetMock,
	r2GetVariantBytesMock,
	newR2ClientMock
} = vi.hoisted(() => {
	return {
		openAIConstructorMock: vi.fn(),
		generateMock: vi.fn(),
		editMock: vi.fn(),
		toFileMock: vi.fn(),
		r2PutImageMock: vi.fn(),
		r2GetMock: vi.fn(),
		r2GetVariantBytesMock: vi.fn(),
		newR2ClientMock: vi.fn()
	}
})

vi.mock('openai', () => {
	class MockOpenAI {
		images: {
			generate: typeof generateMock
			edit: typeof editMock
		}

		constructor(config: { apiKey: string; baseURL: string }) {
			openAIConstructorMock(config)
			this.images = {
				generate: generateMock,
				edit: editMock
			}
		}
	}

	return {
		default: MockOpenAI,
		toFile: toFileMock
	}
})

vi.mock('../../../r2', () => {
	newR2ClientMock.mockImplementation(() => {
		return {
			putImage: r2PutImageMock,
			get: r2GetMock,
			getImageVariantBytes: r2GetVariantBytesMock
		}
	})
	return {
		newR2Client: newR2ClientMock
	}
})

describe('newOpenAISimpleImageClient.generate', () => {
	type GivenDetail = {
		envModel: string
		optionsModel?: string
		optionsUserId?: string
		generateEvents?: OpenAIImageResponse[]
		editEvents?: OpenAIImageResponse[]
		r2Results?: R2PutResult[]
	}
	type WhenDetail = {
		input: AISimpleImageClientGenerateInput
	}
	type ThenExpected = {
		outputCount: number
		firstMimeType: string
		modelUsed: string
		sizeInGenerate: string
		sizeInEdit: string
		moderationInGenerate: string
		moderationInEdit: string
		streamInGenerate: boolean
		streamInEdit: boolean
		partialImagesInGenerate: number
		partialImagesInEdit: number
		generateCalled: number
		editCalled: number
		toFileCalls: number
		r2PutCalls: number
		firstR2PutDir: string
		firstR2PutIsPublic: boolean
		r2GetCalls: number
		r2GetVariantBytesCalls: number
		firstR2Key: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: '1K size + landscape ratio converts to dynamic dimensions',
			given: 'env model and one generated image',
			when: 'generating with imageSize 1K and aspect ratio 16:9',
			then: 'calls generate with converted size and moderation auto',
			givenDetail: {
				envModel: 'env-model',
				generateEvents: [
					{ type: 'image_generation.partial_image', b64_json: 'preview', output_format: 'png' },
					{ type: 'image_generation.completed', b64_json: 'a', output_format: 'png' }
				]
			},
			whenDetail: {
				input: {
					prompt: 'draw',
					numberOfImages: 1,
					imageSize: '1K',
					aspectRatio: '16:9'
				}
			},
			thenExpected: {
				outputCount: 1,
				firstMimeType: 'image/png',
				modelUsed: 'env-model',
				sizeInGenerate: '1088x608',
				sizeInEdit: '',
				moderationInGenerate: 'auto',
				moderationInEdit: '',
				streamInGenerate: true,
				streamInEdit: false,
				partialImagesInGenerate: 1,
				partialImagesInEdit: 0,
				generateCalled: 1,
				editCalled: 0,
				toFileCalls: 0,
				r2PutCalls: 0,
				firstR2PutDir: '',
				firstR2PutIsPublic: false,
				r2GetCalls: 0,
				r2GetVariantBytesCalls: 0,
				firstR2Key: ''
			}
		},
		{
			scenario: '4K size + square ratio maps to safe max area',
			given: 'options model override and one generated image',
			when: 'generating with imageSize 4K and ratio 1:1',
			then: 'uses options model and forwards mapped size',
			givenDetail: {
				envModel: 'env-model',
				optionsModel: 'opt-model',
				generateEvents: [{ type: 'image_generation.completed', b64_json: 'b', output_format: 'jpeg' }]
			},
			whenDetail: {
				input: {
					prompt: 'draw 4k',
					imageSize: '4K',
					aspectRatio: '1:1'
				}
			},
			thenExpected: {
				outputCount: 1,
				firstMimeType: 'image/jpeg',
				modelUsed: 'opt-model',
				sizeInGenerate: '2880x2880',
				sizeInEdit: '',
				moderationInGenerate: 'auto',
				moderationInEdit: '',
				streamInGenerate: true,
				streamInEdit: false,
				partialImagesInGenerate: 1,
				partialImagesInEdit: 0,
				generateCalled: 1,
				editCalled: 0,
				toFileCalls: 0,
				r2PutCalls: 0,
				firstR2PutDir: '',
				firstR2PutIsPublic: false,
				r2GetCalls: 0,
				r2GetVariantBytesCalls: 0,
				firstR2Key: ''
			}
		},
		{
			scenario: 'edit mode converts references to files',
			given: 'env model and one edited image',
			when: 'editing with one reference and low censorship mode',
			then: 'calls edit with converted size',
			givenDetail: {
				envModel: 'env-model',
				editEvents: [
					{ type: 'image_edit.partial_image', b64_json: 'preview', output_format: 'webp' },
					{ type: 'image_edit.completed', b64_json: 'c', output_format: 'webp' }
				]
			},
			whenDetail: {
				input: {
					prompt: 'edit',
					references: [{ imageBase64: 'cmVm', mimeType: 'image/png' }],
					aspectRatio: '9:16',
					lowCensorship: true
				}
			},
			thenExpected: {
				outputCount: 1,
				firstMimeType: 'image/webp',
				modelUsed: 'env-model',
				sizeInGenerate: '',
				sizeInEdit: '608x1088',
				moderationInGenerate: '',
				moderationInEdit: 'low',
				streamInGenerate: false,
				streamInEdit: true,
				partialImagesInGenerate: 0,
				partialImagesInEdit: 1,
				generateCalled: 0,
				editCalled: 1,
				toFileCalls: 1,
				r2PutCalls: 0,
				firstR2PutDir: '',
				firstR2PutIsPublic: false,
				r2GetCalls: 0,
				r2GetVariantBytesCalls: 0,
				firstR2Key: ''
			}
		},
		{
			scenario: 'uploadToR2 uploads generated image',
			given: 'generate response and one r2 result',
			when: 'generating with uploadToR2 enabled',
			then: 'attaches r2 key in output',
			givenDetail: {
				envModel: 'env-model',
				generateEvents: [{ type: 'image_generation.completed', b64_json: 'd', output_format: 'png' }],
				r2Results: [{ key: 'public/images/1.png', url: 'http://localhost:5173/api/r2/public/images/1.png' }]
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
				sizeInGenerate: '1024x1024',
				sizeInEdit: '',
				moderationInGenerate: 'auto',
				moderationInEdit: '',
				streamInGenerate: true,
				streamInEdit: false,
				partialImagesInGenerate: 1,
				partialImagesInEdit: 0,
				generateCalled: 1,
				editCalled: 0,
				toFileCalls: 0,
				r2PutCalls: 1,
				firstR2PutDir: 'custom/images',
				firstR2PutIsPublic: true,
				r2GetCalls: 0,
				r2GetVariantBytesCalls: 0,
				firstR2Key: 'public/images/1.png'
			}
		},
		{
			scenario: 'r2 reference reads origin image before edit',
			given: 'edit response with one r2 source image',
			when: 'editing with r2 reference',
			then: 'loads origin bytes and converts to file',
			givenDetail: {
				envModel: 'env-model',
				optionsUserId: 'u',
				editEvents: [{ type: 'image_edit.completed', b64_json: 'e', output_format: 'png' }]
			},
			whenDetail: {
				input: {
					prompt: 'edit r2',
					references: [{ r2: { key: 'private/u/ref.png' } }]
				}
			},
			thenExpected: {
				outputCount: 1,
				firstMimeType: 'image/png',
				modelUsed: 'env-model',
				sizeInGenerate: '',
				sizeInEdit: '1024x1024',
				moderationInGenerate: '',
				moderationInEdit: 'auto',
				streamInGenerate: false,
				streamInEdit: true,
				partialImagesInGenerate: 0,
				partialImagesInEdit: 1,
				generateCalled: 0,
				editCalled: 1,
				toFileCalls: 1,
				r2PutCalls: 0,
				firstR2PutDir: '',
				firstR2PutIsPublic: false,
				r2GetCalls: 1,
				r2GetVariantBytesCalls: 0,
				firstR2Key: ''
			}
		}
	]

	runCases(cases, async (given, when) => {
		vi.clearAllMocks()

		generateMock.mockResolvedValue(createEventStream(given.generateEvents ?? []))
		editMock.mockResolvedValue(createEventStream(given.editEvents ?? []))
		toFileMock.mockResolvedValue({ name: 'ref.png' } as unknown as File)

		let r2Index = 0
		r2PutImageMock.mockImplementation(async () => {
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
		r2GetVariantBytesMock.mockResolvedValue({
			status: 'ok',
			body: new TextEncoder().encode('variant').buffer,
			contentType: 'image/png'
		})

		const env: Env = createEnv(given.envModel)
		const client = newOpenAISimpleImageClient(env, given.optionsUserId ?? 'u', {} as TenantShardDb, {
			model: given.optionsModel
		})
		const outputs = await client.generate(when.input)

		const generateArg = generateMock.mock.calls[0]?.[0] as
			| {
					model?: string
					size?: string
					moderation?: string
					stream?: boolean
					partial_images?: number
			  }
			| undefined
		const editArg = editMock.mock.calls[0]?.[0] as
			| {
					model?: string
					size?: string
					moderation?: string
					stream?: boolean
					partial_images?: number
			  }
			| undefined

		return {
			outputCount: outputs.length,
			firstMimeType: outputs[0]?.mimeType ?? '',
			modelUsed: generateArg?.model ?? editArg?.model ?? '',
			sizeInGenerate: generateArg?.size ?? '',
			sizeInEdit: editArg?.size ?? '',
			moderationInGenerate: generateArg?.moderation ?? '',
			moderationInEdit: editArg?.moderation ?? '',
			streamInGenerate: generateArg?.stream ?? false,
			streamInEdit: editArg?.stream ?? false,
			partialImagesInGenerate: generateArg?.partial_images ?? 0,
			partialImagesInEdit: editArg?.partial_images ?? 0,
			generateCalled: generateMock.mock.calls.length,
			editCalled: editMock.mock.calls.length,
			toFileCalls: toFileMock.mock.calls.length,
			r2PutCalls: r2PutImageMock.mock.calls.length,
			firstR2PutDir:
				(r2PutImageMock.mock.calls[0]?.[0] as { dir?: string } | undefined)?.dir ?? '',
			firstR2PutIsPublic:
				(r2PutImageMock.mock.calls[0]?.[0] as { isPublic?: boolean } | undefined)?.isPublic ?? false,
			r2GetCalls: r2GetMock.mock.calls.length,
			r2GetVariantBytesCalls: r2GetVariantBytesMock.mock.calls.length,
			firstR2Key: outputs[0]?.r2?.key ?? ''
		}
	})
})

async function* createEventStream(events: OpenAIImageResponse[]): AsyncIterable<OpenAIImageResponse> {
	for (const event of events) {
		yield event
	}
}

describe('newOpenAINativeImageClient', () => {
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
			scenario: 'creates native openai image client with env config',
			given: 'image openai api key and base url',
			when: 'creating native client',
			then: 'passes image env config to openai constructor',
			givenDetail: {
				apiKey: 'k1',
				baseURL: 'https://image.example.com/v1'
			},
			whenDetail: {},
			thenExpected: {
				constructorCallCount: 1,
				apiKey: 'k1',
				baseURL: 'https://image.example.com/v1'
			}
		}
	]

	runCases(cases, (given, _when) => {
		vi.clearAllMocks()
		const env = createEnv('env-model', given.apiKey, given.baseURL)
		newOpenAINativeImageClient(env)

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

function createEnv(model: string, apiKey = 'k', baseURL = 'https://api.openai.com/v1'): Env {
	return {
		IMAGE_OPENAI_API_KEY: apiKey,
		IMAGE_OPENAI_BASE_URL: baseURL,
		IMAGE_OPENAI_MODEL: model
	} as unknown as Env
}
