import { z } from 'zod'
import { PageRequestSchema, type ApiErrorResult } from './common'

export const ListAdminUsersRequestSchema = PageRequestSchema.extend({
	search: z.string().min(1).optional()
})
export type ListAdminUsersRequest = z.infer<typeof ListAdminUsersRequestSchema>

export const AdminUserBetaAccessSchema = z.object({
	code: z.string(),
	used_at: z.number()
})

export const AdminUserShardSchema = z.object({
	id: z.string(),
	region: z.string(),
	database_name: z.string(),
	database_id: z.string()
})

export const ListAdminUsersResponseItemSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	email_verified: z.boolean(),
	image: z.string().nullable(),
	aff_code: z.string().nullable(),
	registration_utm_source: z.string().nullable(),
	created_at: z.number(),
	updated_at: z.number(),
	beta_access: AdminUserBetaAccessSchema.nullable(),
	shard: AdminUserShardSchema.nullable()
})
export type ListAdminUsersResponseItem = z.infer<typeof ListAdminUsersResponseItemSchema>

export const ListAdminUsersResponseSchema = z.object({
	items: z.array(ListAdminUsersResponseItemSchema),
	total: z.number()
})
export type ListAdminUsersResponse = z.infer<typeof ListAdminUsersResponseSchema>

export const ListAdminUsersApi = {
	request: ListAdminUsersRequestSchema,
	response: ListAdminUsersResponseSchema,
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
