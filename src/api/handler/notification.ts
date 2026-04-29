import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm'
import type { Context } from 'hono'
import { z } from 'zod'
import type { ApiEnv } from '..'
import type { NewNotification, NewNotificationRead } from '../../db/schema'
import { notification, notificationRead } from '../../db/schema'
import { parse } from './utils'

export const CreateNotificationRequestSchema = z.object({
	type: z.string().min(1).optional().default('system'),
	title: z.string().min(1),
	content: z.string().min(1),
	target_user_id: z.string().min(1).nullable().optional()
})
export type CreateNotificationRequest = z.infer<typeof CreateNotificationRequestSchema>

export const ListNotificationsRequestSchema = z.object({
	limit: z.number().int().min(1).max(100).optional(),
	offset: z.number().int().min(0).optional()
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
	notifications: ListNotificationsResponseItem[]
}

export async function createNotificationHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parse(ctx, CreateNotificationRequestSchema)
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
	const req = await parse(ctx, ListNotificationsRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	const userId = ctx.get('userId')
	const rows = await ctx.get('db').query.notification.findMany({
		where: or(isNull(notification.targetUserId), eq(notification.targetUserId, userId)),
		orderBy: [desc(notification.createdAt)],
		limit: req.limit ?? 50,
		offset: req.offset ?? 0
	})

	if (rows.length === 0) {
		return ctx.json({ notifications: [] } as ListNotificationsResponse)
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
		notifications: rows.map((row) => {
			return {
				id: row.id,
				type: row.type,
				title: row.title,
				content: row.content,
				read: readIds.has(row.id),
				created_at: row.createdAt
			}
		})
	} as ListNotificationsResponse)
}

export async function readNotificationHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parse(ctx, ReadNotificationRequestSchema)
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
