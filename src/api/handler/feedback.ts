import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm'
import type { Context } from 'hono'
import { z } from 'zod'
import type { ApiEnv } from '..'
import type { NewFeedback } from '../../db/schema'
import { feedback } from '../../db/schema'
import { PageRequestSchema, parse } from './utils'

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

	const conditions: SQL[] = []
	if (req.user_id) {
		conditions.push(eq(feedback.userId, req.user_id))
	}
	if (req.type) {
		conditions.push(eq(feedback.type, req.type))
	}
	if (req.created_at_start !== undefined) {
		conditions.push(gte(feedback.createdAt, req.created_at_start))
	}
	if (req.created_at_end !== undefined) {
		conditions.push(lte(feedback.createdAt, req.created_at_end))
	}

	const db = ctx.get('db')
	const where = conditions.length > 0 ? and(...conditions) : undefined
	const offset = (req.page - 1) * req.page_size
	const totalRows = await db
		.select({ total: sql<number>`count(*)` })
		.from(feedback)
		.where(where)
	const rows = await db.query.feedback.findMany({
		where,
		orderBy: [desc(feedback.createdAt)],
		limit: req.page_size,
		offset
	})

	return ctx.json({
		items: rows.map((row) => {
			return {
				id: row.id,
				user_id: row.userId,
				type: row.type,
				content: row.content,
				created_at: row.createdAt
			}
		}),
		total: Number(totalRows[0]?.total ?? 0)
	} as ListFeedbacksResponse)
}
