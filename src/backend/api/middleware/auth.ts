import type { Context, MiddlewareHandler } from 'hono'
import type { ApiEnv } from '..'
import { authCore } from '../auth'
import { oauthProviderResourceClient } from '@better-auth/oauth-provider/resource-client'
import { AGENT_CLIENT_ID, getAgentGrant } from '../../agent-auth'
import { getAuthRuntimeConfig, type AuthRuntimeConfig } from '../../config'

export type AgentAuthorization = {
	userId: string
	clientId: string
	grantId: string
	scopes: string[]
}

export async function getRequestAuthRuntimeConfig(ctx: Context<ApiEnv>): Promise<AuthRuntimeConfig> {
	const current: AuthRuntimeConfig | undefined = ctx.get('authRuntimeConfig')
	if (current) {
		return current
	}
	const config: AuthRuntimeConfig = await getAuthRuntimeConfig(
		ctx.get('metaDb'),
		ctx.env.CONFIG_ENCRYPTION_KEY
	)
	ctx.set('authRuntimeConfig', config)
	return config
}

export const authConfigMiddleware: MiddlewareHandler<ApiEnv> = async (
	ctx,
	next
): Promise<Response | void> => {
	await getRequestAuthRuntimeConfig(ctx)
	return next()
}

export const authMiddleware: MiddlewareHandler<ApiEnv> = async (
	ctx,
	next
): Promise<Response | void> => {
	const config: AuthRuntimeConfig = await getRequestAuthRuntimeConfig(ctx)
	const auth = authCore(ctx.env, ctx.get('metaDb'), config)
	const session = await auth.api.getSession({
		headers: ctx.req.raw.headers
	})
	if (session) {
		ctx.set('userId', session.user.id)
		ctx.set('agentAuthorization', undefined)
		return next()
	}

	const authorization = ctx.req.header('authorization')
	const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined
	if (!token) {
		return ctx.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401)
	}

	try {
		const payload = await oauthProviderResourceClient(auth).getActions().verifyAccessToken(token, {
			verifyOptions: { audience: ctx.env.APP_BASE_URL },
			scopes: ['agent']
		})
		const userId = payload.sub
		const grantId = readStringClaim(payload['grant_id'])
		const clientId = readStringClaim(payload['azp'] ?? payload['client_id'])
		const scopes = readScopesClaim(payload['agent_scopes'])
		if (!userId || !grantId || clientId !== AGENT_CLIENT_ID || !scopes || payload['agent_grant_status'] !== 'active') {
			return ctx.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401)
		}

		const grant = await getAgentGrant(ctx.get('metaDb'), grantId)
		if (grant.status !== 'active' || grant.userId !== userId || grant.clientId !== clientId) {
			return ctx.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401)
		}

		ctx.set('userId', userId)
		ctx.set('agentAuthorization', { userId, clientId, grantId, scopes })
		return next()
	} catch {
		return ctx.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401)
	}
}

export const browserSessionOnlyMiddleware: MiddlewareHandler<ApiEnv> = async (
	ctx,
	next
): Promise<Response | void> => {
	if (ctx.get('agentAuthorization')) {
		return ctx.json({ code: 'FORBIDDEN', message: 'Agent access is not allowed' }, 403)
	}
	return next()
}

export function requireAgentScope(scope: string): MiddlewareHandler<ApiEnv> {
	return async (ctx, next): Promise<Response | void> => {
		const authorization = ctx.get('agentAuthorization')
		if (!authorization) {
			return next()
		}
		if (!authorization.scopes.includes(scope)) {
			return ctx.json({ code: 'FORBIDDEN', message: 'Required Agent scope is missing' }, 403)
		}
		return next()
	}
}

function readStringClaim(value: unknown): string | undefined {
	return typeof value === 'string' && value !== '' ? value : undefined
}

function readScopesClaim(value: unknown): string[] | undefined {
	if (!Array.isArray(value) || value.some((scope) => typeof scope !== 'string')) {
		return undefined
	}
	return value as string[]
}

export const adminUserMiddleware: MiddlewareHandler<ApiEnv> = async (
	ctx,
	next
): Promise<Response | void> => {
	const adminEmail = ctx.env.SYSTEM_EMAIL.toLowerCase()

	if (!ctx.req.header('cookie')) {
		return ctx.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401)
	}

	const config: AuthRuntimeConfig = await getRequestAuthRuntimeConfig(ctx)
	const session = await authCore(ctx.env, ctx.get('metaDb'), config).api.getSession({
		headers: ctx.req.raw.headers
	})
	if (!session || session.user.email !== adminEmail) {
		return ctx.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401)
	}

	ctx.set('userId', session.user.id)
	return next()
}
