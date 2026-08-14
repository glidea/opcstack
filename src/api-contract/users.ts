import { z } from 'zod'
import { PageRequestSchema, type ApiErrorResult } from './common'

export const ListUsersRequestSchema = PageRequestSchema.extend({
	search: z.string().min(1).optional()
})
export type ListUsersRequest = z.infer<typeof ListUsersRequestSchema>

export const UserInviterSchema = z.object({
	name: z.string(),
	email: z.string()
})

export const ListUsersResponseItemSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	registration_utm_source: z.string().nullable(),
	created_at: z.number(),
	updated_at: z.number(),
	credit_balance: z.string(),
	inviter: UserInviterSchema.nullable()
})
export type ListUsersResponseItem = z.infer<typeof ListUsersResponseItemSchema>

export const ListUsersResponseSchema = z.object({
	items: z.array(ListUsersResponseItemSchema),
	total: z.number()
})
export type ListUsersResponse = z.infer<typeof ListUsersResponseSchema>

const UserErrors = {
	INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
		return {
			status: 400,
			body: { code: 'INVALID_REQUEST', message }
		}
	}
}

export const ListUsersApi = {
	request: ListUsersRequestSchema,
	response: ListUsersResponseSchema,
	errors: {
		...UserErrors
	}
}
