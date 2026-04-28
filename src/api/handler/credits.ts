import type { Context } from 'hono'
import { z } from 'zod'
import type { ApiEnv } from '..'
import {
	bindReferral,
	CreditsError,
	dailyCheckin,
	generateCreditCodes,
	getCreditSummary,
	listCreditCodes,
	listCreditTransactions,
	redeemCreditCode,
	type CreditTransactionItem
} from '../../credits'
import { parse } from './utils'

export const BindReferralRequestSchema = z.object({
	referral_code: z.string().min(1)
})
export type BindReferralRequest = z.infer<typeof BindReferralRequestSchema>

export const ListCreditTransactionsRequestSchema = z.object({
	limit: z.number().int().min(1).max(100).optional(),
	offset: z.number().int().min(0).optional()
})
export type ListCreditTransactionsRequest = z.infer<typeof ListCreditTransactionsRequestSchema>

export const GenerateCreditCodesRequestSchema = z.object({
	count: z.number().int().min(1).max(200).optional().default(1),
	amount: z.number().int().min(1),
	expires_at: z.number().int().nullable().optional()
})
export type GenerateCreditCodesRequest = z.infer<typeof GenerateCreditCodesRequestSchema>

export const ListCreditCodesRequestSchema = z.object({
	limit: z.number().int().min(1).max(100).optional(),
	offset: z.number().int().min(0).optional()
})
export type ListCreditCodesRequest = z.infer<typeof ListCreditCodesRequestSchema>

export const RedeemCreditCodeRequestSchema = z.object({
	code: z.string().min(1)
})
export type RedeemCreditCodeRequest = z.infer<typeof RedeemCreditCodeRequestSchema>

export async function getCreditSummaryHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const env = ctx.env as unknown as Record<string, string | undefined>
	const referralEnabled = env.CREDITS_REFERRAL_ENABLED === 'true'
	const dailyCheckinAmount = toPositiveInt(env.CREDITS_DAILY_CHECKIN_AMOUNT)

	try {
		const summary = await getCreditSummary({
			db: ctx.get('db'),
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

	const rows = await listCreditTransactions({
		db: ctx.get('db'),
		userId: ctx.get('userId'),
		limit: req.limit,
		offset: req.offset
	})

	return ctx.json({
		transactions: rows.map(toApiTransaction)
	})
}

export async function dailyCheckinHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const env = ctx.env as unknown as Record<string, string | undefined>
	if (env.CREDITS_DAILY_CHECKIN_ENABLED !== 'true') {
		return ctx.json({})
	}

	const amount = toPositiveInt(env.CREDITS_DAILY_CHECKIN_AMOUNT)
	if (amount <= 0) {
		return ctx.json({ code: 'INVALID_DAILY_CHECKIN_AMOUNT' }, 400)
	}

	try {
		const result = await dailyCheckin({
			db: ctx.get('db'),
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
	const env = ctx.env as unknown as Record<string, string | undefined>
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
		await bindReferral({
			db: ctx.get('db'),
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

	const rows = await generateCreditCodes({
		db: ctx.get('db'),
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

	const rows = await listCreditCodes({
		db: ctx.get('db'),
		limit: req.limit,
		offset: req.offset
	})
	return ctx.json({
		codes: rows.map((row) => {
			return {
				id: row.id,
				code: row.code,
				amount: row.amount,
				expires_at: row.expiresAt,
				used_by: row.usedBy,
				used_at: row.usedAt,
				created_at: row.createdAt
			}
		})
	})
}

export async function redeemCreditCodeHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parse(ctx, RedeemCreditCodeRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_CREDIT_CODE' }, 400)
	}

	try {
		const result = await redeemCreditCode({
			db: ctx.get('db'),
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
