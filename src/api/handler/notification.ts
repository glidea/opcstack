import { and, desc, eq, gte, inArray, isNull, lte, or, sql, type SQL } from 'drizzle-orm'
import type { Context } from 'hono'
import { z } from 'zod'
import type { ApiEnv } from '..'
import type { NewNotification, NewNotificationRead } from '../../db/schema'
import { notification, notificationRead } from '../../db/schema'
import { PageRequestSchema, parseRequest } from '../../lib/request'

export const CreateNotificationRequestSchema = z.object({
	type: z.string().min(1).optional().default('system'),
	title: z.string().min(1),
	content: z.string().min(1),
	target_user_id: z.string().min(1).nullable().optional()
})
export type CreateNotificationRequest = z.infer<typeof CreateNotificationRequestSchema>

export const ListNotificationsRequestSchema = PageRequestSchema.extend({
	type: z.string().min(1).optional(),
	read: z.boolean().optional(),
	created_at_start: z.number().int().optional(),
	created_at_end: z.number().int().optional()
})
export type ListNotificationsRequest = z.infer<typeof ListNotificationsRequestSchema>

export const ReadNotificationRequestSchema = z.object({
	id: z.string().min(1)
})
export type ReadNotificationRequest = z.infer<typeof ReadNotificationRequestSchema>

export interface ListNotificationsResponseItem {
	id: string
	type: string
	title: string
	content: string
	read: boolean
	created_at: number
}

export interface ListNotificationsResponse {
	items: ListNotificationsResponseItem[]
	total: number
}

export async function createNotificationHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parseRequest(ctx, CreateNotificationRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	const row: NewNotification = {
		id: crypto.randomUUID(),
		type: req.type,
		title: req.title,
		content: req.content,
		targetUserId: req.target_user_id ?? null,
		createdAt: Date.now()
	}

	await ctx.get('db').insert(notification).values(row)
	return ctx.json({ id: row.id })
}

export async function listNotificationsHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parseRequest(ctx, ListNotificationsRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	const userId = ctx.get('userId')
	const visibleWhere = or(isNull(notification.targetUserId), eq(notification.targetUserId, userId))
	const conditions: SQL[] = []
	if (visibleWhere) {
		conditions.push(visibleWhere)
	}
	if (req.type) {
		conditions.push(eq(notification.type, req.type))
	}
	if (req.created_at_start !== undefined) {
		conditions.push(gte(notification.createdAt, req.created_at_start))
	}
	if (req.created_at_end !== undefined) {
		conditions.push(lte(notification.createdAt, req.created_at_end))
	}
	if (req.read === true) {
		conditions.push(sql`exists (
			select 1 from ${notificationRead}
			where ${notificationRead.notificationId} = ${notification.id}
				and ${notificationRead.userId} = ${userId}
		)`)
	}
	if (req.read === false) {
		conditions.push(sql`not exists (
			select 1 from ${notificationRead}
			where ${notificationRead.notificationId} = ${notification.id}
				and ${notificationRead.userId} = ${userId}
		)`)
	}

	const db = ctx.get('db')
	const where = conditions.length > 0 ? and(...conditions) : undefined
	const offset = (req.page - 1) * req.page_size
	const totalRows = await db
		.select({ total: sql<number>`count(*)` })
		.from(notification)
		.where(where)
	const rows = await db.query.notification.findMany({
		where,
		orderBy: [desc(notification.createdAt)],
		limit: req.page_size,
		offset
	})

	if (rows.length === 0) {
		return ctx.json({ items: [], total: Number(totalRows[0]?.total ?? 0) } as ListNotificationsResponse)
	}

	const ids = rows.map((row) => {
		return row.id
	})
	const readRows = await ctx.get('db').query.notificationRead.findMany({
		columns: {
			notificationId: true
		},
		where: and(eq(notificationRead.userId, userId), inArray(notificationRead.notificationId, ids))
	})
	const readIds = new Set(
		readRows.map((row) => {
			return row.notificationId
		})
	)

	return ctx.json({
		items: rows.map((row) => {
			return {
				id: row.id,
				type: row.type,
				title: row.title,
				content: row.content,
				read: readIds.has(row.id),
				created_at: row.createdAt
			}
		}),
		total: Number(totalRows[0]?.total ?? 0)
	} as ListNotificationsResponse)
}

export async function readNotificationHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parseRequest(ctx, ReadNotificationRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	const row: NewNotificationRead = {
		notificationId: req.id,
		userId: ctx.get('userId'),
		readAt: Date.now()
	}

	await ctx.get('db').insert(notificationRead).values(row).onConflictDoNothing()
	return ctx.json({})
}
