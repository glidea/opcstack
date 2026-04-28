import { eq } from 'drizzle-orm'
import type { AppDb } from '../db'
import { creditEntry, creditTransaction } from '../db/schema'
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
