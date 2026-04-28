import type { Context } from 'hono'
import { z } from 'zod'
import type { ApiEnv } from '..'
import {
	CreditsError,
	getCreditSummary,
	listCreditTransactions,
	type CreditTransactionItem
} from '../../credits'
import { parse } from './utils'

export const ListCreditTransactionsRequestSchema = z.object({
	limit: z.number().int().min(1).max(100).optional(),
	offset: z.number().int().min(0).optional()
})
export type ListCreditTransactionsRequest = z.infer<typeof ListCreditTransactionsRequestSchema>

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
