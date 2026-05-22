import type { Context } from 'hono'
import { z } from 'zod'
import type { ApiEnv } from '..'
import type { NewFeedback } from '../../db/schema.shard'
import { feedback } from '../../db/schema.shard'
import { PageRequestSchema, parseRequest } from '../../lib/request'

export const SubmitFeedbackRequestSchema = z.object({
	type: z.string().min(1),
	content: z.string().min(1)
})
export type SubmitFeedbackRequest = z.infer<typeof SubmitFeedbackRequestSchema>

export const ListFeedbacksRequestSchema = PageRequestSchema.extend({
	user_id: z.string().min(1).optional(),
	type: z.string().min(1).optional(),
	created_at_start: z.number().int().optional(),
	created_at_end: z.number().int().optional()
})
export type ListFeedbacksRequest = z.infer<typeof ListFeedbacksRequestSchema>

export interface ListFeedbacksResponseItem {
	id: string
	user_id: string
	type: string
	content: string
	created_at: number
}

export interface ListFeedbacksResponse {
	items: ListFeedbacksResponseItem[]
	total: number
}

export async function submitFeedbackHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parseRequest(ctx, SubmitFeedbackRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	const row: NewFeedback = {
		id: crypto.randomUUID(),
		userId: ctx.get('userId'),
		type: req.type,
		content: req.content,
		createdAt: Date.now()
	}

	await ctx.get('tenantDb').insert(feedback).values(row)
	return ctx.json({ id: row.id })
}

export async function listFeedbacksHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parseRequest(ctx, ListFeedbacksRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	return ctx.json({ code: 'FEEDBACK_FANOUT_NOT_IMPLEMENTED' }, 501)
}
