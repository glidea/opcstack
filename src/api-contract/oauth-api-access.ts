import { z } from 'zod'
import type { ApiErrorResult } from './common'

const ApiScopeSchema = z.string().min(1)

export const CreateOAuthAuthorizationRequestSchema = z.object({
	client_id: z.string().min(1),
	scopes: z.array(ApiScopeSchema).min(1).max(20),
	code_challenge: z.string().min(43).max(128),
	code_challenge_method: z.literal('S256')
})
export type CreateOAuthAuthorizationRequest = z.infer<
	typeof CreateOAuthAuthorizationRequestSchema
>

export const CreateOAuthAuthorizationResponseSchema = z.object({
	device_code: z.string(),
	user_code: z.string(),
	verification_uri: z.string().url(),
	verification_uri_complete: z.string().url(),
	expires_in: z.number().int(),
	interval: z.number().int()
})
export type CreateOAuthAuthorizationResponse = z.infer<
	typeof CreateOAuthAuthorizationResponseSchema
>

export const PollOAuthAuthorizationRequestSchema = z.object({
	device_code: z.string().min(1)
})
export type PollOAuthAuthorizationRequest = z.infer<typeof PollOAuthAuthorizationRequestSchema>

export const PollOAuthAuthorizationResponseSchema = z.union([
	z.object({ status: z.literal('pending'), interval: z.number().int() }),
	z.object({ status: z.literal('slow_down'), interval: z.number().int() }),
	z.object({ status: z.literal('authorized'), code: z.string(), redirect_uri: z.string() }),
	z.object({ status: z.enum(['expired', 'denied', 'consumed']) })
])
export type PollOAuthAuthorizationResponse = z.infer<typeof PollOAuthAuthorizationResponseSchema>

export const ResolveOAuthAuthorizationRequestSchema = z.object({
	user_code: z.string().min(1).max(32)
})
export type ResolveOAuthAuthorizationRequest = z.infer<
	typeof ResolveOAuthAuthorizationRequestSchema
>

export const ResolveOAuthAuthorizationResponseSchema = z.object({
	authorization_url: z.string().url()
})
export type ResolveOAuthAuthorizationResponse = z.infer<
	typeof ResolveOAuthAuthorizationResponseSchema
>

export const GetOAuthAuthorizationDetailsRequestSchema = z.object({
	state: z.string().min(1).max(128)
})
export type GetOAuthAuthorizationDetailsRequest = z.infer<
	typeof GetOAuthAuthorizationDetailsRequestSchema
>

export const GetOAuthAuthorizationDetailsResponseSchema = z.object({
	client_id: z.string(),
	client_name: z.string(),
	target_origin: z.string().url(),
	scopes: z.array(z.string()),
	expires_in: z.number().int()
})
export type GetOAuthAuthorizationDetailsResponse = z.infer<
	typeof GetOAuthAuthorizationDetailsResponseSchema
>

export const ListOAuthGrantsRequestSchema = z.object({})
export type ListOAuthGrantsRequest = z.infer<typeof ListOAuthGrantsRequestSchema>

export const OAuthGrantResponseItemSchema = z.object({
	id: z.string(),
	client_id: z.string(),
	client_name: z.string(),
	target_origin: z.string().url(),
	scopes: z.array(z.string()),
	status: z.enum(['pending', 'active', 'revoked']),
	created_at: z.number().int(),
	approved_at: z.number().int().nullable(),
	revoked_at: z.number().int().nullable()
})
export const ListOAuthGrantsResponseSchema = z.object({
	items: z.array(OAuthGrantResponseItemSchema),
	total: z.number().int()
})
export type ListOAuthGrantsResponse = z.infer<typeof ListOAuthGrantsResponseSchema>

export const RevokeOAuthGrantRequestSchema = z.object({
	grant_id: z.string().min(1)
})
export type RevokeOAuthGrantRequest = z.infer<typeof RevokeOAuthGrantRequestSchema>

export const RevokeOAuthGrantResponseSchema = z.object({})
export type RevokeOAuthGrantResponse = z.infer<typeof RevokeOAuthGrantResponseSchema>

type InvalidRequestError = ApiErrorResult<'INVALID_REQUEST', 400>

function invalidRequest(message: string): InvalidRequestError {
	return { status: 400, body: { code: 'INVALID_REQUEST', message } }
}

export const CreateOAuthAuthorizationApi = {
	request: CreateOAuthAuthorizationRequestSchema,
	response: CreateOAuthAuthorizationResponseSchema,
	errors: { INVALID_REQUEST: invalidRequest }
}

export const PollOAuthAuthorizationApi = {
	request: PollOAuthAuthorizationRequestSchema,
	response: PollOAuthAuthorizationResponseSchema,
	errors: {
		INVALID_REQUEST: invalidRequest,
		INVALID_DEVICE_CODE(): ApiErrorResult<'INVALID_DEVICE_CODE', 400> {
			return {
				status: 400,
				body: { code: 'INVALID_DEVICE_CODE', message: 'Invalid device code' }
			}
		}
	}
}

export const ResolveOAuthAuthorizationApi = {
	request: ResolveOAuthAuthorizationRequestSchema,
	response: ResolveOAuthAuthorizationResponseSchema,
	errors: { INVALID_REQUEST: invalidRequest }
}

export const GetOAuthAuthorizationDetailsApi = {
	request: GetOAuthAuthorizationDetailsRequestSchema,
	response: GetOAuthAuthorizationDetailsResponseSchema,
	errors: { INVALID_REQUEST: invalidRequest }
}

export const ListOAuthGrantsApi = {
	request: ListOAuthGrantsRequestSchema,
	response: ListOAuthGrantsResponseSchema,
	errors: { INVALID_REQUEST: invalidRequest }
}

export const RevokeOAuthGrantApi = {
	request: RevokeOAuthGrantRequestSchema,
	response: RevokeOAuthGrantResponseSchema,
	errors: {
		INVALID_REQUEST: invalidRequest,
		GRANT_NOT_FOUND(): ApiErrorResult<'GRANT_NOT_FOUND', 404> {
			return {
				status: 404,
				body: { code: 'GRANT_NOT_FOUND', message: 'OAuth grant not found' }
			}
		}
	}
}
