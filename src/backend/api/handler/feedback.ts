import { and, desc, eq, gte, lte, type SQL } from 'drizzle-orm'
import type { Context } from 'hono'
import type { ApiEnv } from '..'
import {
	ListFeedbacksApi,
	type ListFeedbacksResponse,
	type ListFeedbacksResponseItem,
	SubmitFeedbackApi
} from '../../../api-contract/feedback'
import { createTenantShardAccess } from '../../db/shard-router'
import type { Feedback, NewFeedback } from '../../db/schema.shard'
import { feedback } from '../../db/schema.shard'
import { parseRequest } from '../../lib/request'

export async function submitFeedbackHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, SubmitFeedbackApi.request)
	if (!request.success) {
		const error = SubmitFeedbackApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	const req = request.data

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
	const request = await parseRequest(ctx, ListFeedbacksApi.request)
	if (!request.success) {
		const error = ListFeedbacksApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	const req = request.data

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

	const where: SQL | undefined = conditions.length > 0 ? and(...conditions) : undefined
	const shards = await createTenantShardAccess(ctx.get('metaDb'), ctx.env).listShardDbs()
	const rows: Feedback[] = []
	for (const shard of shards) {
		const shardRows: Feedback[] = await shard.db.query.feedback.findMany({
			where,
			orderBy: [desc(feedback.createdAt)]
		})
		rows.push(...shardRows)
	}

	rows.sort((left: Feedback, right: Feedback): number => {
		return right.createdAt - left.createdAt
	})

	const offset: number = (req.page - 1) * req.page_size
	const items: ListFeedbacksResponseItem[] = rows
		.slice(offset, offset + req.page_size)
		.map(toListFeedbacksResponseItem)
	return ctx.json({
		items,
		total: rows.length
	} as ListFeedbacksResponse)
}

function toListFeedbacksResponseItem(row: Feedback): ListFeedbacksResponseItem {
	return {
		id: row.id,
		user_id: row.userId,
		type: row.type,
		content: row.content,
		created_at: row.createdAt
	}
}
