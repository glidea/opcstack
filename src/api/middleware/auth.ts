import type { MiddlewareHandler } from 'hono'
import type { ApiEnv } from '..'
import { authCore } from '../auth'

function hasBearerAuthHeader(authorization: string | undefined): boolean {
	return typeof authorization === 'string' && authorization.startsWith('Bearer ')
}

export const authMiddleware: MiddlewareHandler<ApiEnv> = async (
	ctx,
	next
): Promise<Response | void> => {
	const authorization: string | undefined = ctx.req.header('authorization')
	if (!hasBearerAuthHeader(authorization)) {
		return ctx.json({ code: 'UNAUTHORIZED' }, 401)
	}

	const session = await authCore(ctx.env, ctx.get('db')).api.getSession({
		headers: ctx.req.raw.headers
	})
	if (!session) {
		return ctx.json({ code: 'UNAUTHORIZED' }, 401)
	}

	ctx.set('userId', session.user.id)
	return next()
}

export const adminSecretMiddleware: MiddlewareHandler<ApiEnv> = async (
	ctx,
	next
): Promise<Response | void> => {
	const authorization = ctx.req.header('authorization')
	const adminSecret = ctx.env.ADMIN_SECRET
	if (authorization !== `Bearer ${adminSecret}`) {
		return ctx.json({ code: 'UNAUTHORIZED' }, 401)
	}
	return next()
}
