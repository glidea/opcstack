import { eq } from 'drizzle-orm'
import type { MiddlewareHandler } from 'hono'
import { betaCode } from '../../db/schema'
import type { ApiEnv } from '..'

export const betaGateMiddleware: MiddlewareHandler<ApiEnv> = async (
	ctx,
	next
): Promise<Response | void> => {
	if (String(ctx.env.BETA_CODE_ENABLED) !== 'true') {
		return next()
	}

	const db = ctx.get('db')
	const betaBinding = await db.query.betaCode.findFirst({
		columns: { id: true },
		where: eq(betaCode.usedBy, ctx.get('userId'))
	})
	if (!betaBinding) {
		return ctx.json({ code: 'BETA_CODE_REQUIRED' }, 403)
	}

	return next()
}
