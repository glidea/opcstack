import { desc } from 'drizzle-orm'
import type { Context } from 'hono'
import { z } from 'zod'
import type { ApiEnv } from '..'
import type { NewFeedback } from '../../db/schema'
import { feedback } from '../../db/schema'
import { parse } from './utils'

export const SubmitFeedbackRequestSchema = z.object({
	type: z.string().min(1),
	content: z.string().min(1)
})
export type SubmitFeedbackRequest = z.infer<typeof SubmitFeedbackRequestSchema>

export const ListFeedbacksRequestSchema = z.object({
	limit: z.number().int().min(1).max(100).optional(),
	offset: z.number().int().min(0).optional()
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
	feedbacks: ListFeedbacksResponseItem[]
}

export async function submitFeedbackHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parse(ctx, SubmitFeedbackRequestSchema)
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

	await ctx.get('db').insert(feedback).values(row)
	return ctx.json({ id: row.id })
}

export async function listFeedbacksHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parse(ctx, ListFeedbacksRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	const rows = await ctx.get('db').query.feedback.findMany({
		orderBy: [desc(feedback.createdAt)],
		limit: req.limit ?? 50,
		offset: req.offset ?? 0
	})

	return ctx.json({
		feedbacks: rows.map((row) => {
			return {
				id: row.id,
				user_id: row.userId,
				type: row.type,
				content: row.content,
				created_at: row.createdAt
			}
		})
	} as ListFeedbacksResponse)
}
