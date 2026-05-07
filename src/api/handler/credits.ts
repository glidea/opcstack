import type { Context } from 'hono'
import { z } from 'zod'
import type { ApiEnv } from '..'
import {
	CREDIT_TRANSACTION_TYPE_MANUAL_GRANT,
	CreditsError,
	CreditsService,
	type CreditTransactionItem
} from '../../credits'
import { PageRequestSchema, parse } from './utils'

export const BindReferralRequestSchema = z.object({
	referral_code: z.string().min(1)
})
export type BindReferralRequest = z.infer<typeof BindReferralRequestSchema>

export const ListCreditTransactionsRequestSchema = PageRequestSchema.extend({
	type: z.string().min(1).optional(),
	source_type: z.string().min(1).optional(),
	source_id: z.string().min(1).optional(),
	created_at_start: z.number().int().optional(),
	created_at_end: z.number().int().optional()
})
export type ListCreditTransactionsRequest = z.infer<typeof ListCreditTransactionsRequestSchema>

export const GenerateCreditCodesRequestSchema = z.object({
	count: z.number().int().min(1).max(200).optional().default(1),
	amount: z.number().int().min(1),
	expires_at: z.number().int().nullable().optional()
})
export type GenerateCreditCodesRequest = z.infer<typeof GenerateCreditCodesRequestSchema>

export const ListCreditCodesRequestSchema = PageRequestSchema.extend({
	code: z.string().min(1).optional(),
	used_by: z.string().min(1).optional(),
	used: z.boolean().optional(),
	amount: z.number().int().min(1).optional(),
	created_at_start: z.number().int().optional(),
	created_at_end: z.number().int().optional(),
	expires_at_start: z.number().int().optional(),
	expires_at_end: z.number().int().optional()
})
export type ListCreditCodesRequest = z.infer<typeof ListCreditCodesRequestSchema>

export const RedeemCreditCodeRequestSchema = z.object({
	code: z.string().min(1)
})
export type RedeemCreditCodeRequest = z.infer<typeof RedeemCreditCodeRequestSchema>

export const AdminGrantCreditsRequestSchema = z.object({
	user_id: z.string().min(1),
	amount: z.number().int().min(1),
	source_id: z.string().min(1),
	description: z.string().min(1).optional(),
	expires_at: z.number().int().nullable().optional()
})
export type AdminGrantCreditsRequest = z.infer<typeof AdminGrantCreditsRequestSchema>

export async function getCreditSummaryHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const env = ctx.env
	const referralEnabled = env.CREDITS_REFERRAL_ENABLED === 'true'
	const dailyCheckinAmount = toPositiveInt(env.CREDITS_DAILY_CHECKIN_AMOUNT)

	try {
		const credits = new CreditsService(ctx.get('db'))
		const summary = await credits.getSummary({
			userId: ctx.get('userId'),
			dailyCheckinAmount,
			referralEnabled
		})
		return ctx.json({
			balance: summary.balance,
			daily_checked_in: summary.dailyCheckedIn,
			daily_checkin_amount: summary.dailyCheckinAmount,
			referral_enabled: summary.referralEnabled,
			referral_code: summary.referralCode,
			invited_count: summary.invitedCount
		})
	} catch (error) {
		if (error instanceof CreditsError && error.code === 'CREDIT_USER_NOT_FOUND') {
			return ctx.json({ code: error.code }, 404)
		}
		throw error
	}
}

export async function listCreditTransactionsHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parse(ctx, ListCreditTransactionsRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	const credits = new CreditsService(ctx.get('db'))
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

	const amount = toPositiveInt(env.CREDITS_DAILY_CHECKIN_AMOUNT)
	if (amount <= 0) {
		return ctx.json({ code: 'INVALID_DAILY_CHECKIN_AMOUNT' }, 400)
	}

	try {
		const credits = new CreditsService(ctx.get('db'))
		const result = await credits.dailyCheckin({
			userId: ctx.get('userId'),
			amount
		})
		return ctx.json({
			balance: result.balance,
			checked_in: result.checkedIn,
			amount: result.amount
		})
	} catch (error) {
		if (error instanceof CreditsError && error.code === 'DAILY_CHECKIN_ALREADY_DONE') {
			return ctx.json({ code: error.code }, 409)
		}
		throw error
	}
}

export async function bindReferralHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const env = ctx.env
	if (env.CREDITS_REFERRAL_ENABLED !== 'true') {
		return ctx.json({})
	}

	const req = await parse(ctx, BindReferralRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REFERRAL_CODE' }, 400)
	}

	const inviterAmount = toPositiveInt(env.CREDITS_REFERRAL_INVITER_AMOUNT)
	const inviteeAmount = toPositiveInt(env.CREDITS_REFERRAL_INVITEE_AMOUNT)
	if (inviterAmount <= 0 || inviteeAmount <= 0) {
		return ctx.json({ code: 'INVALID_REFERRAL_AMOUNT' }, 400)
	}

	try {
		const credits = new CreditsService(ctx.get('db'))
		await credits.bindReferral({
			inviteeUserId: ctx.get('userId'),
			referralCode: req.referral_code,
			inviterAmount,
			inviteeAmount
		})
		return ctx.json({})
	} catch (error) {
		if (error instanceof CreditsError) {
			if (error.code === 'INVALID_REFERRAL_CODE') {
				return ctx.json({ code: error.code }, 400)
			}
			if (error.code === 'REFERRAL_ALREADY_BOUND') {
				return ctx.json({ code: error.code }, 409)
			}
		}
		throw error
	}
}

export async function generateCreditCodesHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parse(ctx, GenerateCreditCodesRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	const credits = new CreditsService(ctx.get('db'))
	const rows = await credits.generateCodes({
		count: req.count,
		amount: req.amount,
		expiresAt: req.expires_at
	})
	return ctx.json({
		codes: rows.map((row) => {
			return {
				id: row.id,
				code: row.code,
				amount: row.amount,
				expires_at: row.expiresAt,
				created_at: row.createdAt
			}
		})
	})
}

export async function listCreditCodesHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parse(ctx, ListCreditCodesRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	const credits = new CreditsService(ctx.get('db'))
	const result = await credits.listCodes({
		limit: req.page_size,
		offset: (req.page - 1) * req.page_size,
		code: req.code,
		usedBy: req.used_by,
		used: req.used,
		amount: req.amount,
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
				amount: row.amount,
				expires_at: row.expiresAt,
				used_by: row.usedBy,
				used_at: row.usedAt,
				created_at: row.createdAt
			}
		}),
		total: result.total
	})
}

export async function redeemCreditCodeHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parse(ctx, RedeemCreditCodeRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_CREDIT_CODE' }, 400)
	}

	try {
		const credits = new CreditsService(ctx.get('db'))
		const result = await credits.redeemCode({
			userId: ctx.get('userId'),
			code: req.code
		})
		return ctx.json({
			balance: result.balance,
			amount: result.amount
		})
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
	const req = await parse(ctx, AdminGrantCreditsRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	try {
		const credits = new CreditsService(ctx.get('db'))
		const result = await credits.grant({
			userId: req.user_id,
			type: CREDIT_TRANSACTION_TYPE_MANUAL_GRANT,
			amount: req.amount,
			sourceType: 'manual_grant',
			sourceId: req.source_id,
			description: req.description,
			expiresAt: req.expires_at
		})
		if (result.duplicated) {
			return ctx.json({ code: 'CREDIT_GRANT_DUPLICATED' }, 409)
		}
		return ctx.json({
			balance: result.balance
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

function toPositiveInt(raw: string | undefined): number {
	const parsed = Number(raw ?? '0')
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return 0
	}
	return Math.floor(parsed)
}

function toApiTransaction(row: CreditTransactionItem): Record<string, unknown> {
	return {
		id: row.id,
		type: row.type,
		amount: row.amount,
		balance_after: row.balanceAfter,
		source_type: row.sourceType,
		source_id: row.sourceId,
		description: row.description,
		expires_at: row.expiresAt,
		created_at: row.createdAt
	}
}
