import type { Context } from 'hono'
import { z } from 'zod'
import type { ApiEnv } from '..'
import { AffError, AffService } from '../../aff'
import { parseDecimal } from '../../lib/decimal'
import { parseRequest } from '../../lib/request'

export const BindAffRequestSchema = z.object({
	aff_code: z.string().min(1)
})
export type BindAffRequest = z.infer<typeof BindAffRequestSchema>

export async function getAffSummaryHandler(ctx: Context<ApiEnv>): Promise<Response> {
	if (ctx.env.AFF_ENABLED !== 'true') {
		return ctx.json({
			aff_enabled: false,
			aff_code: '',
			invited_count: 0
		})
	}

	try {
		const aff = new AffService(ctx.get('db'))
		const summary = await aff.getSummary({
			userId: ctx.get('userId')
		})
		return ctx.json({
			aff_enabled: true,
			aff_code: summary.affCode,
			invited_count: summary.invitedCount
		})
	} catch (error) {
		if (error instanceof AffError && error.code === 'AFF_USER_NOT_FOUND') {
			return ctx.json({ code: error.code }, 404)
		}
		throw error
	}
}

export async function bindAffHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const env = ctx.env
	if (env.AFF_ENABLED !== 'true') {
		return ctx.json({})
	}

	const req = await parseRequest(ctx, BindAffRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_AFF_CODE' }, 400)
	}

	const inviterAmount: number = parseDecimal(env.AFF_INVITER_CREDIT_AMOUNT)
	const inviteeAmount: number = parseDecimal(env.AFF_INVITEE_CREDIT_AMOUNT)

	try {
		const aff = new AffService(ctx.get('db'))
		await aff.bind({
			inviteeUserId: ctx.get('userId'),
			affCode: req.aff_code,
			inviterCreditAmount: inviterAmount,
			inviteeCreditAmount: inviteeAmount
		})
		return ctx.json({})
	} catch (error) {
		if (error instanceof AffError) {
			if (error.code === 'INVALID_AFF_CODE') {
				return ctx.json({ code: error.code }, 400)
			}
			if (error.code === 'AFF_ALREADY_BOUND') {
				return ctx.json({ code: error.code }, 409)
			}
		}
		throw error
	}
}
