import { z } from 'zod'
import type { ApiErrorResult } from './common'

const ScopeSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/)

export const CreateAgentAuthorizationRequestSchema = z.object({
	scopes: z.array(ScopeSchema).max(20).default([]),
	code_challenge: z.string().min(43).max(128),
	code_challenge_method: z.literal('S256')
})
export type CreateAgentAuthorizationRequest = z.infer<
	typeof CreateAgentAuthorizationRequestSchema
>

export const CreateAgentAuthorizationResponseSchema = z.object({
	device_code: z.string(),
	user_code: z.string(),
	verification_uri: z.string().url(),
	verification_uri_complete: z.string().url(),
	expires_in: z.number().int(),
	interval: z.number().int()
})
export type CreateAgentAuthorizationResponse = z.infer<
	typeof CreateAgentAuthorizationResponseSchema
>

export const PollAgentAuthorizationRequestSchema = z.object({
	device_code: z.string().min(1)
})
export type PollAgentAuthorizationRequest = z.infer<
	typeof PollAgentAuthorizationRequestSchema
>

const PollPendingResponseSchema = z.object({
	status: z.literal('pending'),
	interval: z.number().int()
})
const PollSlowDownResponseSchema = z.object({
	status: z.literal('slow_down'),
	interval: z.number().int()
})
const PollAuthorizedResponseSchema = z.object({
	status: z.literal('authorized'),
	code: z.string(),
	redirect_uri: z.string()
})
const PollStatusResponseSchema = z.object({
	status: z.enum(['expired', 'denied', 'consumed'])
})
export const PollAgentAuthorizationResponseSchema = z.union([
	PollPendingResponseSchema,
	PollSlowDownResponseSchema,
	PollAuthorizedResponseSchema,
	PollStatusResponseSchema
])
export type PollAgentAuthorizationResponse = z.infer<
	typeof PollAgentAuthorizationResponseSchema
>

export const ResolveAgentAuthorizationRequestSchema = z.object({
	user_code: z.string().min(1).max(32)
})
export type ResolveAgentAuthorizationRequest = z.infer<
	typeof ResolveAgentAuthorizationRequestSchema
>

export const ResolveAgentAuthorizationResponseSchema = z.object({
	authorization_url: z.string().url()
})
export type ResolveAgentAuthorizationResponse = z.infer<
	typeof ResolveAgentAuthorizationResponseSchema
>

export const GetAgentAuthorizationDetailsRequestSchema = z.object({
	state: z.string().min(1).max(128)
})
export type GetAgentAuthorizationDetailsRequest = z.infer<
	typeof GetAgentAuthorizationDetailsRequestSchema
>

export const GetAgentAuthorizationDetailsResponseSchema = z.object({
	client_id: z.string(),
	scopes: z.array(z.string()),
	expires_in: z.number().int()
})
export type GetAgentAuthorizationDetailsResponse = z.infer<
	typeof GetAgentAuthorizationDetailsResponseSchema
>

export const ListAgentGrantsRequestSchema = z.object({})
export type ListAgentGrantsRequest = z.infer<typeof ListAgentGrantsRequestSchema>

export const AgentGrantResponseItemSchema = z.object({
	id: z.string(),
	client_id: z.string(),
	scopes: z.array(z.string()),
	status: z.enum(['active', 'revoked']),
	created_at: z.number().int(),
	approved_at: z.number().int(),
	revoked_at: z.number().int().nullable()
})
export const ListAgentGrantsResponseSchema = z.object({
	items: z.array(AgentGrantResponseItemSchema),
	total: z.number().int()
})
export type ListAgentGrantsResponse = z.infer<typeof ListAgentGrantsResponseSchema>

export const RevokeAgentGrantRequestSchema = z.object({
	grant_id: z.string().min(1)
})
export type RevokeAgentGrantRequest = z.infer<typeof RevokeAgentGrantRequestSchema>

export const RevokeAgentGrantResponseSchema = z.object({})
export type RevokeAgentGrantResponse = z.infer<typeof RevokeAgentGrantResponseSchema>

type InvalidRequestError = ApiErrorResult<'INVALID_REQUEST', 400>

export const CreateAgentAuthorizationApi = {
	request: CreateAgentAuthorizationRequestSchema,
	response: CreateAgentAuthorizationResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): InvalidRequestError {
			return { status: 400, body: { code: 'INVALID_REQUEST', message } }
		},
	}
}

export const PollAgentAuthorizationApi = {
	request: PollAgentAuthorizationRequestSchema,
	response: PollAgentAuthorizationResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): InvalidRequestError {
			return { status: 400, body: { code: 'INVALID_REQUEST', message } }
		},
		INVALID_DEVICE_CODE(): ApiErrorResult<'INVALID_DEVICE_CODE', 400> {
			return { status: 400, body: { code: 'INVALID_DEVICE_CODE', message: 'Invalid device code' } }
		}
	}
}

export const ResolveAgentAuthorizationApi = {
	request: ResolveAgentAuthorizationRequestSchema,
	response: ResolveAgentAuthorizationResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): InvalidRequestError {
			return { status: 400, body: { code: 'INVALID_REQUEST', message } }
		},
	}
}

export const GetAgentAuthorizationDetailsApi = {
	request: GetAgentAuthorizationDetailsRequestSchema,
	response: GetAgentAuthorizationDetailsResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): InvalidRequestError {
			return { status: 400, body: { code: 'INVALID_REQUEST', message } }
		},
	}
}

export const ListAgentGrantsApi = {
	request: ListAgentGrantsRequestSchema,
	response: ListAgentGrantsResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): InvalidRequestError {
			return { status: 400, body: { code: 'INVALID_REQUEST', message } }
		}
	}
}

export const RevokeAgentGrantApi = {
	request: RevokeAgentGrantRequestSchema,
	response: RevokeAgentGrantResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): InvalidRequestError {
			return { status: 400, body: { code: 'INVALID_REQUEST', message } }
		},
		GRANT_NOT_FOUND(): ApiErrorResult<'GRANT_NOT_FOUND', 404> {
			return { status: 404, body: { code: 'GRANT_NOT_FOUND', message: 'Agent grant not found' } }
		}
	}
}
