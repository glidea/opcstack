import type { Context, MiddlewareHandler } from 'hono'
import type { ApiEnv } from '..'
import { authCore } from '../auth'
import { OAUTH_API_CLIENT_ID, getOAuthGrant } from '../auth/oauth-api-access'
import { getAuthRuntimeConfig, type AuthRuntimeConfig } from '../../config'
import { isAdministrator } from '../auth/administrator'
import type { ApiScope } from '../scopes'

export type OAuthAuthorization = {
	userId: string
	clientId: string
	grantId: string
	scopes: ApiScope[]
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
		ctx.set('oauthAuthorization', undefined)
		return next()
	}

	const authorization = ctx.req.header('authorization')
	const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined
	if (!token) {
		return ctx.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401)
	}

	try {
		const authIssuer: string = new URL('/api/auth', ctx.env.APP_BASE_URL).toString()
		const verified = await auth.api.verifyJWT({
			body: { token, issuer: authIssuer }
		})
		const payload = verified.payload
		if (!payload || !hasOAuthProtocolScope(payload['scope'])) {
			return ctx.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401)
		}
		const userId = payload.sub
		const grantId = readStringClaim(payload['grant_id'])
		const clientId = readStringClaim(payload['azp'] ?? payload['client_id'])
		const scopes = readScopesClaim(payload['api_scopes'])
		if (!userId || !grantId || clientId !== OAUTH_API_CLIENT_ID || !scopes) {
			return ctx.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401)
		}

		const grant = await getOAuthGrant(ctx.get('metaDb'), grantId)
		if (
			grant.status !== 'active' ||
			grant.userId !== userId ||
			grant.clientId !== clientId ||
			grant.scopes.join(' ') !== scopes.join(' ')
		) {
			return ctx.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401)
		}

		ctx.set('userId', userId)
		ctx.set('oauthAuthorization', { userId, clientId, grantId, scopes: grant.scopes })
		return next()
	} catch {
		return ctx.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401)
	}
}

export const browserSessionOnlyMiddleware: MiddlewareHandler<ApiEnv> = async (
	ctx,
	next
): Promise<Response | void> => {
	if (ctx.get('oauthAuthorization')) {
		return ctx.json({ code: 'FORBIDDEN', message: 'OAuth access is not allowed' }, 403)
	}
	return next()
}

export function requireApiScope(scope: ApiScope): MiddlewareHandler<ApiEnv> {
	return async (ctx, next): Promise<Response | void> => {
		const authorization = ctx.get('oauthAuthorization')
		if (!authorization) {
			return next()
		}
		if (!authorization.scopes.includes(scope)) {
			return ctx.json({ code: 'FORBIDDEN', message: 'Required API scope is missing' }, 403)
		}
		return next()
	}
}

function readStringClaim(value: unknown): string | undefined {
	return typeof value === 'string' && value !== '' ? value : undefined
}

function readScopesClaim(value: unknown): ApiScope[] | undefined {
	if (!Array.isArray(value) || value.some((scope) => typeof scope !== 'string')) {
		return undefined
	}
	return value as ApiScope[]
}

function hasOAuthProtocolScope(value: unknown): boolean {
	return typeof value === 'string' && value.split(' ').includes('api_access')
}

export const administratorMiddleware: MiddlewareHandler<ApiEnv> = async (
	ctx,
	next
): Promise<Response | void> => {
	if (!(await isAdministrator(ctx.get('metaDb'), ctx.get('userId')))) {
		return ctx.json({ code: 'FORBIDDEN', message: 'Forbidden' }, 403)
	}
	return next()
}
