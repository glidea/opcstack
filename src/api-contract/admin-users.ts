import { z } from 'zod'
import { PageRequestSchema, type ApiErrorResult } from './common'

export const ListAdminUsersRequestSchema = PageRequestSchema.extend({
	search: z.string().min(1).optional()
})
export type ListAdminUsersRequest = z.infer<typeof ListAdminUsersRequestSchema>

export const AdminUserInviterSchema = z.object({
	name: z.string(),
	email: z.string()
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
	registration_utm_source: z.string().nullable(),
	created_at: z.number(),
	updated_at: z.number(),
	credit_balance: z.string(),
	beta_access: z.boolean(),
	inviter: AdminUserInviterSchema.nullable(),
	shard: AdminUserShardSchema.nullable()
})
export type ListAdminUsersResponseItem = z.infer<typeof ListAdminUsersResponseItemSchema>

export const ListAdminUsersResponseSchema = z.object({
	items: z.array(ListAdminUsersResponseItemSchema),
	total: z.number()
})
export type ListAdminUsersResponse = z.infer<typeof ListAdminUsersResponseSchema>

export const UpdateAdministratorEmailRequestSchema = z.object({
	email: z.string().trim().email()
})
export type UpdateAdministratorEmailRequest = z.infer<
	typeof UpdateAdministratorEmailRequestSchema
>

export const UpdateAdministratorEmailResponseSchema = z.object({
	email: z.string().email()
})
export type UpdateAdministratorEmailResponse = z.infer<
	typeof UpdateAdministratorEmailResponseSchema
>

const AdminUserErrors = {
	INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
		return {
			status: 400,
			body: { code: 'INVALID_REQUEST', message }
		}
	},
	EMAIL_ALREADY_EXISTS(): ApiErrorResult<'EMAIL_ALREADY_EXISTS', 409> {
		return {
			status: 409,
			body: { code: 'EMAIL_ALREADY_EXISTS', message: 'Email is already in use' }
		}
	}
}

export const ListAdminUsersApi = {
	request: ListAdminUsersRequestSchema,
	response: ListAdminUsersResponseSchema,
	errors: {
		...AdminUserErrors
	}
}

export const UpdateAdministratorEmailApi = {
	request: UpdateAdministratorEmailRequestSchema,
	response: UpdateAdministratorEmailResponseSchema,
	errors: AdminUserErrors
}
