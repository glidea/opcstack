import { z } from 'zod'
import { PageRequestSchema, type ApiErrorResult } from './common'

export const AITaskTypeSchema = z.enum(['image', 'tts', 'video'])
export type AITaskType = z.infer<typeof AITaskTypeSchema>

export const ListAITasksRequestSchema = PageRequestSchema.extend({
	task_type: AITaskTypeSchema.optional(),
	id: z.string().min(1).optional(),
	user_id: z.string().min(1).optional(),
	status: z.string().min(1).optional(),
	provider_type: z.string().min(1).optional(),
	provider_id: z.string().min(1).optional(),
	model: z.string().min(1).optional(),
	created_at_start: z.number().int().optional(),
	created_at_end: z.number().int().optional()
})
export type ListAITasksRequest = z.infer<typeof ListAITasksRequestSchema>

export const AITaskSummarySchema = z.object({
	task_type: AITaskTypeSchema,
	shard_id: z.string(),
	id: z.string(),
	user_id: z.string(),
	status: z.string(),
	provider_type: z.string(),
	provider_id: z.string().nullable(),
	model: z.string().nullable(),
	attempt_count: z.number(),
	last_error_message: z.string().nullable(),
	created_at: z.number(),
	updated_at: z.number(),
	completed_at: z.number().nullable()
})
export type AITaskSummary = z.infer<typeof AITaskSummarySchema>

export const ListAITasksResponseSchema = z.object({
	items: z.array(AITaskSummarySchema),
	total: z.number()
})
export type ListAITasksResponse = z.infer<typeof ListAITasksResponseSchema>

export const GetAITaskRequestSchema = z.object({
	task_type: AITaskTypeSchema,
	shard_id: z.string().min(1),
	id: z.string().min(1)
})
export type GetAITaskRequest = z.infer<typeof GetAITaskRequestSchema>

export const AIImageTaskSchema = AITaskSummarySchema.extend({
	task_type: z.literal('image'),
	prompt: z.string(),
	number_of_images: z.number().nullable(),
	aspect_ratio: z.string().nullable(),
	image_size: z.string().nullable(),
	low_censorship: z.boolean(),
	upload_to_r2: z.boolean(),
	r2_upload_dir: z.string().nullable(),
	r2_upload_is_public: z.boolean(),
	references_json: z.string(),
	result_json: z.string().nullable()
})
export type AIImageTask = z.infer<typeof AIImageTaskSchema>

export const AITTSTaskSchema = AITaskSummarySchema.extend({
	task_type: z.literal('tts'),
	source_json: z.string().nullable(),
	instruction: z.string().nullable(),
	speakers_json: z.string(),
	lines_json: z.string(),
	upload_to_r2: z.boolean(),
	result_json: z.string().nullable()
})
export type AITTSTask = z.infer<typeof AITTSTaskSchema>

export const AIVideoTaskSchema = AITaskSummarySchema.extend({
	task_type: z.literal('video'),
	prompt: z.string(),
	ratio: z.string().nullable(),
	resolution: z.string().nullable(),
	duration: z.number(),
	r2_upload_dir: z.string().nullable(),
	r2_upload_is_public: z.boolean(),
	references_json: z.string(),
	provider_task_id: z.string().nullable(),
	result_json: z.string().nullable()
})
export type AIVideoTask = z.infer<typeof AIVideoTaskSchema>

export const AITaskSchema = z.discriminatedUnion('task_type', [
	AIImageTaskSchema,
	AITTSTaskSchema,
	AIVideoTaskSchema
])
export type AITask = z.infer<typeof AITaskSchema>

export const GetAITaskResponseSchema = z.object({
	task: AITaskSchema
})
export type GetAITaskResponse = z.infer<typeof GetAITaskResponseSchema>

export const ListAITasksApi = {
	request: ListAITasksRequestSchema,
	response: ListAITasksResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
			return {
				status: 400,
				body: { code: 'INVALID_REQUEST', message }
			}
		}
	}
}

export const GetAITaskApi = {
	request: GetAITaskRequestSchema,
	response: GetAITaskResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
			return {
				status: 400,
				body: { code: 'INVALID_REQUEST', message }
			}
		},
		AI_TASK_NOT_FOUND(): ApiErrorResult<'AI_TASK_NOT_FOUND', 404> {
			return {
				status: 404,
				body: { code: 'AI_TASK_NOT_FOUND', message: 'AI task not found' }
			}
		}
	}
}
