import type { Context } from 'hono'
import type { ApiEnv } from '..'
import {
	CreateAgentAuthorizationApi,
	GetAgentAuthorizationDetailsApi,
	ListAgentGrantsApi,
	PollAgentAuthorizationApi,
	ResolveAgentAuthorizationApi,
	RevokeAgentGrantApi
} from '../../../api-contract/agent-auth'
import {
	AGENT_CLIENT_ID,
	AGENT_REDIRECT_PATH,
	AgentAuthError,
	createRelayRequest,
	completeRelay,
	denyRelay,
	getRelayDetailsByState,
	parseCanonicalScopes,
	pollRelay,
	resolveRelayByState,
	resolveRelayByUserCode,
	revokeAgentGrant,
	updateActiveGrantScopes
} from '../../agent-auth'
import { authCore } from '../auth'
import { parseRequest } from '../../lib/request'
import { eq } from 'drizzle-orm'
import { agentGrant } from '../../db/schema'

export async function createAgentAuthorizationHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const parsed = await parseRequest(ctx, CreateAgentAuthorizationApi.request)
	if (!parsed.success) {
		const error = CreateAgentAuthorizationApi.errors.INVALID_REQUEST(parsed.message)
		return ctx.json(error.body, error.status)
	}

	const relay = await createRelayRequest(ctx.get('metaDb'), {
		codeChallenge: parsed.data.code_challenge,
		codeChallengeMethod: parsed.data.code_challenge_method,
		scopes: parsed.data.scopes
	})
	const verificationUri = new URL('/agent/authorize', ctx.env.APP_BASE_URL)
	verificationUri.searchParams.set('user_code', relay.userCode)
	return ctx.json({
		device_code: relay.deviceCode,
		user_code: relay.userCode,
		verification_uri: verificationUri.toString(),
		verification_uri_complete: verificationUri.toString(),
		expires_in: Math.floor((relay.expiresAt - Date.now()) / 1000),
		interval: relay.interval
	})
}

export async function pollAgentAuthorizationHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const parsed = await parseRequest(ctx, PollAgentAuthorizationApi.request)
	if (!parsed.success) {
		const error = PollAgentAuthorizationApi.errors.INVALID_REQUEST(parsed.message)
		return ctx.json(error.body, error.status)
	}

	try {
		const result = await pollRelay(ctx.get('metaDb'), parsed.data.device_code)
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
		if (error instanceof AgentAuthError && error.code === 'INVALID_DEVICE_CODE') {
			const response = PollAgentAuthorizationApi.errors.INVALID_DEVICE_CODE()
			return ctx.json(response.body, response.status)
		}
		throw error
	}
}

export async function resolveAgentAuthorizationHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const parsed = await parseRequest(ctx, ResolveAgentAuthorizationApi.request)
	if (!parsed.success) {
		const error = ResolveAgentAuthorizationApi.errors.INVALID_REQUEST(parsed.message)
		return ctx.json(error.body, error.status)
	}

	try {
		const relay = await resolveRelayByUserCode(ctx.get('metaDb'), parsed.data.user_code)
		return ctx.json({
			authorization_url: buildAuthorizationUrl(ctx.env.APP_BASE_URL, relay)
		})
	} catch (error) {
		if (error instanceof AgentAuthError) {
			const response = ResolveAgentAuthorizationApi.errors.INVALID_REQUEST(error.message)
			return ctx.json(response.body, response.status)
		}
		throw error
	}
}

export async function getAgentAuthorizationDetailsHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const parsed = await parseRequest(ctx, GetAgentAuthorizationDetailsApi.request)
	if (!parsed.success) {
		const error = GetAgentAuthorizationDetailsApi.errors.INVALID_REQUEST(parsed.message)
		return ctx.json(error.body, error.status)
	}

	try {
		const details = await getRelayDetailsByState(ctx.get('metaDb'), parsed.data.state)
		return ctx.json({
			client_id: details.clientId,
			scopes: parseCanonicalScopes(details.scopes),
			expires_in: Math.max(0, Math.floor((details.expiresAt - Date.now()) / 1000))
		})
	} catch (error) {
		if (error instanceof AgentAuthError) {
			const response = GetAgentAuthorizationDetailsApi.errors.INVALID_REQUEST(error.message)
			return ctx.json(response.body, response.status)
		}
		throw error
	}
}

export async function authorizationCallbackHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const state = ctx.req.query('state')
	const error = ctx.req.query('error')
	if (!state) {
		return htmlResponse('Authorization failed', 400)
	}

	if (error) {
		await denyRelay(ctx.get('metaDb'), state)
		return htmlResponse('Authorization denied', 200)
	}

	const code = ctx.req.query('code')
	if (!code) {
		return htmlResponse('Authorization failed', 400)
	}
	const session = await authCore(ctx.env, ctx.get('metaDb')).api.getSession({
		headers: ctx.req.raw.headers
	})
	if (!session) {
		return htmlResponse('Authorization requires login', 401)
	}

	const relay = await resolveRelayByState(ctx.get('metaDb'), state)
	await completeRelay(ctx.get('metaDb'), { state, authorizationCode: code })
	await updateActiveGrantScopes(ctx.get('metaDb'), {
		userId: session.user.id,
		clientId: AGENT_CLIENT_ID,
		scopes: parseCanonicalScopes(relay.scopes)
	})
	return htmlResponse('Authorization completed. You can close this window', 200)
}

export async function listAgentGrantsHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const rows = await ctx.get('metaDb').query.agentGrant.findMany({
		where: eq(agentGrant.userId, ctx.get('userId'))
	})
	const response = {
		items: rows.map((row) => ({
			id: row.id,
			client_id: row.clientId,
			scopes: parseCanonicalScopes(row.scopes),
			status: row.status as 'active' | 'revoked',
			created_at: row.createdAt,
			approved_at: row.approvedAt,
			revoked_at: row.revokedAt ?? null
		})),
		total: rows.length
	}
	return ctx.json(response)
}

export async function revokeAgentGrantHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const parsed = await parseRequest(ctx, RevokeAgentGrantApi.request)
	if (!parsed.success) {
		const error = RevokeAgentGrantApi.errors.INVALID_REQUEST(parsed.message)
		return ctx.json(error.body, error.status)
	}

	try {
		await revokeAgentGrant(ctx.get('metaDb'), {
			grantId: parsed.data.grant_id,
			userId: ctx.get('userId')
		})
		return ctx.json({})
	} catch (error) {
		if (error instanceof AgentAuthError && error.code === 'GRANT_NOT_FOUND') {
			const response = RevokeAgentGrantApi.errors.GRANT_NOT_FOUND()
			return ctx.json(response.body, response.status)
		}
		throw error
	}
}

function buildAuthorizationUrl(
	baseUrl: string,
	params: { state: string; codeChallenge: string }
): string {
	const url = new URL('/api/auth/oauth2/authorize', baseUrl)
	url.searchParams.set('client_id', AGENT_CLIENT_ID)
	url.searchParams.set('response_type', 'code')
	url.searchParams.set('redirect_uri', new URL(AGENT_REDIRECT_PATH, baseUrl).toString())
	url.searchParams.set('scope', 'agent offline_access')
	url.searchParams.set('state', params.state)
	url.searchParams.set('code_challenge', params.codeChallenge)
	url.searchParams.set('code_challenge_method', 'S256')
	url.searchParams.set('resource', baseUrl)
	url.searchParams.set('prompt', 'consent')
	return url.toString()
}

function htmlResponse(message: string, status: number): Response {
	return new Response(
		`<!doctype html><html><body><p>${message}</p></body></html>`,
		{
			status,
			headers: { 'content-type': 'text/html; charset=utf-8' }
		}
	)
}
