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
