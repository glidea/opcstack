import { eq, sql } from 'drizzle-orm'
import type { AppDb } from '../db'
import { affReferral } from '../db/schema'
import { user } from '../db/schema.auth'
import { addUnits } from '../lib/decimal'

const AFF_TRANSACTION_TYPE_INVITER = 'affiliate_inviter'
const AFF_TRANSACTION_TYPE_INVITEE = 'affiliate_invitee'

export interface GetAffSummaryInput {
	userId: string
}

export interface AffSummary {
	affCode: string
	invitedCount: number
}

export interface BindAffInput {
	inviteeUserId: string
	affCode: string
	inviterCreditAmount: number
	inviteeCreditAmount: number
	nowMs?: number
}

export class AffError extends Error {
	public readonly code: string

	constructor(code: string) {
		super(code)
		this.code = code
	}
}

export class AffService {
	private readonly db: AppDb

	constructor(db: AppDb) {
		this.db = db
	}

	async createCode(): Promise<string> {
		const maxAttempts: number = 10
		let attempt: number = 0
		while (attempt < maxAttempts) {
			const code: string = generateAffCode()
			const existing = await this.db.query.user.findFirst({
				columns: {
					id: true
				},
				where: eq(user.affCode, code)
			})
			if (!existing) {
				return code
			}
			attempt += 1
		}
		throw new AffError('AFF_CODE_GENERATE_FAILED')
	}

	async getSummary(input: GetAffSummaryInput): Promise<AffSummary> {
		const userRow = await this.db.query.user.findFirst({
			columns: {
				affCode: true
			},
			where: eq(user.id, input.userId)
		})
		if (!userRow) {
			throw new AffError('AFF_USER_NOT_FOUND')
		}

		const invitedCountRows = await this.db
			.select({
				count: sql<number>`count(*)`
			})
			.from(affReferral)
			.where(eq(affReferral.inviterUserId, input.userId))
		const invitedCount: number = Number(invitedCountRows[0]?.count ?? 0)

		return {
			affCode: userRow.affCode ?? '',
			invitedCount
		}
	}

	async bind(input: BindAffInput): Promise<void> {
		const code: string = input.affCode.trim()
		if (code === '') {
			throw new AffError('INVALID_AFF_CODE')
		}
		validateCreditAmount(input.inviterCreditAmount)
		validateCreditAmount(input.inviteeCreditAmount)

		const inviter = await this.db.query.user.findFirst({
			columns: {
				id: true,
				creditBalance: true,
				affCode: true
			},
			where: eq(user.affCode, code)
		})
		if (!inviter || inviter.id === input.inviteeUserId) {
			throw new AffError('INVALID_AFF_CODE')
		}

		const invitee = await this.db.query.user.findFirst({
			columns: {
				id: true,
				creditBalance: true
			},
			where: eq(user.id, input.inviteeUserId)
		})
		if (!invitee) {
			throw new AffError('AFF_USER_NOT_FOUND')
		}

		const nowMs: number = input.nowMs ?? Date.now()
		const affId: string = crypto.randomUUID()
		const inviterEntryId: string = crypto.randomUUID()
		const inviteeEntryId: string = crypto.randomUUID()
		const inviterTransactionId: string = crypto.randomUUID()
		const inviteeTransactionId: string = crypto.randomUUID()

		const inviterRemaining: number = resolveEntryRemainingAmount(
			inviter.creditBalance,
			input.inviterCreditAmount
		)
		const inviteeRemaining: number = resolveEntryRemainingAmount(
			invitee.creditBalance,
			input.inviteeCreditAmount
		)
		const inviterBalance: number = addUnits(inviter.creditBalance, input.inviterCreditAmount)
		const inviteeBalance: number = addUnits(invitee.creditBalance, input.inviteeCreditAmount)
		const inviterSourceId: string = `${AFF_TRANSACTION_TYPE_INVITER}:${affId}`
		const inviteeSourceId: string = `${AFF_TRANSACTION_TYPE_INVITEE}:${affId}`

		try {
			await this.db.batch([
				this.db.run(sql`
        INSERT INTO aff_referrals (id, inviter_user_id, invitee_user_id, created_at)
        VALUES (${affId}, ${inviter.id}, ${input.inviteeUserId}, ${nowMs})
      `),
				this.db.run(sql`
        UPDATE "user"
        SET credit_balance = ${inviterBalance}
        WHERE id = ${inviter.id}
          AND EXISTS (SELECT 1 FROM aff_referrals WHERE id = ${affId})
      `),
				this.db.run(sql`
        INSERT INTO credit_entries (
          id,
          user_id,
          amount,
          remaining_amount,
          source_type,
          source_id,
          expires_at,
          created_at
        )
        SELECT
          ${inviterEntryId},
          ${inviter.id},
          ${input.inviterCreditAmount},
          ${inviterRemaining},
          ${AFF_TRANSACTION_TYPE_INVITER},
          ${inviterSourceId},
          NULL,
          ${nowMs}
        WHERE EXISTS (SELECT 1 FROM aff_referrals WHERE id = ${affId})
      `),
				this.db.run(sql`
        INSERT INTO credit_transactions (
          id,
          user_id,
          type,
          amount,
          balance_after,
          source_type,
          source_id,
          description,
          expires_at,
          created_at
        )
        SELECT
          ${inviterTransactionId},
          ${inviter.id},
          ${AFF_TRANSACTION_TYPE_INVITER},
          ${input.inviterCreditAmount},
          ${inviterBalance},
          ${AFF_TRANSACTION_TYPE_INVITER},
          ${inviterSourceId},
          'Affiliate inviter reward',
          NULL,
          ${nowMs}
        WHERE EXISTS (SELECT 1 FROM aff_referrals WHERE id = ${affId})
      `),
				this.db.run(sql`
        UPDATE "user"
        SET credit_balance = ${inviteeBalance}
        WHERE id = ${input.inviteeUserId}
          AND EXISTS (SELECT 1 FROM aff_referrals WHERE id = ${affId})
      `),
				this.db.run(sql`
        INSERT INTO credit_entries (
          id,
          user_id,
          amount,
          remaining_amount,
          source_type,
          source_id,
          expires_at,
          created_at
        )
        SELECT
          ${inviteeEntryId},
          ${input.inviteeUserId},
          ${input.inviteeCreditAmount},
          ${inviteeRemaining},
          ${AFF_TRANSACTION_TYPE_INVITEE},
          ${inviteeSourceId},
          NULL,
          ${nowMs}
        WHERE EXISTS (SELECT 1 FROM aff_referrals WHERE id = ${affId})
      `),
				this.db.run(sql`
        INSERT INTO credit_transactions (
          id,
          user_id,
          type,
          amount,
          balance_after,
          source_type,
          source_id,
          description,
          expires_at,
          created_at
        )
        SELECT
          ${inviteeTransactionId},
          ${input.inviteeUserId},
          ${AFF_TRANSACTION_TYPE_INVITEE},
          ${input.inviteeCreditAmount},
          ${inviteeBalance},
          ${AFF_TRANSACTION_TYPE_INVITEE},
          ${inviteeSourceId},
          'Affiliate invitee reward',
          NULL,
          ${nowMs}
        WHERE EXISTS (SELECT 1 FROM aff_referrals WHERE id = ${affId})
      `)
			])
		} catch (error) {
			if (isAffAlreadyBoundError(error)) {
				throw new AffError('AFF_ALREADY_BOUND')
			}
			throw error
		}
	}
}

function validateCreditAmount(amount: number): void {
	if (!Number.isSafeInteger(amount) || amount <= 0) {
		throw new AffError('INVALID_AFF_AMOUNT')
	}
}

function generateAffCode(): string {
	const raw: string = crypto.randomUUID().replaceAll('-', '').slice(0, 8)
	return raw.toUpperCase()
}

function resolveEntryRemainingAmount(currentBalance: number, amount: number): number {
	const debtToRepay: number = currentBalance < 0 ? Math.min(-currentBalance, amount) : 0
	return amount - debtToRepay
}

function isAffAlreadyBoundError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false
	}
	return (
		error.message.includes('aff_referrals_invitee_user_id_unique') ||
		error.message.includes('UNIQUE constraint failed: aff_referrals.invitee_user_id')
	)
}
