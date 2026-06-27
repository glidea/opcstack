import { z } from 'zod'
import { PageRequestSchema, type PageResponse } from './common'

export const SubmitFeedbackRequestSchema = z.object({
	type: z.string().min(1),
	content: z.string().min(1)
})
export type SubmitFeedbackRequest = z.infer<typeof SubmitFeedbackRequestSchema>

export type SubmitFeedbackResponse = {
	id: string
}

export const ListFeedbacksRequestSchema = PageRequestSchema.extend({
	user_id: z.string().min(1).optional(),
	type: z.string().min(1).optional(),
	created_at_start: z.number().int().optional(),
	created_at_end: z.number().int().optional()
})
export type ListFeedbacksRequest = z.infer<typeof ListFeedbacksRequestSchema>

export type ListFeedbacksResponseItem = {
	id: string
	user_id: string
	type: string
	content: string
	created_at: number
}

export type ListFeedbacksResponse = PageResponse<ListFeedbacksResponseItem>
