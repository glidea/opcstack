import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, or, sql, type SQL } from 'drizzle-orm'
import type { Context } from 'hono'
import type { ApiEnv } from '..'
import {
	ArchiveNotificationApi,
	CreateNotificationApi,
	ListAdminNotificationsApi,
	type ListAdminNotificationsResponse,
	type ListAdminNotificationsResponseItem,
	ListNotificationsApi,
	type ListNotificationsResponse,
	type ListNotificationsResponseItem,
	ReadNotificationApi,
	UpdateNotificationApi,
	type UpdateNotificationResponse
} from '../../../api-contract/notifications'
import type { NewNotification, Notification } from '../../db/schema'
import { notification } from '../../db/schema'
import type { NewNotificationRead } from '../../db/schema.shard'
import { notificationRead } from '../../db/schema.shard'
import { parseRequest } from '../../lib/request'

export async function createNotificationHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, CreateNotificationApi.request)
	if (!request.success) {
		const error = CreateNotificationApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	const req = request.data

	const row: NewNotification = {
		id: crypto.randomUUID(),
		type: req.type,
		title: req.title,
		content: req.content,
		targetUserId: req.target_user_id ?? null,
		createdAt: Date.now()
	}

	await ctx.get('metaDb').insert(notification).values(row)
	return ctx.json({ id: row.id })
}

function toAdminNotificationItem(row: Notification): ListAdminNotificationsResponseItem {
	return {
		id: row.id,
		type: row.type,
		title: row.title,
		content: row.content,
		target_user_id: row.targetUserId,
		created_at: row.createdAt,
		archived_at: row.archivedAt
	}
}

export async function updateNotificationHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, UpdateNotificationApi.request)
	if (!request.success) {
		const error = UpdateNotificationApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	const req = request.data
	const rows: Notification[] = await ctx.get('metaDb')
		.update(notification)
		.set({
			type: req.type,
			title: req.title,
			content: req.content,
			targetUserId: req.target_user_id
		})
		.where(and(eq(notification.id, req.id), isNull(notification.archivedAt)))
		.returning()
	const row: Notification | undefined = rows[0]
	if (!row) {
		const error = UpdateNotificationApi.errors.NOT_FOUND()
		return ctx.json(error.body, error.status)
	}
	return ctx.json(toAdminNotificationItem(row) as UpdateNotificationResponse)
}

export async function archiveNotificationHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, ArchiveNotificationApi.request)
	if (!request.success) {
		const error = ArchiveNotificationApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	const rows: Notification[] = await ctx.get('metaDb')
		.update(notification)
		.set({ archivedAt: Date.now() })
		.where(and(eq(notification.id, request.data.id), isNull(notification.archivedAt)))
		.returning()
	const row: Notification | undefined = rows[0]
	if (!row) {
		const error = ArchiveNotificationApi.errors.NOT_FOUND()
		return ctx.json(error.body, error.status)
	}
	return ctx.json(toAdminNotificationItem(row))
}

export async function listAdminNotificationsHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, ListAdminNotificationsApi.request)
	if (!request.success) {
		const error = ListAdminNotificationsApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	const req = request.data
	const conditions: SQL[] = []
	if (req.id) {
		conditions.push(eq(notification.id, req.id))
	}
	if (req.target_user_id) {
		conditions.push(eq(notification.targetUserId, req.target_user_id))
	}
	if (req.type) {
		conditions.push(eq(notification.type, req.type))
	}
	if (req.scope === 'global') {
		conditions.push(isNull(notification.targetUserId))
	}
	if (req.scope === 'user') {
		conditions.push(isNotNull(notification.targetUserId))
	}
	if (req.created_at_start !== undefined) {
		conditions.push(gte(notification.createdAt, req.created_at_start))
	}
	if (req.created_at_end !== undefined) {
		conditions.push(lte(notification.createdAt, req.created_at_end))
	}

	const where: SQL | undefined = conditions.length > 0 ? and(...conditions) : undefined
	const db = ctx.get('metaDb')
	const totalRows: Array<{ total: number }> = await db
		.select({ total: sql<number>`count(*)` })
		.from(notification)
		.where(where)
	const rows = await db.query.notification.findMany({
		where,
		orderBy: [desc(notification.createdAt)],
		limit: req.page_size,
		offset: (req.page - 1) * req.page_size
	})
	const items: ListAdminNotificationsResponseItem[] = rows.map(toAdminNotificationItem)
	return ctx.json({
		items,
		total: Number(totalRows[0]?.total ?? 0)
	} as ListAdminNotificationsResponse)
}

export async function listNotificationsHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, ListNotificationsApi.request)
	if (!request.success) {
		const error = ListNotificationsApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	const req = request.data

	const userId = ctx.get('userId')
	const visibleWhere = or(isNull(notification.targetUserId), eq(notification.targetUserId, userId))
	const conditions: SQL[] = [isNull(notification.archivedAt)]
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

	const db = ctx.get('metaDb')
	const where = conditions.length > 0 ? and(...conditions) : undefined
	const totalRows = await db
		.select({ total: sql<number>`count(*)` })
		.from(notification)
		.where(where)
	const offset = (req.page - 1) * req.page_size
	const rows =
		req.read === undefined
			? await db.query.notification.findMany({
					where,
					orderBy: [desc(notification.createdAt)],
					limit: req.page_size,
					offset
				})
			: await db.query.notification.findMany({
					where,
					orderBy: [desc(notification.createdAt)]
				})

	if (rows.length === 0) {
		return ctx.json({ items: [], total: 0 } as ListNotificationsResponse)
	}

	const ids = rows.map((row) => {
		return row.id
	})
	const readRows = await ctx.get('tenantDb').query.notificationRead.findMany({
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

	const items = rows
		.map((row): ListNotificationsResponseItem => {
			return {
				id: row.id,
				type: row.type,
				title: row.title,
				content: row.content,
				read: readIds.has(row.id),
				created_at: row.createdAt
			}
		})
		.filter((row) => {
			if (req.read === undefined) {
				return true
			}
			return row.read === req.read
		})
	return ctx.json({
		items: req.read === undefined ? items : items.slice(offset, offset + req.page_size),
		total: req.read === undefined ? Number(totalRows[0]?.total ?? 0) : items.length
	} as ListNotificationsResponse)
}

export async function readNotificationHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, ReadNotificationApi.request)
	if (!request.success) {
		const error = ReadNotificationApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	const req = request.data

	const row: NewNotificationRead = {
		notificationId: req.id,
		userId: ctx.get('userId'),
		readAt: Date.now()
	}

	await ctx.get('tenantDb').insert(notificationRead).values(row).onConflictDoNothing()
	return ctx.json({})
}
