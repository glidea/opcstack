import { and, desc, eq, gte, isNotNull, isNull, lt, lte, sql, type SQL } from 'drizzle-orm'
import { runRawD1Batch, type AppDb } from '../db'
import { creditEntry, creditRedemptionCode, creditTransaction } from '../db/schema'
import { user } from '../db/schema.auth'
import { addUnits, subtractUnits } from '../lib/decimal'

export const CREDIT_TRANSACTION_TYPE_SIGNUP = 'signup'
export const CREDIT_TRANSACTION_TYPE_DAILY_CHECKIN = 'daily_checkin'
export const CREDIT_TRANSACTION_TYPE_REDEMPTION_CODE = 'redemption_code'
export const CREDIT_TRANSACTION_TYPE_MANUAL_GRANT = 'manual_grant'
export const CREDIT_TRANSACTION_TYPE_PAYMENT_PURCHASE = 'payment_purchase'
export const CREDIT_TRANSACTION_TYPE_PAYMENT_REFUND = 'payment_refund'
export const CREDIT_TRANSACTION_TYPE_CONSUME = 'consume'
export const CREDIT_TRANSACTION_TYPE_EXPIRED = 'expired'

export type CreditTransactionType =
	| typeof CREDIT_TRANSACTION_TYPE_SIGNUP
	| typeof CREDIT_TRANSACTION_TYPE_DAILY_CHECKIN
	| typeof CREDIT_TRANSACTION_TYPE_REDEMPTION_CODE
	| typeof CREDIT_TRANSACTION_TYPE_MANUAL_GRANT
	| typeof CREDIT_TRANSACTION_TYPE_PAYMENT_PURCHASE
	| typeof CREDIT_TRANSACTION_TYPE_PAYMENT_REFUND
	| typeof CREDIT_TRANSACTION_TYPE_CONSUME
	| typeof CREDIT_TRANSACTION_TYPE_EXPIRED

export interface GrantCreditsInput {
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

export interface GetCreditSummaryInput {
	userId: string
	nowMs?: number
	dailyCheckinAmount: number
}

export interface CreditSummary {
	balance: number
	dailyCheckedIn: boolean
	dailyCheckinAmount: number
}

export interface ListCreditTransactionsInput {
	userId: string
	limit?: number
	offset?: number
	type?: string
	sourceType?: string
	sourceId?: string
	createdAtStart?: number
	createdAtEnd?: number
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

export interface ListCreditTransactionsResult {
	transactions: CreditTransactionItem[]
	total: number
}

export interface DailyCheckinInput {
	userId: string
	amount: number
	nowMs?: number
}

export interface GenerateCreditCodesInput {
	count: number
	amount: number
	expiresAt?: number | null
	nowMs?: number
}

export interface ListCreditCodesInput {
	limit?: number
	offset?: number
	code?: string
	usedBy?: string
	used?: boolean
	amount?: number
	createdAtStart?: number
	createdAtEnd?: number
	expiresAtStart?: number
	expiresAtEnd?: number
}

export interface RedeemCreditCodeInput {
	userId: string
	code: string
	nowMs?: number
}

export interface EnsureEnoughCreditsInput {
	userId: string
	amount: number
}

export interface DeductCreditsInput {
	userId: string
	type?: CreditTransactionType
	amount: number
	sourceType: string
	sourceId: string
	description?: string
	nowMs?: number
}

export interface RunPaidActionInput<T> {
	userId: string
	amount: number
	sourceType: string
	sourceId: string
	description?: string
	execute: () => Promise<T>
}

export interface ExpireCreditsInput {
	nowMs?: number
	limit?: number
}

export interface CleanupCreditTransactionsInput {
	nowMs?: number
	retentionDays?: number
}

export interface DailyCheckinResult {
	balance: number
	checkedIn: boolean
	amount: number
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

export interface ListCreditCodesResult {
	codes: ListCreditCodeItem[]
	total: number
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
	duplicated: boolean
}

export interface ExpireCreditsResult {
	processedEntries: number
	processedUsers: number
}

export interface CleanupCreditTransactionsResult {
	deletedRows: number
}

export class CreditsError extends Error {
	public readonly code: string

	constructor(code: string) {
		super(code)
		this.code = code
	}
}

export class CreditsService {
	private readonly db: AppDb

	constructor(db: AppDb) {
		this.db = db
	}

	async grant(input: GrantCreditsInput): Promise<GrantCreditsResult> {
		validateGrantAmount(input.amount)

		const nowMs = input.nowMs ?? Date.now()
		const entryId = crypto.randomUUID()
		const transactionId = crypto.randomUUID()
		const expiresAt = input.expiresAt ?? null
		const description = input.description ?? null

		const batchResults = await runRawD1Batch(this.db, [
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
          ${entryId},
          ${input.userId},
          ${input.amount},
          0,
          ${input.sourceType},
          ${input.sourceId},
          ${expiresAt},
          ${nowMs}
        FROM "user"
        WHERE id = ${input.userId}
          AND NOT EXISTS (
            SELECT 1
            FROM credit_entries
            WHERE source_type = ${input.sourceType}
              AND source_id = ${input.sourceId}
          )
        ON CONFLICT(source_type, source_id) DO NOTHING
      `),
			this.db.run(sql`
        UPDATE "user"
        SET credit_balance = credit_balance + ${input.amount}
        WHERE id = ${input.userId}
          AND EXISTS (SELECT 1 FROM credit_entries WHERE id = ${entryId})
      `),
			this.db.run(sql`
        UPDATE credit_entries
        SET remaining_amount = (
          SELECT
            CASE
              WHEN credit_balance <= 0 THEN 0
              WHEN credit_balance >= ${input.amount} THEN ${input.amount}
              ELSE credit_balance
            END
          FROM "user"
          WHERE id = ${input.userId}
        )
        WHERE id = ${entryId}
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
          ${transactionId},
          ${input.userId},
          ${input.type},
          ${input.amount},
          credit_balance,
          ${input.sourceType},
          ${input.sourceId},
          ${description},
          ${expiresAt},
          ${nowMs}
        FROM "user"
        WHERE id = ${input.userId}
          AND EXISTS (SELECT 1 FROM credit_entries WHERE id = ${entryId})
      `)
		])

		if (readBatchChanges(batchResults[0]) === 0) {
			const userRow = await this.db.query.user.findFirst({
				columns: {
					id: true,
					creditBalance: true
				},
				where: eq(user.id, input.userId)
			})
			if (!userRow) {
				throw new CreditsError('CREDIT_USER_NOT_FOUND')
			}
			return {
				balance: userRow.creditBalance,
				entryId: '',
				transactionId: '',
				entryRemainingAmount: 0,
				duplicated: true
			}
		}

		const rows = await this.db
			.select({
				balance: user.creditBalance,
				entryRemainingAmount: creditEntry.remainingAmount
			})
			.from(user)
			.innerJoin(creditEntry, eq(creditEntry.id, entryId))
			.where(eq(user.id, input.userId))
		const row = rows[0]
		if (!row) {
			throw new CreditsError('CREDIT_USER_NOT_FOUND')
		}

		return {
			balance: row.balance,
			entryId,
			transactionId,
			entryRemainingAmount: row.entryRemainingAmount,
			duplicated: false
		}
	}

	async getSummary(input: GetCreditSummaryInput): Promise<CreditSummary> {
		const userRow = await this.db.query.user.findFirst({
			columns: {
				creditBalance: true
			},
			where: eq(user.id, input.userId)
		})
		if (!userRow) {
			throw new CreditsError('CREDIT_USER_NOT_FOUND')
		}

		const nowMs = input.nowMs ?? Date.now()
		const dayRange = getUtcDayRange(nowMs)
		const checkedInRow = await this.db.query.creditTransaction.findFirst({
			columns: {
				id: true
			},
			where: and(
				eq(creditTransaction.userId, input.userId),
				eq(creditTransaction.type, CREDIT_TRANSACTION_TYPE_DAILY_CHECKIN),
				gte(creditTransaction.createdAt, dayRange.dayStartMs),
				lt(creditTransaction.createdAt, dayRange.dayEndMs)
			)
		})

		return {
			balance: userRow.creditBalance,
			dailyCheckedIn: Boolean(checkedInRow),
			dailyCheckinAmount: input.dailyCheckinAmount
		}
	}

	async listTransactions(input: ListCreditTransactionsInput): Promise<ListCreditTransactionsResult> {
		const limit = resolvePageLimit(input.limit)
		const offset = resolveOffset(input.offset)
		const conditions: SQL[] = [eq(creditTransaction.userId, input.userId)]
		if (input.type) {
			conditions.push(eq(creditTransaction.type, input.type))
		}
		if (input.sourceType) {
			conditions.push(eq(creditTransaction.sourceType, input.sourceType))
		}
		if (input.sourceId) {
			conditions.push(eq(creditTransaction.sourceId, input.sourceId))
		}
		if (input.createdAtStart !== undefined) {
			conditions.push(gte(creditTransaction.createdAt, input.createdAtStart))
		}
		if (input.createdAtEnd !== undefined) {
			conditions.push(lte(creditTransaction.createdAt, input.createdAtEnd))
		}

		const where = and(...conditions)
		const totalRows = await this.db
			.select({ total: sql<number>`count(*)` })
			.from(creditTransaction)
			.where(where)
		const rows = await this.db.query.creditTransaction.findMany({
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
			where,
			orderBy: [desc(creditTransaction.createdAt)],
			limit,
			offset
		})

		return {
			transactions: rows.map((row) => {
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
			}),
			total: Number(totalRows[0]?.total ?? 0)
		}
	}

	async dailyCheckin(input: DailyCheckinInput): Promise<DailyCheckinResult> {
		validateGrantAmount(input.amount)
		const nowMs = input.nowMs ?? Date.now()
		const sourceId = `${input.userId}:${formatUtcDate(nowMs)}`
		const result = await this.grant({
			userId: input.userId,
			type: CREDIT_TRANSACTION_TYPE_DAILY_CHECKIN,
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

	async generateCodes(input: GenerateCreditCodesInput): Promise<GenerateCreditCodesResultCode[]> {
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

		await this.db.insert(creditRedemptionCode).values(
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

	async listCodes(input: ListCreditCodesInput): Promise<ListCreditCodesResult> {
		const limit = resolvePageLimit(input.limit)
		const offset = resolveOffset(input.offset)
		const conditions: SQL[] = []
		if (input.code) {
			conditions.push(eq(creditRedemptionCode.code, input.code))
		}
		if (input.usedBy) {
			conditions.push(eq(creditRedemptionCode.usedBy, input.usedBy))
		}
		if (input.used === true) {
			conditions.push(isNotNull(creditRedemptionCode.usedBy))
		}
		if (input.used === false) {
			conditions.push(isNull(creditRedemptionCode.usedBy))
		}
		if (input.amount !== undefined) {
			conditions.push(eq(creditRedemptionCode.amount, input.amount))
		}
		if (input.createdAtStart !== undefined) {
			conditions.push(gte(creditRedemptionCode.createdAt, input.createdAtStart))
		}
		if (input.createdAtEnd !== undefined) {
			conditions.push(lte(creditRedemptionCode.createdAt, input.createdAtEnd))
		}
		if (input.expiresAtStart !== undefined) {
			conditions.push(gte(creditRedemptionCode.expiresAt, input.expiresAtStart))
		}
		if (input.expiresAtEnd !== undefined) {
			conditions.push(lte(creditRedemptionCode.expiresAt, input.expiresAtEnd))
		}

		const where = conditions.length > 0 ? and(...conditions) : undefined
		const totalRows = await this.db
			.select({ total: sql<number>`count(*)` })
			.from(creditRedemptionCode)
			.where(where)
		const rows = await this.db.query.creditRedemptionCode.findMany({
			columns: {
				id: true,
				code: true,
				amount: true,
				expiresAt: true,
				usedBy: true,
				usedAt: true,
				createdAt: true
			},
			where,
			orderBy: [desc(creditRedemptionCode.createdAt)],
			limit,
			offset
		})

		return {
			codes: rows.map((row) => {
				return {
					id: row.id,
					code: row.code,
					amount: row.amount,
					expiresAt: row.expiresAt,
					usedBy: row.usedBy,
					usedAt: row.usedAt,
					createdAt: row.createdAt
				}
			}),
			total: Number(totalRows[0]?.total ?? 0)
		}
	}

	async redeemCode(input: RedeemCreditCodeInput): Promise<RedeemCreditCodeResult> {
		const normalizedCode = input.code.trim().toUpperCase()
		if (normalizedCode === '') {
			throw new CreditsError('INVALID_CREDIT_CODE')
		}
		const nowMs = input.nowMs ?? Date.now()

		const userRow = await this.db.query.user.findFirst({
			columns: {
				id: true,
				creditBalance: true
			},
			where: eq(user.id, input.userId)
		})
		if (!userRow) {
			throw new CreditsError('CREDIT_USER_NOT_FOUND')
		}

		const codeRow = await this.db.query.creditRedemptionCode.findFirst({
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
		const balance = addUnits(userRow.creditBalance, amount)
		const remainingAmount = resolveEntryRemainingAmount(userRow.creditBalance, amount)
		const entryId = crypto.randomUUID()
		const transactionId = crypto.randomUUID()

		const batchResults = await runRawD1Batch(this.db, [
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
        ${entryId},
        ${input.userId},
        ${amount},
        ${remainingAmount},
        ${CREDIT_TRANSACTION_TYPE_REDEMPTION_CODE},
        ${codeRow.id},
        NULL,
        ${nowMs}
      FROM credit_redemption_codes
      WHERE id = ${codeRow.id}
        AND used_by IS NULL
        AND (expires_at IS NULL OR expires_at > ${nowMs})
    `),
			this.db.run(sql`
      UPDATE credit_redemption_codes
      SET used_by = ${input.userId}, used_at = ${nowMs}
      WHERE id = ${codeRow.id}
        AND EXISTS (SELECT 1 FROM credit_entries WHERE id = ${entryId})
    `),
			this.db.run(sql`
      UPDATE "user"
      SET credit_balance = ${balance}
      WHERE id = ${input.userId}
        AND EXISTS (SELECT 1 FROM credit_entries WHERE id = ${entryId})
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

	async ensureEnough(input: EnsureEnoughCreditsInput): Promise<EnsureEnoughCreditsResult> {
		validateGrantAmount(input.amount)
		const userRow = await this.db.query.user.findFirst({
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

	async deduct(input: DeductCreditsInput): Promise<DeductCreditsResult> {
		validateGrantAmount(input.amount)

		const userRow = await this.db.query.user.findFirst({
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
		const transactionId = crypto.randomUUID()
		const transactionType = input.type ?? CREDIT_TRANSACTION_TYPE_CONSUME
		const statements: [ReturnType<AppDb['run']>, ...Array<ReturnType<AppDb['run']>>] = [
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
        ${transactionId},
        ${input.userId},
        ${transactionType},
        ${-input.amount},
        credit_balance - ${input.amount},
        ${input.sourceType},
        ${input.sourceId},
        ${input.description ?? null},
        NULL,
        ${nowMs}
      FROM "user"
      WHERE id = ${input.userId}
        AND NOT EXISTS (
          SELECT 1
          FROM credit_transactions
          WHERE source_type = ${input.sourceType}
            AND source_id = ${input.sourceId}
        )
      ON CONFLICT(source_type, source_id) DO NOTHING
    `),
			this.db.run(sql`
      WITH ordered_entries AS (
        SELECT
          id,
          remaining_amount,
          COALESCE(
            SUM(remaining_amount) OVER (
              ORDER BY
                CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END ASC,
                expires_at ASC,
                created_at ASC,
                id ASC
              ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ),
            0
          ) AS previous_amount
        FROM credit_entries
        WHERE user_id = ${input.userId}
          AND remaining_amount > 0
      ),
      used_entries AS (
        SELECT
          id,
          CASE
            WHEN previous_amount >= ${input.amount} THEN 0
            WHEN previous_amount + remaining_amount <= ${input.amount} THEN remaining_amount
            ELSE ${input.amount} - previous_amount
          END AS used_amount
        FROM ordered_entries
      )
      UPDATE credit_entries
      SET remaining_amount = remaining_amount - (
        SELECT used_amount
        FROM used_entries
        WHERE used_entries.id = credit_entries.id
      )
      WHERE id IN (
        SELECT id
        FROM used_entries
        WHERE used_amount > 0
      )
        AND EXISTS (SELECT 1 FROM credit_transactions WHERE id = ${transactionId})
    `),
			this.db.run(sql`
      UPDATE "user"
      SET credit_balance = credit_balance - ${input.amount}
      WHERE id = ${input.userId}
        AND EXISTS (SELECT 1 FROM credit_transactions WHERE id = ${transactionId})
    `),
			this.db.run(sql`
      UPDATE credit_transactions
      SET balance_after = (SELECT credit_balance FROM "user" WHERE id = ${input.userId})
      WHERE id = ${transactionId}
    `)
		]

		const batchResults = await runRawD1Batch(this.db, statements)
		const balanceRows = await this.db
			.select({
				creditBalance: user.creditBalance
			})
			.from(user)
			.where(eq(user.id, input.userId))
		const balance = balanceRows[0]?.creditBalance ?? subtractUnits(userRow.creditBalance, input.amount)
		if (readBatchChanges(batchResults[0]) === 0) {
			return {
				balance,
				deductedAmount: 0,
				duplicated: true
			}
		}

		return {
			balance,
			deductedAmount: input.amount,
			duplicated: false
		}
	}

	async runPaidAction<T>(input: RunPaidActionInput<T>): Promise<T> {
		await this.ensureEnough({
			userId: input.userId,
			amount: input.amount
		})

		const result = await input.execute()
		await this.deduct({
			userId: input.userId,
			amount: input.amount,
			sourceType: input.sourceType,
			sourceId: input.sourceId,
			description: input.description
		})
		return result
	}

	async expire(input: ExpireCreditsInput): Promise<ExpireCreditsResult> {
		const nowMs = input.nowMs ?? Date.now()
		const limit = resolveExpireLimit(input.limit)

		const expiredEntries = await this.db.all<{
			id: string
			user_id: string
			remaining_amount: number
		}>(sql`
    SELECT id, user_id, remaining_amount
    FROM credit_entries
    WHERE expires_at IS NOT NULL
      AND expires_at <= ${nowMs}
      AND remaining_amount > 0
    ORDER BY expires_at ASC, created_at ASC
    LIMIT ${limit}
  `)

		if (expiredEntries.length === 0) {
			return {
				processedEntries: 0,
				processedUsers: 0
			}
		}

		const userExpiredMap = new Map<string, number>()
		for (const row of expiredEntries) {
			const currentValue = userExpiredMap.get(row.user_id) ?? 0
			userExpiredMap.set(row.user_id, currentValue + row.remaining_amount)
		}

		const userIds = Array.from(userExpiredMap.keys())
		const userRows = await this.db
			.select({
				id: user.id,
				creditBalance: user.creditBalance
			})
			.from(user)
			.where(sql`${user.id} IN (${sql.join(userIds.map((userId) => sql`${userId}`), sql`, `)})`)

		const balanceMap = new Map<string, number>()
		for (const row of userRows) {
			balanceMap.set(row.id, row.creditBalance)
		}

		const statements: Array<ReturnType<AppDb['run']>> = []
		for (const [userId, expiredAmount] of userExpiredMap) {
			const currentBalance = balanceMap.get(userId)
			if (currentBalance === undefined) {
				continue
			}

			const nextBalance = subtractUnits(currentBalance, expiredAmount)
			const sourceId = `expire:${nowMs}:${userId}`
			statements.push(
				this.db.run(sql`
        UPDATE "user"
        SET credit_balance = ${nextBalance}
        WHERE id = ${userId}
      `)
			)
			statements.push(
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
        VALUES (
          ${crypto.randomUUID()},
          ${userId},
          ${CREDIT_TRANSACTION_TYPE_EXPIRED},
          ${-expiredAmount},
          ${nextBalance},
          'expired',
          ${sourceId},
          'Credits expired',
          NULL,
          ${nowMs}
        )
      `)
			)
		}

		for (const entry of expiredEntries) {
			statements.push(
				this.db.run(sql`
        UPDATE credit_entries
        SET remaining_amount = 0
        WHERE id = ${entry.id}
      `)
			)
		}

		const [firstStatement, ...restStatements] = statements
		if (firstStatement) {
			await runRawD1Batch(this.db, [firstStatement, ...restStatements])
		}

		return {
			processedEntries: expiredEntries.length,
			processedUsers: userExpiredMap.size
		}
	}

	async cleanupTransactions(input: CleanupCreditTransactionsInput): Promise<CleanupCreditTransactionsResult> {
		const nowMs = input.nowMs ?? Date.now()
		const retentionDays = resolveRetentionDays(input.retentionDays)
		const cutoff = nowMs - retentionDays * 24 * 60 * 60 * 1000

		const result = await this.db.run(sql`
    DELETE FROM credit_transactions
    WHERE created_at < ${cutoff}
  `)

		return {
			deletedRows: readBatchChanges(result)
		}
	}

}

function validateGrantAmount(amount: number): void {
	if (!Number.isSafeInteger(amount) || amount <= 0) {
		throw new CreditsError('INVALID_CREDIT_AMOUNT')
	}
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

function resolveExpireLimit(limit: number | undefined): number {
	if (!Number.isInteger(limit) || !limit || limit <= 0) {
		return 20
	}
	return Math.min(limit, 200)
}

function resolveRetentionDays(retentionDays: number | undefined): number {
	if (!Number.isInteger(retentionDays) || !retentionDays || retentionDays <= 0) {
		return 90
	}
	return retentionDays
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
