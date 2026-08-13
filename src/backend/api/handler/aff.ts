import type { Context } from 'hono'
import type { ApiEnv } from '..'
import { AFF_CREDIT_SOURCE_INVITEE, AFF_CREDIT_SOURCE_INVITER, AffError, AffService } from '../../aff'
import { CreditsService, type CreditTransactionType } from '../../credits'
import { createTenantShardAccess } from '../../db/shard-router'
import type { TenantShardDb } from '../../db'
import { getAffiliateConfig, type AffiliateConfig } from '../../config'
import { parseRequest } from '../../lib/request'
import {
	BindAffApi,
	GetAffSummaryApi,
	ListAdminAffiliateReferralsApi,
	type ListAdminAffiliateReferralsResponse,
	type GetAffSummaryResponse
} from '../../../api-contract/aff'

export async function listAdminAffiliateReferralsHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, ListAdminAffiliateReferralsApi.request)
	if (!request.success) {
		const error = ListAdminAffiliateReferralsApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	const req = request.data
	const result = await new AffService(ctx.get('metaDb')).listReferrals({
		limit: req.page_size,
		offset: (req.page - 1) * req.page_size,
		search: req.search,
		rewardStatus: req.reward_status
	})
	return ctx.json({
		items: result.referrals.map((row) => {
			return {
				id: row.id,
				inviter: { id: row.inviterUserId, name: row.inviterName, email: row.inviterEmail },
				invitee: { id: row.inviteeUserId, name: row.inviteeName, email: row.inviteeEmail },
				reward_status: row.inviterGrantedAt !== null && row.inviteeGrantedAt !== null ? 'completed' : 'pending',
				created_at: row.createdAt
			}
		}),
		total: result.total
	} as ListAdminAffiliateReferralsResponse)
}

export async function getAffSummaryHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const config: AffiliateConfig = await getAffiliateConfig(ctx.get('metaDb'))
	if (!config.enabled) {
		return ctx.json({
			aff_enabled: false,
			aff_code: '',
			invited_count: 0
		} as GetAffSummaryResponse)
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
		} as GetAffSummaryResponse)
	} catch (error) {
		if (error instanceof AffError) {
			switch (error.code) {
				case 'AFF_USER_NOT_FOUND': {
					const response = GetAffSummaryApi.errors.AFF_USER_NOT_FOUND()
					return ctx.json(response.body, response.status)
				}
				default:
					break
			}
		}
		throw error
	}
}

export async function bindAffHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const config: AffiliateConfig = await getAffiliateConfig(ctx.get('metaDb'))
	if (!config.enabled) {
		return ctx.json({})
	}

	const request = await parseRequest(ctx, BindAffApi.request)
	if (!request.success) {
		const error = BindAffApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	const req = request.data

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
				config.inviterCreditAmount,
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
				config.inviteeCreditAmount,
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
			switch (error.code) {
				case 'INVALID_AFF_CODE': {
					const response = BindAffApi.errors.INVALID_AFF_CODE()
					return ctx.json(response.body, response.status)
				}
				case 'AFF_ALREADY_BOUND': {
					const response = BindAffApi.errors.AFF_ALREADY_BOUND()
					return ctx.json(response.body, response.status)
				}
				default:
					break
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
	let db: TenantShardDb
	if (userId === ctx.get('userId')) {
		db = ctx.get('tenantDb')
	} else {
		const tenant = await createTenantShardAccess(ctx.get('metaDb'), ctx.env).openUserDb(userId)
		db = tenant.db
	}

	const credits = new CreditsService(db)
	await credits.grant({
		userId,
		type: sourceType,
		amount,
		sourceType,
		sourceId: `${sourceType}:${affId}`,
		description: 'Affiliate reward'
	})
}
