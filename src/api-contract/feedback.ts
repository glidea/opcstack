import { z } from 'zod'
import { PageRequestSchema, type ApiErrorResult } from './common'

export const SubmitFeedbackRequestSchema = z.object({
	type: z.string().min(1),
	content: z.string().min(1)
})
export type SubmitFeedbackRequest = z.infer<typeof SubmitFeedbackRequestSchema>

export const SubmitFeedbackResponseSchema = z.object({
	id: z.string()
})
export type SubmitFeedbackResponse = z.infer<typeof SubmitFeedbackResponseSchema>

export const ListFeedbacksRequestSchema = PageRequestSchema.extend({
	user_id: z.string().min(1).optional(),
	type: z.string().min(1).optional(),
	created_at_start: z.number().int().optional(),
	created_at_end: z.number().int().optional()
})
export type ListFeedbacksRequest = z.infer<typeof ListFeedbacksRequestSchema>

export const ListFeedbacksResponseItemSchema = z.object({
	id: z.string(),
	user_id: z.string(),
	type: z.string(),
	content: z.string(),
	created_at: z.number()
})
export type ListFeedbacksResponseItem = z.infer<typeof ListFeedbacksResponseItemSchema>

export const ListFeedbacksResponseSchema = z.object({
	items: z.array(ListFeedbacksResponseItemSchema),
	total: z.number()
})
export type ListFeedbacksResponse = z.infer<typeof ListFeedbacksResponseSchema>

export const SubmitFeedbackApi = {
	request: SubmitFeedbackRequestSchema,
	response: SubmitFeedbackResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
			return {
				status: 400,
				body: {
					code: 'INVALID_REQUEST',
					message
				}
			}
		}
	}
}

export const ListFeedbacksApi = {
	request: ListFeedbacksRequestSchema,
	response: ListFeedbacksResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
			return {
				status: 400,
				body: {
					code: 'INVALID_REQUEST',
					message
				}
			}
		}
	}
}
