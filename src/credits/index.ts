import { and, desc, eq, gte, lt, sql } from 'drizzle-orm'
import type { AppDb } from '../db'
import { creditEntry, creditReferral, creditTransaction } from '../db/schema'
import { user } from '../db/schema.auth'

export type CreditTransactionType =
	| 'signup'
	| 'daily_checkin'
	| 'referral_inviter'
	| 'referral_invitee'
	| 'redemption_code'
	| 'manual_grant'
	| 'consume'
	| 'expired'

export interface GrantCreditsInput {
	db: AppDb
	userId: string
	type: CreditTransactionType
	amount: number
	sourceType: string
	sourceId: string
	description?: string
	expiresAt?: number | null
	nowMs?: number
}

export interface GrantCreditsResult {
	balance: number
	entryId: string
	transactionId: string
	entryRemainingAmount: number
	duplicated: boolean
}

export interface CreditSummary {
	balance: number
	dailyCheckedIn: boolean
	dailyCheckinAmount: number
	referralEnabled: boolean
	referralCode: string
	invitedCount: number
}

export interface ListCreditTransactionsInput {
	db: AppDb
	userId: string
	limit?: number
	offset?: number
}

export interface CreditTransactionItem {
	id: string
	type: string
	amount: number
	balanceAfter: number
	sourceType: string | null
	sourceId: string | null
	description: string | null
	expiresAt: number | null
	createdAt: number
}

export class CreditsError extends Error {
	public readonly code: string

	constructor(code: string) {
		super(code)
		this.code = code
	}
}

export async function grantCredits(input: GrantCreditsInput): Promise<GrantCreditsResult> {
	validateGrantAmount(input.amount)

	const userRow = await input.db.query.user.findFirst({
		columns: {
			id: true,
			creditBalance: true
		},
		where: eq(user.id, input.userId)
	})
	if (!userRow) {
		throw new CreditsError('CREDIT_USER_NOT_FOUND')
	}

	const nowMs = input.nowMs ?? Date.now()
	const currentBalance = userRow.creditBalance
	const nextBalance = currentBalance + input.amount
	const debtToRepay = currentBalance < 0 ? Math.min(-currentBalance, input.amount) : 0
	const remainingAmount = input.amount - debtToRepay

	const entryId = crypto.randomUUID()
	const transactionId = crypto.randomUUID()

	try {
		await input.db.batch([
			input.db
				.update(user)
				.set({
					creditBalance: nextBalance
				})
				.where(eq(user.id, input.userId)),
			input.db.insert(creditEntry).values({
				id: entryId,
				userId: input.userId,
				amount: input.amount,
				remainingAmount,
				sourceType: input.sourceType,
				sourceId: input.sourceId,
				expiresAt: input.expiresAt ?? null,
				createdAt: nowMs
			}),
			input.db.insert(creditTransaction).values({
				id: transactionId,
				userId: input.userId,
				type: input.type,
				amount: input.amount,
				balanceAfter: nextBalance,
				sourceType: input.sourceType,
				sourceId: input.sourceId,
				description: input.description,
				expiresAt: input.expiresAt ?? null,
				createdAt: nowMs
			})
		])
	} catch (error) {
		if (isDuplicatedGrantError(error)) {
			return {
				balance: currentBalance,
				entryId: '',
				transactionId: '',
				entryRemainingAmount: 0,
				duplicated: true
			}
		}
		throw error
	}

	return {
		balance: nextBalance,
		entryId,
		transactionId,
		entryRemainingAmount: remainingAmount,
		duplicated: false
	}
}

export async function createReferralCode(db: AppDb): Promise<string> {
	const maxAttempts = 10
	let attempt = 0
	while (attempt < maxAttempts) {
		const code = generateReferralCode()
		const existing = await db.query.user.findFirst({
			columns: {
				id: true
			},
			where: eq(user.referralCode, code)
		})
		if (!existing) {
			return code
		}
		attempt += 1
	}
	throw new CreditsError('REFERRAL_CODE_GENERATE_FAILED')
}

export async function getCreditSummary(input: {
	db: AppDb
	userId: string
	nowMs?: number
	dailyCheckinAmount: number
	referralEnabled: boolean
}): Promise<CreditSummary> {
	const userRow = await input.db.query.user.findFirst({
		columns: {
			creditBalance: true,
			referralCode: true
		},
		where: eq(user.id, input.userId)
	})
	if (!userRow) {
		throw new CreditsError('CREDIT_USER_NOT_FOUND')
	}

	const nowMs = input.nowMs ?? Date.now()
	const dayRange = getUtcDayRange(nowMs)
	const checkedInRow = await input.db.query.creditTransaction.findFirst({
		columns: {
			id: true
		},
		where: and(
			eq(creditTransaction.userId, input.userId),
			eq(creditTransaction.type, 'daily_checkin'),
			gte(creditTransaction.createdAt, dayRange.dayStartMs),
			lt(creditTransaction.createdAt, dayRange.dayEndMs)
		)
	})

	const invitedCountRows = await input.db
		.select({
			count: sql<number>`count(*)`
		})
		.from(creditReferral)
		.where(eq(creditReferral.inviterUserId, input.userId))
	const invitedCount = Number(invitedCountRows[0]?.count ?? 0)

	return {
		balance: userRow.creditBalance,
		dailyCheckedIn: Boolean(checkedInRow),
		dailyCheckinAmount: input.dailyCheckinAmount,
		referralEnabled: input.referralEnabled,
		referralCode: userRow.referralCode ?? '',
		invitedCount
	}
}

export async function listCreditTransactions(
	input: ListCreditTransactionsInput
): Promise<CreditTransactionItem[]> {
	const limit = resolvePageLimit(input.limit)
	const offset = resolveOffset(input.offset)

	const rows = await input.db.query.creditTransaction.findMany({
		columns: {
			id: true,
			type: true,
			amount: true,
			balanceAfter: true,
			sourceType: true,
			sourceId: true,
			description: true,
			expiresAt: true,
			createdAt: true
		},
		where: eq(creditTransaction.userId, input.userId),
		orderBy: [desc(creditTransaction.createdAt)],
		limit,
		offset
	})

	return rows.map((row) => {
		return {
			id: row.id,
			type: row.type,
			amount: row.amount,
			balanceAfter: row.balanceAfter,
			sourceType: row.sourceType,
			sourceId: row.sourceId,
			description: row.description,
			expiresAt: row.expiresAt,
			createdAt: row.createdAt
		}
	})
}

function validateGrantAmount(amount: number): void {
	if (!Number.isInteger(amount) || amount <= 0) {
		throw new CreditsError('INVALID_CREDIT_AMOUNT')
	}
}

function isDuplicatedGrantError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false
	}
	return (
		error.message.includes('credit_entries_source_type_source_id_unique') ||
		error.message.includes('UNIQUE constraint failed: credit_entries.source_type, credit_entries.source_id')
	)
}

function generateReferralCode(): string {
	const raw = crypto.randomUUID().replaceAll('-', '').slice(0, 8)
	return raw.toUpperCase()
}

function getUtcDayRange(nowMs: number): { dayStartMs: number; dayEndMs: number } {
	const date = new Date(nowMs)
	const dayStartMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
	return {
		dayStartMs,
		dayEndMs: dayStartMs + 24 * 60 * 60 * 1000
	}
}

function resolvePageLimit(limit: number | undefined): number {
	if (!Number.isInteger(limit) || !limit || limit <= 0) {
		return 20
	}
	return Math.min(limit, 100)
}

function resolveOffset(offset: number | undefined): number {
	if (!Number.isInteger(offset) || !offset || offset < 0) {
		return 0
	}
	return offset
}
