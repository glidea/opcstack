import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../../testing/bdd'
import {
	createSeedDanceProviderTask,
	getSeedDanceProviderTask,
	createSeedDanceSimpleVideoClient
} from '.'
import {
	SEEDDANCE_MODEL_SEEDDANCE_2_0_260128,
	SEEDDANCE_MODEL_SEEDDANCE_2_0_FAST_260128
} from '..'
import type { TenantShardDb } from '../../../db'

type FetchCall = {
	url: string
	init?: RequestInit
}

describe('seedance video client', () => {
	const fetchCalls: FetchCall[] = []
	const updateSetMock = vi.fn()

	beforeEach((): void => {
		fetchCalls.length = 0
		updateSetMock.mockReset()
		vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			const url: string = String(input)
			fetchCalls.push({ url, init })

			if (url.endsWith('/contents/generations/tasks')) {
				return Response.json({ id: 'remote-1' })
			}
			if (url.endsWith('/contents/generations/tasks/remote-1')) {
				return Response.json({
					status: 'succeeded',
					content: {
						video_url: 'https://provider/video.mp4'
					}
				})
			}
			return new Response('video-bytes', {
				headers: {
					'content-type': 'video/mp4'
				}
			})
		})
	})

	type CreateGiven = Record<string, never>
	type CreateWhen = Record<string, never>
	type CreateThen = {
		providerTaskId: string
		requestUrl: string
		authorization: string
		model: string
		ratio: string
		generateAudio: boolean
		watermark: boolean
		content: Array<{ type: string; text?: string }>
	}
	const createCases: TestCase<CreateGiven, CreateWhen, CreateThen>[] = [
		{
			scenario: 'SeedDance provider task creation',
			given: 'text prompt video input',
			when: 'submitting provider task',
			then: 'returns provider task id and sends SeedDance request body',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				providerTaskId: 'remote-1',
				requestUrl: 'https://channel.example/api/v3/contents/generations/tasks',
				authorization: 'Bearer channel-key',
				model: 'doubao-seedance-2-0-fast-260128',
				ratio: 'adaptive',
				generateAudio: true,
				watermark: false,
				content: [{ type: 'text', text: 'make a video' }]
			}
		}
	]
	runCases(createCases, async (): Promise<CreateThen> => {
		const providerTaskId: string = await createSeedDanceProviderTask(
			createEnv(),
			'u1',
			'doubao-seedance-2-0-fast-260128',
			{
				prompt: 'make a video',
				duration: 5
			},
			{ baseURL: 'https://channel.example/api/v3', apiKey: 'channel-key' }
		)
		const requestHeaders = new Headers(fetchCalls[0]?.init?.headers)
		const requestBody: {
			model: string
			ratio: string
			generate_audio: boolean
			watermark: boolean
			content: Array<{ type: string; text?: string }>
		} = JSON.parse(String(fetchCalls[0]?.init?.body))
		return {
			providerTaskId,
			requestUrl: fetchCalls[0]?.url ?? '',
			authorization: requestHeaders.get('authorization') ?? '',
			model: requestBody.model,
			ratio: requestBody.ratio,
			generateAudio: requestBody.generate_audio,
			watermark: requestBody.watermark,
			content: requestBody.content
		}
	})

	type GetGiven = Record<string, never>
	type GetWhen = Record<string, never>
	type GetThen = {
		status: string
		videoUrl: string
		requestUrl: string
		authorization: string
	}
	const getCases: TestCase<GetGiven, GetWhen, GetThen>[] = [
		{
			scenario: 'SeedDance provider task polling',
			given: 'succeeded provider task',
			when: 'getting provider task',
			then: 'returns completed video url',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				status: 'completed',
				videoUrl: 'https://provider/video.mp4',
				requestUrl: 'https://channel.example/api/v3/contents/generations/tasks/remote-1',
				authorization: 'Bearer channel-key'
			}
		}
	]
	runCases(getCases, async (): Promise<GetThen> => {
		const result = await getSeedDanceProviderTask('remote-1', {
			baseURL: 'https://channel.example/api/v3',
			apiKey: 'channel-key'
		})
		const requestHeaders = new Headers(fetchCalls[0]?.init?.headers)
		return {
			status: result.status,
			videoUrl: result.status === 'completed' ? result.videoUrl : '',
			requestUrl: fetchCalls[0]?.url ?? '',
			authorization: requestHeaders.get('authorization') ?? ''
		}
	})

	type GenerateGiven = Record<string, never>
	type GenerateWhen = Record<string, never>
	type GenerateThen = {
		status: string
		provider: string
		sendCalls: number
	}
	const generateCases: TestCase<GenerateGiven, GenerateWhen, GenerateThen>[] = [
		{
			scenario: 'SeedDance simple video client',
			given: 'video generation input',
			when: 'generating local async task',
			then: 'creates processing SeedDance task and sends queue message',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				status: 'processing',
				provider: 'seedance',
				sendCalls: 1
			}
		}
	]
	runCases(generateCases, async (): Promise<GenerateThen> => {
		const sendMock = vi.fn()
		const env = {
			...createEnv(),
			Q_VIDEO_GENERATE: {
				send: sendMock
			}
		} as unknown as Env
		const client = createSeedDanceSimpleVideoClient(env, 'u1', createDb(updateSetMock), {
			model: 'doubao-seedance-2-0-fast-260128'
		})

		const task = await client.generate({
			prompt: 'make a video',
			duration: 5
		})
		return {
			status: task.status,
			provider: task.provider,
			sendCalls: sendMock.mock.calls.length
		}
	})

	type ModelGiven = Record<string, never>
	type ModelWhen = Record<string, never>
	type ModelThen = {
		fastModel: string
		standardModel: string
	}
	const modelCases: TestCase<ModelGiven, ModelWhen, ModelThen>[] = [
		{
			scenario: 'SeedDance model exports',
			given: 'common SeedDance model ids',
			when: 'reading exported constants',
			then: 'returns known model ids',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				fastModel: 'doubao-seedance-2-0-fast-260128',
				standardModel: 'doubao-seedance-2-0-260128'
			}
		}
	]
	runCases(modelCases, (): ModelThen => {
		return {
			fastModel: SEEDDANCE_MODEL_SEEDDANCE_2_0_FAST_260128,
			standardModel: SEEDDANCE_MODEL_SEEDDANCE_2_0_260128
		}
	})
})

function createEnv(): Env {
	return {
		APP_BASE_URL: 'https://app',
		R2_ORIGIN_SIGNING_SECRET: 'secret'
	} as unknown as Env
}

function createDb(updateSet: (value: unknown) => void): TenantShardDb {
	return {
		insert: () => ({
			values: async (): Promise<void> => {}
		}),
		update: () => ({
			set: (value: unknown) => {
				updateSet(value)
				return {
					where: async (): Promise<void> => {}
				}
			}
		})
	} as unknown as TenantShardDb
}
