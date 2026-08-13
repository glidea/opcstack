import type { Context } from 'hono'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { ApiEnv } from '..'
import { createTenantShardAccess } from '../../db/shard-router'
import { getAdminAiTaskHandler, listAdminAiTasksHandler } from './admin-ai-tasks'

vi.mock('../../db/shard-router', () => {
	return {
		createTenantShardAccess: vi.fn()
	}
})

type MockTaskRow = {
	id: string
	userId: string
	status: string
	providerType: string
	providerId: string | null
	model: string | null
	attemptCount: number
	lastErrorMessage: string | null
	createdAt: number
	updatedAt: number
	completedAt: number | null
}

type MockImageTaskRow = MockTaskRow & {
	prompt: string
	numberOfImages: number | null
	aspectRatio: string | null
	imageSize: string | null
	lowCensorship: number
	uploadToR2: number
	r2UploadDir: string | null
	r2UploadIsPublic: number
	referencesJson: string
	resultJson: string | null
}

type MockTaskDb = {
	query: {
		aiImageTask: {
			findMany: ReturnType<typeof vi.fn>
			findFirst: ReturnType<typeof vi.fn>
		}
		aiTtsTask: {
			findMany: ReturnType<typeof vi.fn>
			findFirst: ReturnType<typeof vi.fn>
		}
		aiVideoTask: {
			findMany: ReturnType<typeof vi.fn>
			findFirst: ReturnType<typeof vi.fn>
		}
	}
}

describe('listAdminAiTasksHandler', () => {
	beforeEach((): void => {
		vi.clearAllMocks()
	})

	test('rejects invalid pagination', async (): Promise<void> => {
		mockShards([])
		const response: Response = await listAdminAiTasksHandler(createContext({ page_size: 0 }))
		const payload: { code?: string } = await response.json()

		expect({ status: response.status, code: payload.code }).toEqual({
			status: 400,
			code: 'INVALID_REQUEST'
		})
	})

	test('merges task types across tenant shards', async (): Promise<void> => {
		const image: MockImageTaskRow = createImageTask({
			id: 'image-1',
			createdAt: 100,
			updatedAt: 110
		})
		const tts: MockTaskRow = createTask({
			id: 'tts-1',
			createdAt: 300,
			updatedAt: 310
		})
		const video: MockTaskRow = createTask({
			id: 'video-1',
			providerType: 'video_seedance',
			createdAt: 200,
			updatedAt: 210
		})
		mockShards([
			{
				shardId: 'apac-0000',
				db: createTaskDb([image], [], [])
			},
			{
				shardId: 'weur-0000',
				db: createTaskDb([], [tts], [video])
			}
		])

		const response: Response = await listAdminAiTasksHandler(createContext({ page: 1, page_size: 2 }))
		const payload: { items: Array<Record<string, unknown>>; total: number } = await response.json()

		expect({ status: response.status, payload }).toEqual({
			status: 200,
			payload: {
				items: [
					{
						task_type: 'tts',
						id: 'tts-1',
						shard_id: 'weur-0000',
						user_id: 'user-1',
						status: 'completed',
						provider_type: 'tts_seed',
						provider_id: null,
						model: 'model-1',
						attempt_count: 1,
						last_error_message: null,
						created_at: 300,
						updated_at: 310,
						completed_at: 200
					},
					{
						task_type: 'video',
						id: 'video-1',
						shard_id: 'weur-0000',
						user_id: 'user-1',
						status: 'completed',
						provider_type: 'video_seedance',
						provider_id: null,
						model: 'model-1',
						attempt_count: 1,
						last_error_message: null,
						created_at: 200,
						updated_at: 210,
						completed_at: 200
					}
				],
				total: 3
			}
		})
	})
})

describe('getAdminAiTaskHandler', () => {
	beforeEach((): void => {
		vi.clearAllMocks()
	})

	test('returns all stored image task fields', async (): Promise<void> => {
		const image: MockImageTaskRow = createImageTask({ id: 'image-1' })
		mockShards([
			{
				shardId: 'apac-0000',
				db: createTaskDb([image], [], [], image)
			}
		])

		const response: Response = await getAdminAiTaskHandler(
			createContext({ task_type: 'image', id: 'image-1', shard_id: 'apac-0000' })
		)
		const payload: { task: Record<string, unknown> } = await response.json()

		expect({ status: response.status, task: payload.task }).toEqual({
			status: 200,
			task: {
				task_type: 'image',
				shard_id: 'apac-0000',
				id: 'image-1',
				user_id: 'user-1',
				status: 'completed',
				provider_type: 'image_openai',
				provider_id: null,
				model: 'gpt-image-1',
				attempt_count: 1,
				last_error_message: null,
				created_at: 100,
				updated_at: 200,
				completed_at: 200,
				prompt: 'A launch poster',
				number_of_images: 2,
				aspect_ratio: '16:9',
				image_size: '1536x1024',
				low_censorship: false,
				upload_to_r2: true,
				r2_upload_dir: 'public/generated',
				r2_upload_is_public: true,
				references_json: '["reference.png"]',
				result_json: '{"images":["public/generated/result.png"]}'
			}
		})
	})

	test('returns not found for a missing task', async (): Promise<void> => {
		mockShards([
			{
				shardId: 'apac-0000',
				db: createTaskDb([], [], [])
			}
		])

		const response: Response = await getAdminAiTaskHandler(
			createContext({ task_type: 'video', id: 'missing', shard_id: 'apac-0000' })
		)
		const payload: { code?: string } = await response.json()

		expect({ status: response.status, code: payload.code }).toEqual({
			status: 404,
			code: 'AI_TASK_NOT_FOUND'
		})
	})
})

function createTask(overrides: Partial<MockTaskRow> = {}): MockTaskRow {
	return {
		id: 'task-1',
		userId: 'user-1',
		status: 'completed',
		providerType: 'tts_seed',
		providerId: null,
		model: 'model-1',
		attemptCount: 1,
		lastErrorMessage: null,
		createdAt: 100,
		updatedAt: 200,
		completedAt: 200,
		...overrides
	}
}

function createImageTask(overrides: Partial<MockImageTaskRow> = {}): MockImageTaskRow {
	return {
		...createTask(),
		providerType: 'image_openai',
		model: 'gpt-image-1',
		prompt: 'A launch poster',
		numberOfImages: 2,
		aspectRatio: '16:9',
		imageSize: '1536x1024',
		lowCensorship: 0,
		uploadToR2: 1,
		r2UploadDir: 'public/generated',
		r2UploadIsPublic: 1,
		referencesJson: '["reference.png"]',
		resultJson: '{"images":["public/generated/result.png"]}',
		...overrides
	}
}

function createTaskDb(
	images: MockImageTaskRow[],
	tts: MockTaskRow[],
	videos: MockTaskRow[],
	imageDetail?: MockImageTaskRow
): MockTaskDb {
	return {
		query: {
			aiImageTask: {
				findMany: vi.fn().mockResolvedValue(images),
				findFirst: vi.fn().mockResolvedValue(imageDetail)
			},
			aiTtsTask: {
				findMany: vi.fn().mockResolvedValue(tts),
				findFirst: vi.fn().mockResolvedValue(undefined)
			},
			aiVideoTask: {
				findMany: vi.fn().mockResolvedValue(videos),
				findFirst: vi.fn().mockResolvedValue(undefined)
			}
		}
	}
}

function mockShards(shards: Array<{ shardId: string; db: MockTaskDb }>): void {
	vi.mocked(createTenantShardAccess).mockReturnValue({
		listShardDbs: async () => {
			return shards.map((shard: { shardId: string; db: MockTaskDb }) => {
				return {
					shardId: shard.shardId,
					bindingName: 'TENANT_DB',
					db: shard.db
				}
			})
		}
	} as unknown as ReturnType<typeof createTenantShardAccess>)
}

function createContext(body: unknown): Context<ApiEnv> {
	const context = {
		env: {},
		req: {
			json: async <T>(): Promise<T> => {
				return body as T
			}
		},
		get: (): unknown => {
			return {}
		},
		json: (payload: unknown, status?: number): Response => {
			return new Response(JSON.stringify(payload), {
				status: status ?? 200,
				headers: { 'content-type': 'application/json' }
			})
		}
	}
	return context as unknown as Context<ApiEnv>
}
