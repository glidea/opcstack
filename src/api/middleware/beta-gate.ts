import { eq } from 'drizzle-orm'
import type { MiddlewareHandler } from 'hono'
import { betaCode } from '../../db/schema'
import type { ApiEnv } from '..'

function isBetaPublicPath(pathname: string): boolean {
	return (
		pathname.startsWith('/api/auth/') ||
		pathname === '/api/bind_beta_code' ||
		pathname === '/api/health' ||
		pathname === '/api/get_public_config' ||
		pathname.startsWith('/api/r2/public/') ||
		pathname === '/api/generate_beta_codes' ||
		pathname === '/api/list_beta_codes'
	)
}

export const betaGateMiddleware: MiddlewareHandler<ApiEnv> = async (
	ctx,
	next
): Promise<Response | void> => {
	if (isBetaPublicPath(ctx.req.path)) {
		return next()
	}
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
