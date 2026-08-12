import { eq } from 'drizzle-orm'
import type { MiddlewareHandler } from 'hono'
import { betaCode } from '../../db/schema'
import type { ApiEnv } from '..'
import { getRequestAuthRuntimeConfig } from './auth'

export const betaGateMiddleware: MiddlewareHandler<ApiEnv> = async (
	ctx,
	next
): Promise<Response | void> => {
	const config = await getRequestAuthRuntimeConfig(ctx)
	if (!config.authentication.betaCodeEnabled) {
		return next()
	}

	const db = ctx.get('metaDb')
	const betaBinding = await db.query.betaCode.findFirst({
		columns: { id: true },
		where: eq(betaCode.usedBy, ctx.get('userId'))
	})
	if (!betaBinding) {
		return ctx.json({ code: 'BETA_CODE_REQUIRED', message: 'Beta code is required' }, 403)
	}

	return next()
}
