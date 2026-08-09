import { z } from 'zod'
import { PageRequestSchema, type ApiErrorResult } from './common'

export const AdminAiTaskTypeSchema = z.enum(['image', 'tts', 'video'])
export type AdminAiTaskType = z.infer<typeof AdminAiTaskTypeSchema>

export const ListAdminAiTasksRequestSchema = PageRequestSchema.extend({
	task_type: AdminAiTaskTypeSchema.optional(),
	id: z.string().min(1).optional(),
	user_id: z.string().min(1).optional(),
	status: z.string().min(1).optional(),
	provider: z.string().min(1).optional(),
	model: z.string().min(1).optional(),
	created_at_start: z.number().int().optional(),
	created_at_end: z.number().int().optional()
})
export type ListAdminAiTasksRequest = z.infer<typeof ListAdminAiTasksRequestSchema>

export const AdminAiTaskSummarySchema = z.object({
	task_type: AdminAiTaskTypeSchema,
	shard_id: z.string(),
	id: z.string(),
	user_id: z.string(),
	status: z.string(),
	provider: z.string(),
	model: z.string().nullable(),
	attempt_count: z.number(),
	last_error_message: z.string().nullable(),
	created_at: z.number(),
	updated_at: z.number(),
	completed_at: z.number().nullable()
})
export type AdminAiTaskSummary = z.infer<typeof AdminAiTaskSummarySchema>

export const ListAdminAiTasksResponseSchema = z.object({
	items: z.array(AdminAiTaskSummarySchema),
	total: z.number()
})
export type ListAdminAiTasksResponse = z.infer<typeof ListAdminAiTasksResponseSchema>

export const GetAdminAiTaskRequestSchema = z.object({
	task_type: AdminAiTaskTypeSchema,
	shard_id: z.string().min(1),
	id: z.string().min(1)
})
export type GetAdminAiTaskRequest = z.infer<typeof GetAdminAiTaskRequestSchema>

export const AdminAiImageTaskSchema = AdminAiTaskSummarySchema.extend({
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
export type AdminAiImageTask = z.infer<typeof AdminAiImageTaskSchema>

export const AdminAiTtsTaskSchema = AdminAiTaskSummarySchema.extend({
	task_type: z.literal('tts'),
	source_json: z.string().nullable(),
	instruction: z.string().nullable(),
	speakers_json: z.string(),
	lines_json: z.string(),
	upload_to_r2: z.boolean(),
	result_json: z.string().nullable()
})
export type AdminAiTtsTask = z.infer<typeof AdminAiTtsTaskSchema>

export const AdminAiVideoTaskSchema = AdminAiTaskSummarySchema.extend({
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
export type AdminAiVideoTask = z.infer<typeof AdminAiVideoTaskSchema>

export const AdminAiTaskSchema = z.discriminatedUnion('task_type', [
	AdminAiImageTaskSchema,
	AdminAiTtsTaskSchema,
	AdminAiVideoTaskSchema
])
export type AdminAiTask = z.infer<typeof AdminAiTaskSchema>

export const GetAdminAiTaskResponseSchema = z.object({
	task: AdminAiTaskSchema
})
export type GetAdminAiTaskResponse = z.infer<typeof GetAdminAiTaskResponseSchema>

export const ListAdminAiTasksApi = {
	request: ListAdminAiTasksRequestSchema,
	response: ListAdminAiTasksResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
			return {
				status: 400,
				body: { code: 'INVALID_REQUEST', message }
			}
		}
	}
}

export const GetAdminAiTaskApi = {
	request: GetAdminAiTaskRequestSchema,
	response: GetAdminAiTaskResponseSchema,
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
