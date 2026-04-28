import { and, desc, eq, gte, lt, sql } from 'drizzle-orm'
import type { AppDb } from '../db'
import { creditEntry, creditRedemptionCode, creditReferral, creditTransaction } from '../db/schema'
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

export interface DailyCheckinResult {
	balance: number
	checkedIn: boolean
	amount: number
}

export interface BindReferralResult {
	inviterUserId: string
	inviteeUserId: string
	inviterBalance: number
	inviteeBalance: number
}

export interface GenerateCreditCodesResultCode {
	id: string
	code: string
	amount: number
	expiresAt: number | null
	createdAt: number
}

export interface ListCreditCodeItem {
	id: string
	code: string
	amount: number
	expiresAt: number | null
	usedBy: string | null
	usedAt: number | null
	createdAt: number
}

export interface RedeemCreditCodeResult {
	balance: number
	amount: number
}

export interface EnsureEnoughCreditsResult {
	balance: number
}

export interface DeductCreditsResult {
	balance: number
	deductedAmount: number
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

export async function dailyCheckin(input: {
	db: AppDb
	userId: string
	amount: number
	nowMs?: number
}): Promise<DailyCheckinResult> {
	validateGrantAmount(input.amount)
	const nowMs = input.nowMs ?? Date.now()
	const sourceId = `${input.userId}:${formatUtcDate(nowMs)}`
	const result = await grantCredits({
		db: input.db,
		userId: input.userId,
		type: 'daily_checkin',
		amount: input.amount,
		sourceType: 'daily_checkin',
		sourceId,
		description: 'Daily check-in reward'
	})
	if (result.duplicated) {
		throw new CreditsError('DAILY_CHECKIN_ALREADY_DONE')
	}
	return {
		balance: result.balance,
		checkedIn: true,
		amount: input.amount
	}
}

export async function bindReferral(input: {
	db: AppDb
	inviteeUserId: string
	referralCode: string
	inviterAmount: number
	inviteeAmount: number
	nowMs?: number
}): Promise<BindReferralResult> {
	const code = input.referralCode.trim()
	if (code === '') {
		throw new CreditsError('INVALID_REFERRAL_CODE')
	}
	validateGrantAmount(input.inviterAmount)
	validateGrantAmount(input.inviteeAmount)

	const inviter = await input.db.query.user.findFirst({
		columns: {
			id: true,
			creditBalance: true
		},
		where: eq(user.referralCode, code)
	})
	if (!inviter || inviter.id === input.inviteeUserId) {
		throw new CreditsError('INVALID_REFERRAL_CODE')
	}

	const invitee = await input.db.query.user.findFirst({
		columns: {
			id: true,
			creditBalance: true
		},
		where: eq(user.id, input.inviteeUserId)
	})
	if (!invitee) {
		throw new CreditsError('CREDIT_USER_NOT_FOUND')
	}

	const nowMs = input.nowMs ?? Date.now()
	const referralId = crypto.randomUUID()
	const inviterEntryId = crypto.randomUUID()
	const inviteeEntryId = crypto.randomUUID()
	const inviterTransactionId = crypto.randomUUID()
	const inviteeTransactionId = crypto.randomUUID()

	const inviterRemaining = resolveEntryRemainingAmount(inviter.creditBalance, input.inviterAmount)
	const inviteeRemaining = resolveEntryRemainingAmount(invitee.creditBalance, input.inviteeAmount)
	const inviterBalance = inviter.creditBalance + input.inviterAmount
	const inviteeBalance = invitee.creditBalance + input.inviteeAmount

	try {
		await input.db.batch([
			input.db.run(sql`
        INSERT INTO credit_referrals (id, inviter_user_id, invitee_user_id, created_at)
        VALUES (${referralId}, ${inviter.id}, ${input.inviteeUserId}, ${nowMs})
      `),
			input.db.run(sql`
        UPDATE "user"
        SET credit_balance = ${inviterBalance}
        WHERE id = ${inviter.id}
          AND EXISTS (SELECT 1 FROM credit_referrals WHERE id = ${referralId})
      `),
			input.db.run(sql`
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
          ${input.inviterAmount},
          ${inviterRemaining},
          'referral_inviter',
          ${`referral_inviter:${referralId}`},
          NULL,
          ${nowMs}
        WHERE EXISTS (SELECT 1 FROM credit_referrals WHERE id = ${referralId})
      `),
			input.db.run(sql`
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
          'referral_inviter',
          ${input.inviterAmount},
          ${inviterBalance},
          'referral_inviter',
          ${`referral_inviter:${referralId}`},
          'Referral inviter reward',
          NULL,
          ${nowMs}
        WHERE EXISTS (SELECT 1 FROM credit_referrals WHERE id = ${referralId})
      `),
			input.db.run(sql`
        UPDATE "user"
        SET credit_balance = ${inviteeBalance}
        WHERE id = ${input.inviteeUserId}
          AND EXISTS (SELECT 1 FROM credit_referrals WHERE id = ${referralId})
      `),
			input.db.run(sql`
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
          ${input.inviteeAmount},
          ${inviteeRemaining},
          'referral_invitee',
          ${`referral_invitee:${referralId}`},
          NULL,
          ${nowMs}
        WHERE EXISTS (SELECT 1 FROM credit_referrals WHERE id = ${referralId})
      `),
			input.db.run(sql`
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
          'referral_invitee',
          ${input.inviteeAmount},
          ${inviteeBalance},
          'referral_invitee',
          ${`referral_invitee:${referralId}`},
          'Referral invitee reward',
          NULL,
          ${nowMs}
        WHERE EXISTS (SELECT 1 FROM credit_referrals WHERE id = ${referralId})
      `)
		])
	} catch (error) {
		if (isReferralAlreadyBoundError(error)) {
			throw new CreditsError('REFERRAL_ALREADY_BOUND')
		}
		throw error
	}

	return {
		inviterUserId: inviter.id,
		inviteeUserId: input.inviteeUserId,
		inviterBalance,
		inviteeBalance
	}
}

export async function generateCreditCodes(input: {
	db: AppDb
	count: number
	amount: number
	expiresAt?: number | null
	nowMs?: number
}): Promise<GenerateCreditCodesResultCode[]> {
	if (!Number.isInteger(input.count) || input.count <= 0) {
		throw new CreditsError('INVALID_GENERATE_COUNT')
	}
	validateGrantAmount(input.amount)

	const nowMs = input.nowMs ?? Date.now()
	const rows: Array<{
		id: string
		code: string
		amount: number
		expiresAt: number | null
		createdAt: number
	}> = []
	let index = 0
	while (index < input.count) {
		rows.push({
			id: crypto.randomUUID(),
			code: generateCreditCode(),
			amount: input.amount,
			expiresAt: input.expiresAt ?? null,
			createdAt: nowMs
		})
		index += 1
	}

	await input.db.insert(creditRedemptionCode).values(
		rows.map((row) => {
			return {
				id: row.id,
				code: row.code,
				amount: row.amount,
				expiresAt: row.expiresAt,
				createdAt: row.createdAt
			}
		})
	)

	return rows.map((row) => {
		return {
			id: row.id,
			code: row.code,
			amount: row.amount,
			expiresAt: row.expiresAt,
			createdAt: row.createdAt
		}
	})
}

export async function listCreditCodes(input: {
	db: AppDb
	limit?: number
	offset?: number
}): Promise<ListCreditCodeItem[]> {
	const limit = resolvePageLimit(input.limit)
	const offset = resolveOffset(input.offset)
	const rows = await input.db.query.creditRedemptionCode.findMany({
		columns: {
			id: true,
			code: true,
			amount: true,
			expiresAt: true,
			usedBy: true,
			usedAt: true,
			createdAt: true
		},
		orderBy: [desc(creditRedemptionCode.createdAt)],
		limit,
		offset
	})

	return rows.map((row) => {
		return {
			id: row.id,
			code: row.code,
			amount: row.amount,
			expiresAt: row.expiresAt,
			usedBy: row.usedBy,
			usedAt: row.usedAt,
			createdAt: row.createdAt
		}
	})
}

export async function redeemCreditCode(input: {
	db: AppDb
	userId: string
	code: string
	nowMs?: number
}): Promise<RedeemCreditCodeResult> {
	const normalizedCode = input.code.trim().toUpperCase()
	if (normalizedCode === '') {
		throw new CreditsError('INVALID_CREDIT_CODE')
	}
	const nowMs = input.nowMs ?? Date.now()

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

	const codeRow = await input.db.query.creditRedemptionCode.findFirst({
		columns: {
			id: true,
			amount: true,
			expiresAt: true,
			usedBy: true
		},
		where: eq(creditRedemptionCode.code, normalizedCode)
	})
	if (!codeRow) {
		throw new CreditsError('INVALID_CREDIT_CODE')
	}
	if (codeRow.expiresAt !== null && codeRow.expiresAt <= nowMs) {
		throw new CreditsError('INVALID_CREDIT_CODE')
	}
	if (codeRow.usedBy !== null) {
		throw new CreditsError('CREDIT_CODE_USED')
	}

	const amount = codeRow.amount
	const balance = userRow.creditBalance + amount
	const remainingAmount = resolveEntryRemainingAmount(userRow.creditBalance, amount)
	const entryId = crypto.randomUUID()
	const transactionId = crypto.randomUUID()

	const batchResults = await input.db.batch([
		input.db.run(sql`
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
        ${entryId},
        ${input.userId},
        ${amount},
        ${remainingAmount},
        'redemption_code',
        ${codeRow.id},
        NULL,
        ${nowMs}
      FROM credit_redemption_codes
      WHERE id = ${codeRow.id}
        AND used_by IS NULL
        AND (expires_at IS NULL OR expires_at > ${nowMs})
    `),
		input.db.run(sql`
      UPDATE credit_redemption_codes
      SET used_by = ${input.userId}, used_at = ${nowMs}
      WHERE id = ${codeRow.id}
        AND EXISTS (SELECT 1 FROM credit_entries WHERE id = ${entryId})
    `),
		input.db.run(sql`
      UPDATE "user"
      SET credit_balance = ${balance}
      WHERE id = ${input.userId}
        AND EXISTS (SELECT 1 FROM credit_entries WHERE id = ${entryId})
    `),
		input.db.run(sql`
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
        ${transactionId},
        ${input.userId},
        'redemption_code',
        ${amount},
        ${balance},
        'redemption_code',
        ${codeRow.id},
        'Redeem credit code',
        NULL,
        ${nowMs}
      WHERE EXISTS (SELECT 1 FROM credit_entries WHERE id = ${entryId})
    `)
	])

	const changes = readBatchChanges(batchResults[0])
	if (changes === 0) {
		throw new CreditsError('CREDIT_CODE_USED')
	}

	return {
		balance,
		amount
	}
}

export async function ensureEnoughCredits(input: {
	db: AppDb
	userId: string
	amount: number
}): Promise<EnsureEnoughCreditsResult> {
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
	if (userRow.creditBalance < input.amount) {
		throw new CreditsError('INSUFFICIENT_CREDITS')
	}
	return {
		balance: userRow.creditBalance
	}
}

export async function deductCredits(input: {
	db: AppDb
	userId: string
	amount: number
	sourceType: string
	sourceId: string
	description?: string
	nowMs?: number
}): Promise<DeductCreditsResult> {
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
	const nextBalance = userRow.creditBalance - input.amount

	const entries = await input.db.all<{
		id: string
		remaining_amount: number
	}>(sql`
    SELECT id, remaining_amount
    FROM credit_entries
    WHERE user_id = ${input.userId}
      AND remaining_amount > 0
    ORDER BY
      CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END ASC,
      expires_at ASC,
      created_at ASC
  `)

	const updateStatements: Array<ReturnType<AppDb['run']>> = []
	let remaining = input.amount
	for (const entry of entries) {
		if (remaining <= 0) {
			break
		}
		const used = Math.min(entry.remaining_amount, remaining)
		const nextRemaining = entry.remaining_amount - used
		updateStatements.push(
			input.db.run(sql`
        UPDATE credit_entries
        SET remaining_amount = ${nextRemaining}
        WHERE id = ${entry.id}
      `)
		)
		remaining -= used
	}

	const transactionId = crypto.randomUUID()
	const statements: [ReturnType<AppDb['run']>, ...Array<ReturnType<AppDb['run']>>] = [
		input.db.run(sql`
      UPDATE "user"
      SET credit_balance = ${nextBalance}
      WHERE id = ${input.userId}
    `),
		...updateStatements,
		input.db.run(sql`
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
      VALUES (
        ${transactionId},
        ${input.userId},
        'consume',
        ${-input.amount},
        ${nextBalance},
        ${input.sourceType},
        ${input.sourceId},
        ${input.description ?? null},
        NULL,
        ${nowMs}
      )
    `)
	]

	await input.db.batch(statements)
	return {
		balance: nextBalance,
		deductedAmount: input.amount
	}
}

export async function runPaidActionWithCredits<T>(input: {
	db: AppDb
	userId: string
	amount: number
	sourceType: string
	sourceId: string
	description?: string
	execute: () => Promise<T>
}): Promise<T> {
	await ensureEnoughCredits({
		db: input.db,
		userId: input.userId,
		amount: input.amount
	})

	const result = await input.execute()
	await deductCredits({
		db: input.db,
		userId: input.userId,
		amount: input.amount,
		sourceType: input.sourceType,
		sourceId: input.sourceId,
		description: input.description
	})
	return result
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

function resolveEntryRemainingAmount(currentBalance: number, amount: number): number {
	const debtToRepay = currentBalance < 0 ? Math.min(-currentBalance, amount) : 0
	return amount - debtToRepay
}

function isReferralAlreadyBoundError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false
	}
	return (
		error.message.includes('credit_referrals_invitee_user_id_unique') ||
		error.message.includes('UNIQUE constraint failed: credit_referrals.invitee_user_id')
	)
}

function formatUtcDate(timestampMs: number): string {
	const date = new Date(timestampMs)
	const year = date.getUTCFullYear()
	const month = String(date.getUTCMonth() + 1).padStart(2, '0')
	const day = String(date.getUTCDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

function generateCreditCode(): string {
	return crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
}

function readBatchChanges(result: unknown): number {
	const row = result as { meta?: { changes?: number } }
	return Number(row.meta?.changes ?? 0)
}
