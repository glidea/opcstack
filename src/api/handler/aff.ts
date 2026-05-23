import type { Context } from 'hono'
import { z } from 'zod'
import type { ApiEnv } from '..'
import { AFF_CREDIT_SOURCE_INVITEE, AFF_CREDIT_SOURCE_INVITER, AffError, AffService } from '../../aff'
import { CreditsService, type CreditTransactionType } from '../../credits'
import { getShardDb } from '../../db'
import { getTenantD1, resolveUserShard } from '../../db/shard-router'
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
		const aff = new AffService(ctx.get('metaDb'))
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
		const aff = new AffService(ctx.get('metaDb'))
		const result = await aff.bind({
			inviteeUserId: ctx.get('userId'),
			affCode: req.aff_code
		})
		if (result.inviterGrantedAt === null) {
			await grantAffCredits(
				ctx,
				result.inviterUserId,
				inviterAmount,
				AFF_CREDIT_SOURCE_INVITER,
				result.affId
			)
			await aff.markRewardGranted({
				affId: result.affId,
				target: 'inviter'
			})
		}
		if (result.inviteeGrantedAt === null) {
			await grantAffCredits(
				ctx,
				result.inviteeUserId,
				inviteeAmount,
				AFF_CREDIT_SOURCE_INVITEE,
				result.affId
			)
			await aff.markRewardGranted({
				affId: result.affId,
				target: 'invitee'
			})
		}
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

async function grantAffCredits(
	ctx: Context<ApiEnv>,
	userId: string,
	amount: number,
	sourceType: CreditTransactionType,
	affId: string
): Promise<void> {
	const resolved = await resolveUserShard(ctx.get('metaDb'), userId)
	const credits = new CreditsService(getShardDb(getTenantD1(ctx.env, resolved.bindingName)))
	await credits.grant({
		userId,
		type: sourceType,
		amount,
		sourceType,
		sourceId: `${sourceType}:${affId}`,
		description: 'Affiliate reward'
	})
}
