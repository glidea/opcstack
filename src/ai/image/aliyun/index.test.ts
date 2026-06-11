import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../../testing/bdd'
import { newAliyunNativeImageClient, newAliyunSimpleImageClient } from './index'
import type { AISimpleImageClientGenerateInput, AIImageResult } from '..'
import type { TenantShardDb } from '../../../db'

type FetchCall = {
	url: string
	init?: RequestInit
}

type R2PutResult = {
	key: string
	url: string
}

type AliyunRequest = {
	model?: string
	input?: {
		prompt?: string
		messages?: Array<{
			role?: string
			content?: Array<{
				text?: string
				image?: string
			}>
		}>
	}
	parameters?: {
		size?: string
		n?: number
		watermark?: boolean
		prompt_extend?: boolean
	}
}

const { r2PutImageMock, r2GetMock, r2GetVariantBytesMock, newR2ClientMock } = vi.hoisted(() => {
	return {
		r2PutImageMock: vi.fn(),
		r2GetMock: vi.fn(),
		r2GetVariantBytesMock: vi.fn(),
		newR2ClientMock: vi.fn()
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

describe('newAliyunSimpleImageClient.generate', () => {
	const fetchCalls: FetchCall[] = []

	beforeEach((): void => {
		fetchCalls.length = 0
		vi.clearAllMocks()
		vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			const url: string = String(input)
			fetchCalls.push({ url, init })

			if (url.endsWith('/services/aigc/multimodal-generation/generation')) {
				return Response.json({
					output: {
						results: [{ url: 'https://provider.example.com/image.png' }]
					}
				})
			}

			return new Response('image-bytes', {
				headers: {
					'content-type': 'image/png'
				}
			})
		})
	})

	type GivenDetail = {
		envModel: string
		optionsModel?: string
		r2Results?: R2PutResult[]
	}
	type WhenDetail = {
		input: AISimpleImageClientGenerateInput
	}
	type ThenExpected = {
		outputCount: number
		firstMimeType: string
		firstImageBase64: string
		modelUsed: string
		prompt: string
		contentLength: number
		firstContentImage: string
		secondContentText: string
		size: string
		n: number
		watermark: boolean
		promptExtend: boolean
		postUrl: string
		authHeader: string
		asyncHeader: string
		imageDownloadCalls: number
		r2PutCalls: number
		firstR2PutDir: string
		firstR2PutIsPublic: boolean
		firstR2Key: string
		errorMessage: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'qwen text generation uses env model',
			given: 'Aliyun env model and provider image url',
			when: 'generating one 2K landscape image',
			then: 'sends DashScope text request and downloads image bytes',
			givenDetail: {
				envModel: 'qwen-image-2.0-pro'
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
				firstImageBase64: 'aW1hZ2UtYnl0ZXM=',
				modelUsed: 'qwen-image-2.0-pro',
				prompt: 'draw',
				contentLength: 0,
				firstContentImage: '',
				secondContentText: '',
				size: '2688*1536',
				n: 1,
				watermark: false,
				promptExtend: false,
				postUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
				authHeader: 'Bearer key',
				asyncHeader: 'disable',
				imageDownloadCalls: 1,
				r2PutCalls: 0,
				firstR2PutDir: '',
				firstR2PutIsPublic: false,
				firstR2Key: '',
				errorMessage: ''
			}
		},
		{
			scenario: 'model option overrides env model',
			given: 'Aliyun env model and options model',
			when: 'generating with z-image-turbo',
			then: 'uses options model in DashScope request',
			givenDetail: {
				envModel: 'qwen-image-2.0-pro',
				optionsModel: 'z-image-turbo'
			},
			whenDetail: {
				input: {
					prompt: 'fast',
					aspectRatio: '1:1'
				}
			},
			thenExpected: {
				outputCount: 1,
				firstMimeType: 'image/png',
				firstImageBase64: 'aW1hZ2UtYnl0ZXM=',
				modelUsed: 'z-image-turbo',
				prompt: 'fast',
				contentLength: 0,
				firstContentImage: '',
				secondContentText: '',
				size: '1024*1024',
				n: 0,
				watermark: false,
				promptExtend: false,
				postUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
				authHeader: 'Bearer key',
				asyncHeader: 'disable',
				imageDownloadCalls: 1,
				r2PutCalls: 0,
				firstR2PutDir: '',
				firstR2PutIsPublic: false,
				firstR2Key: '',
				errorMessage: ''
			}
		},
		{
			scenario: 'qwen edit request uses inline references',
			given: 'qwen model and one reference',
			when: 'generating with reference image',
			then: 'sends DashScope multimodal message content',
			givenDetail: {
				envModel: 'qwen-image-2.0-pro'
			},
			whenDetail: {
				input: {
					prompt: 'edit',
					references: [{ imageBase64: 'cmVm', mimeType: 'image/png' }],
					imageSize: '1K',
					aspectRatio: '3:4'
				}
			},
			thenExpected: {
				outputCount: 1,
				firstMimeType: 'image/png',
				firstImageBase64: 'aW1hZ2UtYnl0ZXM=',
				modelUsed: 'qwen-image-2.0-pro',
				prompt: '',
				contentLength: 2,
				firstContentImage: 'data:image/png;base64,cmVm',
				secondContentText: 'edit',
				size: '960*1280',
				n: 0,
				watermark: false,
				promptExtend: false,
				postUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
				authHeader: 'Bearer key',
				asyncHeader: 'disable',
				imageDownloadCalls: 1,
				r2PutCalls: 0,
				firstR2PutDir: '',
				firstR2PutIsPublic: false,
				firstR2Key: '',
				errorMessage: ''
			}
		},
		{
			scenario: 'uploadToR2 uploads downloaded image',
			given: 'Aliyun output image and one r2 result',
			when: 'generating with uploadToR2',
			then: 'attaches r2 result to output',
			givenDetail: {
				envModel: 'qwen-image-2.0-pro',
				r2Results: [{ key: 'public/images/1.png', url: 'https://app/api/r2/public/images/1.png' }]
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
				firstImageBase64: 'aW1hZ2UtYnl0ZXM=',
				modelUsed: 'qwen-image-2.0-pro',
				prompt: 'upload',
				contentLength: 0,
				firstContentImage: '',
				secondContentText: '',
				size: '1024*1024',
				n: 0,
				watermark: false,
				promptExtend: false,
				postUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
				authHeader: 'Bearer key',
				asyncHeader: 'disable',
				imageDownloadCalls: 1,
				r2PutCalls: 1,
				firstR2PutDir: 'custom/images',
				firstR2PutIsPublic: true,
				firstR2Key: 'public/images/1.png',
				errorMessage: ''
			}
		},
		{
			scenario: 'z-image rejects references',
			given: 'z-image model',
			when: 'generating with reference image',
			then: 'throws unsupported reference error',
			givenDetail: {
				envModel: 'z-image-turbo'
			},
			whenDetail: {
				input: {
					prompt: 'bad',
					references: [{ imageBase64: 'cmVm', mimeType: 'image/png' }]
				}
			},
			thenExpected: {
				outputCount: 0,
				firstMimeType: '',
				firstImageBase64: '',
				modelUsed: '',
				prompt: '',
				contentLength: 0,
				firstContentImage: '',
				secondContentText: '',
				size: '',
				n: 0,
				watermark: false,
				promptExtend: false,
				postUrl: '',
				authHeader: '',
				asyncHeader: '',
				imageDownloadCalls: 0,
				r2PutCalls: 0,
				firstR2PutDir: '',
				firstR2PutIsPublic: false,
				firstR2Key: '',
				errorMessage: 'ALIYUN_Z_IMAGE_REFERENCES_UNSUPPORTED'
			}
		},
		{
			scenario: '4K size is rejected',
			given: 'qwen model',
			when: 'generating with 4K image size',
			then: 'throws unsupported size error',
			givenDetail: {
				envModel: 'qwen-image-2.0-pro'
			},
			whenDetail: {
				input: {
					prompt: 'bad size',
					imageSize: '4K'
				}
			},
			thenExpected: {
				outputCount: 0,
				firstMimeType: '',
				firstImageBase64: '',
				modelUsed: '',
				prompt: '',
				contentLength: 0,
				firstContentImage: '',
				secondContentText: '',
				size: '',
				n: 0,
				watermark: false,
				promptExtend: false,
				postUrl: '',
				authHeader: '',
				asyncHeader: '',
				imageDownloadCalls: 0,
				r2PutCalls: 0,
				firstR2PutDir: '',
				firstR2PutIsPublic: false,
				firstR2Key: '',
				errorMessage: 'UNSUPPORTED_ALIYUN_IMAGE_SIZE: 4K'
			}
		},
		{
			scenario: 'low censorship is rejected',
			given: 'qwen model',
			when: 'generating with lowCensorship true',
			then: 'throws unsupported low censorship error',
			givenDetail: {
				envModel: 'qwen-image-2.0-pro'
			},
			whenDetail: {
				input: {
					prompt: 'bad censorship',
					lowCensorship: true
				}
			},
			thenExpected: {
				outputCount: 0,
				firstMimeType: '',
				firstImageBase64: '',
				modelUsed: '',
				prompt: '',
				contentLength: 0,
				firstContentImage: '',
				secondContentText: '',
				size: '',
				n: 0,
				watermark: false,
				promptExtend: false,
				postUrl: '',
				authHeader: '',
				asyncHeader: '',
				imageDownloadCalls: 0,
				r2PutCalls: 0,
				firstR2PutDir: '',
				firstR2PutIsPublic: false,
				firstR2Key: '',
				errorMessage: 'ALIYUN_LOW_CENSORSHIP_UNSUPPORTED'
			}
		}
	]

	runCases(cases, async (given, when): Promise<ThenExpected> => {
		let r2Index = 0
		r2PutImageMock.mockImplementation(async (): Promise<R2PutResult> => {
			const result: R2PutResult | undefined = given.r2Results?.[r2Index]
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

		const client = newAliyunSimpleImageClient(createEnv(given.envModel), 'u', {} as TenantShardDb, {
			model: given.optionsModel
		})

		try {
			const outputs: AIImageResult[] = await client.generate(when.input)
			const request: AliyunRequest = JSON.parse(String(fetchCalls[0]?.init?.body))
			return toThenExpected(outputs, request, '')
		} catch (error) {
			return toThenExpected([], undefined, error instanceof Error ? error.message : String(error))
		}
	})

	function toThenExpected(
		outputs: AIImageResult[],
		request: AliyunRequest | undefined,
		errorMessage: string
	): ThenExpected {
		const content = request?.input?.messages?.[0]?.content ?? []
		return {
			outputCount: outputs.length,
			firstMimeType: outputs[0]?.mimeType ?? '',
			firstImageBase64: outputs[0]?.imageBase64 ?? '',
			modelUsed: request?.model ?? '',
			prompt: request?.input?.prompt ?? '',
			contentLength: content.length,
			firstContentImage: content[0]?.image ?? '',
			secondContentText: content[1]?.text ?? '',
			size: request?.parameters?.size ?? '',
			n: request?.parameters?.n ?? 0,
			watermark: request?.parameters?.watermark ?? false,
			promptExtend: request?.parameters?.prompt_extend ?? false,
			postUrl: fetchCalls[0]?.url ?? '',
			authHeader: toHeader(fetchCalls[0]?.init?.headers, 'Authorization'),
			asyncHeader: toHeader(fetchCalls[0]?.init?.headers, 'X-DashScope-Async'),
			imageDownloadCalls: Math.max(fetchCalls.length - 1, 0),
			r2PutCalls: r2PutImageMock.mock.calls.length,
			firstR2PutDir:
				(r2PutImageMock.mock.calls[0]?.[0] as { dir?: string } | undefined)?.dir ?? '',
			firstR2PutIsPublic:
				(r2PutImageMock.mock.calls[0]?.[0] as { isPublic?: boolean } | undefined)?.isPublic ??
				false,
			firstR2Key: outputs[0]?.r2?.key ?? '',
			errorMessage
		}
	}
})

describe('newAliyunNativeImageClient', () => {
	type GivenDetail = {
		apiKey: string
		baseURL: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		apiKey: string
		baseURL: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'creates native Aliyun image client with env config',
			given: 'Aliyun api key and base url',
			when: 'creating native client',
			then: 'returns fetch config',
			givenDetail: {
				apiKey: 'k1',
				baseURL: 'https://dashscope.aliyuncs.com/api/v1'
			},
			whenDetail: {},
			thenExpected: {
				apiKey: 'k1',
				baseURL: 'https://dashscope.aliyuncs.com/api/v1'
			}
		}
	]

	runCases(cases, (given): ThenExpected => {
		const client = newAliyunNativeImageClient(createEnv('qwen-image-2.0-pro', given.apiKey, given.baseURL))
		return {
			apiKey: client.apiKey,
			baseURL: client.baseURL
		}
	})
})

function toHeader(headers: HeadersInit | undefined, name: string): string {
	if (!headers) {
		return ''
	}

	const value: string | null = new Headers(headers).get(name)
	return value ?? ''
}

function createEnv(
	model: string,
	apiKey = 'key',
	baseURL = 'https://dashscope.aliyuncs.com/api/v1'
): Env {
	return {
		IMAGE_ALIYUN_API_KEY: apiKey,
		IMAGE_ALIYUN_BASE_URL: baseURL,
		IMAGE_ALIYUN_MODEL: model
	} as unknown as Env
}
