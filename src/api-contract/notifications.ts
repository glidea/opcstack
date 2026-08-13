import { z } from 'zod'
import { PageRequestSchema, type ApiErrorResult } from './common'

export const CreateNotificationRequestSchema = z.object({
	type: z.string().min(1).optional().default('system'),
	title: z.string().min(1),
	content: z.string().min(1),
	target_user_id: z.string().min(1).nullable().optional()
})
export type CreateNotificationRequest = z.infer<typeof CreateNotificationRequestSchema>

export const CreateNotificationResponseSchema = z.object({
	id: z.string()
})
export type CreateNotificationResponse = z.infer<typeof CreateNotificationResponseSchema>

export const ListAdminNotificationsRequestSchema = PageRequestSchema.extend({
	id: z.string().min(1).optional(),
	target_user_id: z.string().min(1).optional(),
	type: z.string().min(1).optional(),
	scope: z.enum(['global', 'user']).optional(),
	created_at_start: z.number().int().optional(),
	created_at_end: z.number().int().optional()
})
export type ListAdminNotificationsRequest = z.infer<typeof ListAdminNotificationsRequestSchema>

export const ListAdminNotificationsResponseItemSchema = z.object({
	id: z.string(),
	type: z.string(),
	title: z.string(),
	content: z.string(),
	target_user_id: z.string().nullable(),
	created_at: z.number(),
	archived_at: z.number().nullable()
})
export type ListAdminNotificationsResponseItem = z.infer<
	typeof ListAdminNotificationsResponseItemSchema
>

export const ListAdminNotificationsResponseSchema = z.object({
	items: z.array(ListAdminNotificationsResponseItemSchema),
	total: z.number()
})
export type ListAdminNotificationsResponse = z.infer<
	typeof ListAdminNotificationsResponseSchema
>

export const UpdateNotificationRequestSchema = z.object({
	id: z.string().min(1),
	type: z.string().min(1),
	title: z.string().min(1),
	content: z.string().min(1),
	target_user_id: z.string().min(1).nullable()
})
export type UpdateNotificationRequest = z.infer<typeof UpdateNotificationRequestSchema>

export const UpdateNotificationResponseSchema = ListAdminNotificationsResponseItemSchema
export type UpdateNotificationResponse = z.infer<typeof UpdateNotificationResponseSchema>

export const ArchiveNotificationRequestSchema = z.object({
	id: z.string().min(1)
})
export type ArchiveNotificationRequest = z.infer<typeof ArchiveNotificationRequestSchema>

export const ArchiveNotificationResponseSchema = ListAdminNotificationsResponseItemSchema
export type ArchiveNotificationResponse = z.infer<typeof ArchiveNotificationResponseSchema>

export const ListNotificationsRequestSchema = PageRequestSchema.extend({
	type: z.string().min(1).optional(),
	read: z.boolean().optional(),
	created_at_start: z.number().int().optional(),
	created_at_end: z.number().int().optional()
})
export type ListNotificationsRequest = z.infer<typeof ListNotificationsRequestSchema>

export const ListNotificationsResponseItemSchema = z.object({
	id: z.string(),
	type: z.string(),
	title: z.string(),
	content: z.string(),
	read: z.boolean(),
	created_at: z.number()
})
export type ListNotificationsResponseItem = z.infer<typeof ListNotificationsResponseItemSchema>

export const ListNotificationsResponseSchema = z.object({
	items: z.array(ListNotificationsResponseItemSchema),
	total: z.number()
})
export type ListNotificationsResponse = z.infer<typeof ListNotificationsResponseSchema>

export const ReadNotificationRequestSchema = z.object({
	id: z.string().min(1)
})
export type ReadNotificationRequest = z.infer<typeof ReadNotificationRequestSchema>

export const ReadNotificationResponseSchema = z.object({})
export type ReadNotificationResponse = z.infer<typeof ReadNotificationResponseSchema>

export const CreateNotificationApi = {
	request: CreateNotificationRequestSchema,
	response: CreateNotificationResponseSchema,
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

export const ListAdminNotificationsApi = {
	request: ListAdminNotificationsRequestSchema,
	response: ListAdminNotificationsResponseSchema,
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

export const ListNotificationsApi = {
	request: ListNotificationsRequestSchema,
	response: ListNotificationsResponseSchema,
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

export const UpdateNotificationApi = {
	request: UpdateNotificationRequestSchema,
	response: UpdateNotificationResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
			return {
				status: 400,
				body: { code: 'INVALID_REQUEST', message }
			}
		},
		NOT_FOUND(): ApiErrorResult<'NOT_FOUND', 404> {
			return {
				status: 404,
				body: { code: 'NOT_FOUND', message: 'Notification not found' }
			}
		}
	}
}

export const ArchiveNotificationApi = {
	request: ArchiveNotificationRequestSchema,
	response: ArchiveNotificationResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
			return {
				status: 400,
				body: { code: 'INVALID_REQUEST', message }
			}
		},
		NOT_FOUND(): ApiErrorResult<'NOT_FOUND', 404> {
			return {
				status: 404,
				body: { code: 'NOT_FOUND', message: 'Notification not found' }
			}
		}
	}
}

export const ReadNotificationApi = {
	request: ReadNotificationRequestSchema,
	response: ReadNotificationResponseSchema,
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
