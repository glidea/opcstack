import type { Context } from 'hono'
import type { ApiEnv } from '..'
import {
	AdminGrantCreditsRequestSchema,
	GenerateCreditCodesRequestSchema,
	ListCreditCodesRequestSchema,
	ListCreditTransactionsRequestSchema,
	RedeemCreditCodeRequestSchema
} from '../../../api-contract/credits'
import {
	CREDIT_TRANSACTION_TYPE_MANUAL_GRANT,
	CREDIT_TRANSACTION_TYPE_REDEMPTION_CODE,
	CreditRedemptionService,
	CreditsError,
	CreditsService,
	type CreditTransactionItem
} from '../../credits'
import { createTenantShardAccess } from '../../db/shard-router'
import { formatDecimal, parseDecimal } from '../../lib/decimal'
import { parseRequest } from '../../lib/request'

export async function getCreditSummaryHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const env = ctx.env
	const dailyCheckinAmount = toCreditUnits(env.CREDITS_DAILY_CHECKIN_AMOUNT)

	try {
		const credits = new CreditsService(ctx.get('tenantDb'))
		const summary = await credits.getSummary({
			userId: ctx.get('userId'),
			dailyCheckinAmount
		})
		return ctx.json({
			balance: formatCreditAmount(summary.balance),
			daily_checked_in: summary.dailyCheckedIn,
			daily_checkin_amount: formatCreditAmount(summary.dailyCheckinAmount)
		})
	} catch (error) {
		if (error instanceof CreditsError && error.code === 'CREDIT_USER_NOT_FOUND') {
			return ctx.json({ code: error.code }, 404)
		}
		throw error
	}
}

export async function listCreditTransactionsHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parseRequest(ctx, ListCreditTransactionsRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	const credits = new CreditsService(ctx.get('tenantDb'))
	const result = await credits.listTransactions({
		userId: ctx.get('userId'),
		limit: req.page_size,
		offset: (req.page - 1) * req.page_size,
		type: req.type,
		sourceType: req.source_type,
		sourceId: req.source_id,
		createdAtStart: req.created_at_start,
		createdAtEnd: req.created_at_end
	})

	return ctx.json({
		items: result.transactions.map(toApiTransaction),
		total: result.total
	})
}

export async function dailyCheckinHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const env = ctx.env
	if (env.CREDITS_DAILY_CHECKIN_ENABLED !== 'true') {
		return ctx.json({})
	}

	const amount = toCreditUnits(env.CREDITS_DAILY_CHECKIN_AMOUNT)
	if (amount <= 0) {
		return ctx.json({ code: 'INVALID_DAILY_CHECKIN_AMOUNT' }, 400)
	}

	try {
		const credits = new CreditsService(ctx.get('tenantDb'))
		const result = await credits.dailyCheckin({
			userId: ctx.get('userId'),
			amount
		})
		return ctx.json({
			balance: formatCreditAmount(result.balance),
			checked_in: result.checkedIn,
			amount: formatCreditAmount(result.amount)
		})
	} catch (error) {
		if (error instanceof CreditsError && error.code === 'DAILY_CHECKIN_ALREADY_DONE') {
			return ctx.json({ code: error.code }, 409)
		}
		throw error
	}
}

export async function generateCreditCodesHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parseRequest(ctx, GenerateCreditCodesRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	const amount = toCreditUnits(req.amount)
	if (amount <= 0) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	const redemptions = new CreditRedemptionService(ctx.get('metaDb'))
	const rows = await redemptions.generateCodes({
		count: req.count,
		amount,
		expiresAt: req.expires_at
	})
	return ctx.json({
		codes: rows.map((row) => {
			return {
				id: row.id,
				code: row.code,
				amount: formatCreditAmount(row.amount),
				expires_at: row.expiresAt,
				created_at: row.createdAt
			}
		})
	})
}

export async function listCreditCodesHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parseRequest(ctx, ListCreditCodesRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	const amount = req.amount === undefined ? undefined : toCreditUnits(req.amount)
	if (req.amount !== undefined && (!amount || amount <= 0)) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	const redemptions = new CreditRedemptionService(ctx.get('metaDb'))
	const result = await redemptions.listCodes({
		limit: req.page_size,
		offset: (req.page - 1) * req.page_size,
		code: req.code,
		claimedBy: req.claimed_by,
		status: req.status,
		amount,
		createdAtStart: req.created_at_start,
		createdAtEnd: req.created_at_end,
		expiresAtStart: req.expires_at_start,
		expiresAtEnd: req.expires_at_end
	})
	return ctx.json({
		items: result.codes.map((row) => {
			return {
				id: row.id,
				code: row.code,
				amount: formatCreditAmount(row.amount),
				status: row.status,
				expires_at: row.expiresAt,
				claimed_by: row.claimedBy,
				claimed_at: row.claimedAt,
				granted_at: row.grantedAt,
				created_at: row.createdAt
			}
		}),
		total: result.total
	})
}

export async function redeemCreditCodeHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parseRequest(ctx, RedeemCreditCodeRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_CREDIT_CODE' }, 400)
	}

	const redemptions = new CreditRedemptionService(ctx.get('metaDb'))
	try {
		const claimed = await redemptions.claimCode({
			userId: ctx.get('userId'),
			code: req.code
		})
		const credits = new CreditsService(ctx.get('tenantDb'))
		try {
			const result = await credits.grant({
				userId: ctx.get('userId'),
				type: CREDIT_TRANSACTION_TYPE_REDEMPTION_CODE,
				amount: claimed.amount,
				sourceType: 'redemption_code',
				sourceId: claimed.id,
				description: 'Redeem credit code'
			})
			await redemptions.markGranted({
				codeId: claimed.id,
				userId: ctx.get('userId')
			})
			return ctx.json({
				balance: formatCreditAmount(result.balance),
				amount: formatCreditAmount(claimed.amount)
			})
		} catch {
			return ctx.json({ code: 'CREDIT_GRANT_PENDING' }, 202)
		}
	} catch (error) {
		if (error instanceof CreditsError) {
			if (error.code === 'CREDIT_CODE_USED') {
				return ctx.json({ code: error.code }, 409)
			}
			if (error.code === 'INVALID_CREDIT_CODE') {
				return ctx.json({ code: error.code }, 400)
			}
		}
		throw error
	}
}

export async function grantCreditsHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parseRequest(ctx, AdminGrantCreditsRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	const amount = toCreditUnits(req.amount)
	if (amount <= 0) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	try {
		const tenant = await createTenantShardAccess(ctx.get('metaDb'), ctx.env).openUserDb(req.user_id)
		const credits = new CreditsService(tenant.db)
		const result = await credits.grant({
			userId: req.user_id,
			type: CREDIT_TRANSACTION_TYPE_MANUAL_GRANT,
			amount,
			sourceType: 'manual_grant',
			sourceId: req.source_id,
			description: req.description,
			expiresAt: req.expires_at
		})
		if (result.duplicated) {
			return ctx.json({ code: 'CREDIT_GRANT_DUPLICATED' }, 409)
		}
		return ctx.json({
			balance: formatCreditAmount(result.balance)
		})
	} catch (error) {
		if (error instanceof CreditsError) {
			if (error.code === 'CREDIT_USER_NOT_FOUND') {
				return ctx.json({ code: error.code }, 404)
			}
			if (error.code === 'INVALID_CREDIT_AMOUNT') {
				return ctx.json({ code: error.code }, 400)
			}
		}
		throw error
	}
}

function toCreditUnits(raw: string | undefined): number {
	if (!raw) {
		return 0
	}
	try {
		return parseDecimal(raw)
	} catch {
		return 0
	}
}

function formatCreditAmount(units: number): string {
	return formatDecimal(units)
}

function toApiTransaction(row: CreditTransactionItem): Record<string, unknown> {
	return {
		id: row.id,
		type: row.type,
		amount: formatCreditAmount(row.amount),
		balance_after: formatCreditAmount(row.balanceAfter),
		source_type: row.sourceType,
		source_id: row.sourceId,
		description: row.description,
		expires_at: row.expiresAt,
		created_at: row.createdAt
	}
}
