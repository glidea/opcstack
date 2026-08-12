import { eq } from 'drizzle-orm'
import type { Context } from 'hono'
import {
	CreateOAuthAuthorizationApi,
	GetOAuthAuthorizationDetailsApi,
	ListOAuthGrantsApi,
	PollOAuthAuthorizationApi,
	ResolveOAuthAuthorizationApi,
	RevokeOAuthGrantApi,
	type ListOAuthGrantsResponse
} from '../../../api-contract/oauth-api-access'
import { isAdministrator } from '../../auth/administrator'
import { oauthGrant } from '../../db/schema'
import { parseRequest } from '../../lib/request'
import {
	OAUTH_API_CLIENT_ID,
	OAUTH_API_REDIRECT_PATH,
	OAuthApiAccessError,
	activateGrantForAuthorization,
	completeAuthorization,
	createAuthorizationRequest,
	denyAuthorization,
	getAuthorizationDetailsByState,
	pollAuthorization,
	resolveAuthorizationByState,
	resolveAuthorizationByUserCode,
	revokeOAuthGrant
} from '../../oauth-api-access'
import { isAdministratorScope } from '../scopes'
import type { ApiEnv } from '..'
import { authCore } from '../auth'
import { getRequestAuthRuntimeConfig } from '../middleware/auth'

export async function createOAuthAuthorizationHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const parsed = await parseRequest(ctx, CreateOAuthAuthorizationApi.request)
	if (!parsed.success) {
		const error = CreateOAuthAuthorizationApi.errors.INVALID_REQUEST(parsed.message)
		return ctx.json(error.body, error.status)
	}

	try {
		const authorization = await createAuthorizationRequest(ctx.get('metaDb'), {
			clientId: parsed.data.client_id,
			codeChallenge: parsed.data.code_challenge,
			codeChallengeMethod: parsed.data.code_challenge_method,
			scopes: parsed.data.scopes
		})
		const verificationUri = new URL('/oauth/authorize', ctx.env.APP_BASE_URL)
		verificationUri.searchParams.set('user_code', authorization.userCode)
		return ctx.json({
			device_code: authorization.deviceCode,
			user_code: authorization.userCode,
			verification_uri: verificationUri.toString(),
			verification_uri_complete: verificationUri.toString(),
			expires_in: Math.floor((authorization.expiresAt - Date.now()) / 1000),
			interval: authorization.interval
		})
	} catch (error) {
		if (error instanceof OAuthApiAccessError) {
			const response = CreateOAuthAuthorizationApi.errors.INVALID_REQUEST(error.message)
			return ctx.json(response.body, response.status)
		}
		throw error
	}
}

export async function pollOAuthAuthorizationHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const parsed = await parseRequest(ctx, PollOAuthAuthorizationApi.request)
	if (!parsed.success) {
		const error = PollOAuthAuthorizationApi.errors.INVALID_REQUEST(parsed.message)
		return ctx.json(error.body, error.status)
	}

	try {
		const result = await pollAuthorization(ctx.get('metaDb'), parsed.data.device_code)
		if (result.status === 'authorized') {
			return ctx.json({
				status: result.status,
				code: result.code,
				redirect_uri: new URL(result.redirectUri, ctx.env.APP_BASE_URL).toString()
			})
		}
		if (result.status === 'pending' || result.status === 'slow_down') {
			return ctx.json({ status: result.status, interval: result.interval })
		}
		return ctx.json({ status: result.status })
	} catch (error) {
		if (error instanceof OAuthApiAccessError && error.code === 'INVALID_DEVICE_CODE') {
			const response = PollOAuthAuthorizationApi.errors.INVALID_DEVICE_CODE()
			return ctx.json(response.body, response.status)
		}
		throw error
	}
}

export async function resolveOAuthAuthorizationHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const parsed = await parseRequest(ctx, ResolveOAuthAuthorizationApi.request)
	if (!parsed.success) {
		const error = ResolveOAuthAuthorizationApi.errors.INVALID_REQUEST(parsed.message)
		return ctx.json(error.body, error.status)
	}

	try {
		const authorization = await resolveAuthorizationByUserCode(
			ctx.get('metaDb'),
			parsed.data.user_code
		)
		return ctx.json({ authorization_url: buildAuthorizationUrl(ctx.env.APP_BASE_URL, authorization) })
	} catch (error) {
		if (error instanceof OAuthApiAccessError) {
			const response = ResolveOAuthAuthorizationApi.errors.INVALID_REQUEST(error.message)
			return ctx.json(response.body, response.status)
		}
		throw error
	}
}

export async function getOAuthAuthorizationDetailsHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const parsed = await parseRequest(ctx, GetOAuthAuthorizationDetailsApi.request)
	if (!parsed.success) {
		const error = GetOAuthAuthorizationDetailsApi.errors.INVALID_REQUEST(parsed.message)
		return ctx.json(error.body, error.status)
	}

	try {
		const authorization = await resolveAuthorizationByState(ctx.get('metaDb'), parsed.data.state)
		const requestsAdministratorAccess: boolean = authorization.scopes.some(isAdministratorScope)
		if (
			requestsAdministratorAccess &&
			!(await isAdministrator(ctx.get('metaDb'), ctx.get('userId')))
		) {
			return ctx.json({ code: 'FORBIDDEN', message: 'Administrator access is required' }, 403)
		}
		const details = await getAuthorizationDetailsByState(
			ctx.get('metaDb'),
			parsed.data.state,
			ctx.get('userId')
		)
		return ctx.json({
			client_id: details.clientId,
			client_name: 'OPC CLI',
			target_origin: ctx.env.APP_BASE_URL,
			scopes: details.scopes,
			expires_in: Math.max(0, Math.floor((details.expiresAt - Date.now()) / 1000))
		})
	} catch (error) {
		if (error instanceof OAuthApiAccessError) {
			const response = GetOAuthAuthorizationDetailsApi.errors.INVALID_REQUEST(error.message)
			return ctx.json(response.body, response.status)
		}
		throw error
	}
}

export async function oauthAuthorizationCallbackHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const state: string | undefined = ctx.req.query('state')
	if (!state) {
		return htmlResponse('Authorization failed', 400)
	}
	if (ctx.req.query('error')) {
		await denyAuthorization(ctx.get('metaDb'), state)
		return htmlResponse('Authorization denied', 200)
	}
	const code: string | undefined = ctx.req.query('code')
	if (!code) {
		return htmlResponse('Authorization failed', 400)
	}

	const config = await getRequestAuthRuntimeConfig(ctx)
	const session = await authCore(ctx.env, ctx.get('metaDb'), config).api.getSession({
		headers: ctx.req.raw.headers
	})
	if (!session) {
		return htmlResponse('Authorization requires login', 401)
	}
	await activateGrantForAuthorization(ctx.get('metaDb'), { state, userId: session.user.id })
	await completeAuthorization(ctx.get('metaDb'), { state, authorizationCode: code })
	return htmlResponse('Authorization completed. You can close this window', 200)
}

export async function listOAuthGrantsHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const rows = await ctx.get('metaDb').query.oauthGrant.findMany({
		where: eq(oauthGrant.userId, ctx.get('userId'))
	})
	const response: ListOAuthGrantsResponse = {
		items: rows.map((row) => ({
			id: row.id,
			client_id: row.clientId,
			client_name: row.clientId === OAUTH_API_CLIENT_ID ? 'OPC CLI' : row.clientId,
			target_origin: ctx.env.APP_BASE_URL,
			scopes: row.scopes,
			status: row.status as 'pending' | 'active' | 'revoked',
			created_at: row.createdAt,
			approved_at: row.approvedAt ?? null,
			revoked_at: row.revokedAt ?? null
		})),
		total: rows.length
	}
	return ctx.json(response)
}

export async function revokeOAuthGrantHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const parsed = await parseRequest(ctx, RevokeOAuthGrantApi.request)
	if (!parsed.success) {
		const error = RevokeOAuthGrantApi.errors.INVALID_REQUEST(parsed.message)
		return ctx.json(error.body, error.status)
	}
	try {
		await revokeOAuthGrant(ctx.get('metaDb'), {
			grantId: parsed.data.grant_id,
			userId: ctx.get('userId')
		})
		return ctx.json({})
	} catch (error) {
		if (error instanceof OAuthApiAccessError && error.code === 'GRANT_NOT_FOUND') {
			const response = RevokeOAuthGrantApi.errors.GRANT_NOT_FOUND()
			return ctx.json(response.body, response.status)
		}
		throw error
	}
}

function buildAuthorizationUrl(baseUrl: string, params: AuthorizationParams): string {
	const url: URL = new URL('/api/auth/oauth2/authorize', baseUrl)
	url.searchParams.set('client_id', OAUTH_API_CLIENT_ID)
	url.searchParams.set('response_type', 'code')
	url.searchParams.set('redirect_uri', new URL(OAUTH_API_REDIRECT_PATH, baseUrl).toString())
	url.searchParams.set('scope', 'api_access offline_access')
	url.searchParams.set('state', params.state)
	url.searchParams.set('code_challenge', params.codeChallenge)
	url.searchParams.set('code_challenge_method', 'S256')
	url.searchParams.set('resource', baseUrl)
	url.searchParams.set('prompt', 'consent')
	return url.toString()
}

type AuthorizationParams = {
	state: string
	codeChallenge: string
}

function htmlResponse(message: string, status: number): Response {
	return new Response(`<!doctype html><html><body><p>${message}</p></body></html>`, {
		status,
		headers: { 'content-type': 'text/html; charset=utf-8' }
	})
}
