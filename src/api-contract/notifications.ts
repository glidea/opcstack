import { z } from 'zod'
import { PageRequestSchema, type PageResponse } from './common'

export const CreateNotificationRequestSchema = z.object({
	type: z.string().min(1).optional().default('system'),
	title: z.string().min(1),
	content: z.string().min(1),
	target_user_id: z.string().min(1).nullable().optional()
})
export type CreateNotificationRequest = z.infer<typeof CreateNotificationRequestSchema>

export type CreateNotificationResponse = {
	id: string
}

export const ListNotificationsRequestSchema = PageRequestSchema.extend({
	type: z.string().min(1).optional(),
	read: z.boolean().optional(),
	created_at_start: z.number().int().optional(),
	created_at_end: z.number().int().optional()
})
export type ListNotificationsRequest = z.infer<typeof ListNotificationsRequestSchema>

export type ListNotificationsResponseItem = {
	id: string
	type: string
	title: string
	content: string
	read: boolean
	created_at: number
}

export type ListNotificationsResponse = PageResponse<ListNotificationsResponseItem>

export const ReadNotificationRequestSchema = z.object({
	id: z.string().min(1)
})
export type ReadNotificationRequest = z.infer<typeof ReadNotificationRequestSchema>
