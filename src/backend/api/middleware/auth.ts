import type { MiddlewareHandler } from 'hono'
import type { ApiEnv } from '..'
import { authCore } from '../auth'
import { eq } from 'drizzle-orm'
import { user } from '../../db/schema.auth'

export const authMiddleware: MiddlewareHandler<ApiEnv> = async (
	ctx,
	next
): Promise<Response | void> => {
	const session = await authCore(ctx.env, ctx.get('metaDb')).api.getSession({
		headers: ctx.req.raw.headers
	})
	if (!session) {
		return ctx.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401)
	}

	ctx.set('userId', session.user.id)
	return next()
}

export const adminUserMiddleware: MiddlewareHandler<ApiEnv> = async (
	ctx,
	next
): Promise<Response | void> => {
	const authorization = ctx.req.header('authorization')
	const adminEmail = ctx.env.SYSTEM_EMAIL.toLowerCase()
	const adminApiToken = ctx.env.ADMIN_API_TOKEN

	if (adminApiToken && authorization === `Bearer ${adminApiToken}`) {
		const adminUser = await ctx.get('metaDb').query.user.findFirst({
			columns: {
				id: true
			},
			where: eq(user.email, adminEmail)
		})
		if (!adminUser) {
			return ctx.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401)
		}

		ctx.set('userId', adminUser.id)
		return next()
	}

	const session = await authCore(ctx.env, ctx.get('metaDb')).api.getSession({
		headers: ctx.req.raw.headers
	})
	if (!session || session.user.email !== adminEmail) {
		return ctx.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401)
	}

	ctx.set('userId', session.user.id)
	return next()
}
