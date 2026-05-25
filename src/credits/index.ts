import { and, desc, eq, gte, isNotNull, isNull, lt, lte, sql, type SQL } from 'drizzle-orm'
import { runRawD1Batch, type MetaDb, type D1RawRunQuery, type TenantShardDb } from '../db'
import { creditRedemptionCode } from '../db/schema.meta'
import { creditBalance, creditEntry, creditTransaction } from '../db/schema.shard'

export const CREDIT_TRANSACTION_TYPE_SIGNUP = 'signup'
export const CREDIT_TRANSACTION_TYPE_DAILY_CHECKIN = 'daily_checkin'
export const CREDIT_TRANSACTION_TYPE_REDEMPTION_CODE = 'redemption_code'
export const CREDIT_TRANSACTION_TYPE_MANUAL_GRANT = 'manual_grant'
export const CREDIT_TRANSACTION_TYPE_PAYMENT_PURCHASE = 'payment_purchase'
export const CREDIT_TRANSACTION_TYPE_PAYMENT_REFUND = 'payment_refund'
export const CREDIT_TRANSACTION_TYPE_AFFILIATE_INVITER = 'affiliate_inviter'
export const CREDIT_TRANSACTION_TYPE_AFFILIATE_INVITEE = 'affiliate_invitee'
export const CREDIT_TRANSACTION_TYPE_CONSUME = 'consume'
export const CREDIT_TRANSACTION_TYPE_EXPIRED = 'expired'

export type CreditTransactionType =
	| typeof CREDIT_TRANSACTION_TYPE_SIGNUP
	| typeof CREDIT_TRANSACTION_TYPE_DAILY_CHECKIN
	| typeof CREDIT_TRANSACTION_TYPE_REDEMPTION_CODE
	| typeof CREDIT_TRANSACTION_TYPE_MANUAL_GRANT
	| typeof CREDIT_TRANSACTION_TYPE_PAYMENT_PURCHASE
	| typeof CREDIT_TRANSACTION_TYPE_PAYMENT_REFUND
	| typeof CREDIT_TRANSACTION_TYPE_AFFILIATE_INVITER
	| typeof CREDIT_TRANSACTION_TYPE_AFFILIATE_INVITEE
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

export interface CreateCreditBalanceInput {
	userId: string
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
	claimedBy?: string
	status?: string
	amount?: number
	createdAtStart?: number
	createdAtEnd?: number
	expiresAtStart?: number
	expiresAtEnd?: number
}

export interface ClaimCreditCodeInput {
	userId: string
	code: string
	nowMs?: number
}

export interface MarkCreditCodeGrantedInput {
	codeId: string
	userId: string
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
	limit?: number
}

export interface DailyCheckinResult {
	balance: number
	checkedIn: boolean
	amount: number
}

export interface GeneratedCreditCodeItem {
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
	status: string
	expiresAt: number | null
	claimedBy: string | null
	claimedAt: number | null
	grantedAt: number | null
	createdAt: number
}

export interface ListCreditCodesResult {
	codes: ListCreditCodeItem[]
	total: number
}

export interface ClaimedCreditCode {
	id: string
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

export class CreditRedemptionService {
	private readonly db: MetaDb

	constructor(db: MetaDb) {
		this.db = db
	}

	async generateCodes(input: GenerateCreditCodesInput): Promise<GeneratedCreditCodeItem[]> {
		if (!Number.isInteger(input.count) || input.count <= 0) {
			throw new CreditsError('INVALID_GENERATE_COUNT')
		}
		validateGrantAmount(input.amount)

		const nowMs: number = input.nowMs ?? Date.now()
		const rows: GeneratedCreditCodeItem[] = []
		let index: number = 0
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
			rows.map((row): typeof creditRedemptionCode.$inferInsert => {
				return {
					id: row.id,
					code: row.code,
					amount: row.amount,
					status: 'unused',
					expiresAt: row.expiresAt,
					createdAt: row.createdAt
				}
			})
		)

		return rows
	}

	async listCodes(input: ListCreditCodesInput): Promise<ListCreditCodesResult> {
		const limit: number = resolvePageLimit(input.limit)
		const offset: number = resolveOffset(input.offset)
		const conditions: SQL[] = []
		if (input.code) {
			conditions.push(eq(creditRedemptionCode.code, input.code))
		}
		if (input.claimedBy) {
			conditions.push(eq(creditRedemptionCode.claimedBy, input.claimedBy))
		}
		if (input.status) {
			conditions.push(eq(creditRedemptionCode.status, input.status))
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

		const where: SQL | undefined = conditions.length > 0 ? and(...conditions) : undefined
		const totalRows: Array<{ total: number }> = await this.db
			.select({ total: sql<number>`count(*)` })
			.from(creditRedemptionCode)
			.where(where)
		const rows = await this.db.query.creditRedemptionCode.findMany({
			columns: {
				id: true,
				code: true,
				amount: true,
				status: true,
				expiresAt: true,
				claimedBy: true,
				claimedAt: true,
				grantedAt: true,
				createdAt: true
			},
			where,
			orderBy: [desc(creditRedemptionCode.createdAt)],
			limit,
			offset
		})

		return {
			codes: rows.map((row): ListCreditCodeItem => {
				return {
					id: row.id,
					code: row.code,
					amount: row.amount,
					status: row.status,
					expiresAt: row.expiresAt,
					claimedBy: row.claimedBy,
					claimedAt: row.claimedAt,
					grantedAt: row.grantedAt,
					createdAt: row.createdAt
				}
			}),
			total: Number(totalRows[0]?.total ?? 0)
		}
	}

	async claimCode(input: ClaimCreditCodeInput): Promise<ClaimedCreditCode> {
		const normalizedCode: string = input.code.trim().toUpperCase()
		if (normalizedCode === '') {
			throw new CreditsError('INVALID_CREDIT_CODE')
		}

		const nowMs: number = input.nowMs ?? Date.now()
		const rows = await this.db.query.creditRedemptionCode.findMany({
			columns: {
				id: true,
				amount: true,
				status: true,
				expiresAt: true,
				claimedBy: true
			},
			where: eq(creditRedemptionCode.code, normalizedCode),
			limit: 1
		})
		const row: (typeof rows)[number] | undefined = rows[0]
		if (!row) {
			throw new CreditsError('INVALID_CREDIT_CODE')
		}
		if (row.status === 'claimed') {
			if (row.claimedBy === input.userId) {
				return {
					id: row.id,
					amount: row.amount
				}
			}
			throw new CreditsError('CREDIT_CODE_USED')
		}
		if (row.status === 'granted') {
			throw new CreditsError('CREDIT_CODE_USED')
		}
		if (row.status !== 'unused') {
			throw new CreditsError('INVALID_CREDIT_CODE')
		}
		if (row.expiresAt !== null && row.expiresAt <= nowMs) {
			throw new CreditsError('INVALID_CREDIT_CODE')
		}

		const result: D1Result = await this.db
			.update(creditRedemptionCode)
			.set({
				status: 'claimed',
				claimedBy: input.userId,
				claimedAt: nowMs
			})
			.where(
				and(
					eq(creditRedemptionCode.id, row.id),
					eq(creditRedemptionCode.status, 'unused'),
					isNull(creditRedemptionCode.claimedBy)
				)
			)
			.run()
		if (readBatchChanges(result) === 0) {
			throw new CreditsError('CREDIT_CODE_USED')
		}

		return {
			id: row.id,
			amount: row.amount
		}
	}

	async markGranted(input: MarkCreditCodeGrantedInput): Promise<void> {
		const nowMs: number = input.nowMs ?? Date.now()
		await this.db
			.update(creditRedemptionCode)
			.set({
				status: 'granted',
				grantedAt: nowMs
			})
			.where(
				and(
					eq(creditRedemptionCode.id, input.codeId),
					eq(creditRedemptionCode.claimedBy, input.userId),
					isNotNull(creditRedemptionCode.claimedAt)
				)
			)
	}
}

export class CreditsService {
	private readonly db: TenantShardDb

	constructor(db: TenantShardDb) {
		this.db = db
	}

	async createBalance(input: CreateCreditBalanceInput): Promise<void> {
		const nowMs: number = input.nowMs ?? Date.now()
		await this.db.run(sql`
        INSERT INTO credit_balances (user_id, balance, updated_at)
        VALUES (${input.userId}, 0, ${nowMs})
        ON CONFLICT(user_id) DO NOTHING
      `)
	}

	async grant(input: GrantCreditsInput): Promise<GrantCreditsResult> {
		validateGrantAmount(input.amount)

		const nowMs: number = input.nowMs ?? Date.now()
		const entryId: string = crypto.randomUUID()
		const transactionId: string = crypto.randomUUID()
		const expiresAt: number | null = input.expiresAt ?? null
		const description: string | null = input.description ?? null
		const batchResults: D1Result[] = await runRawD1Batch(this.db, [
			this.db.run(sql`
        INSERT INTO credit_balances (user_id, balance, updated_at)
        VALUES (${input.userId}, 0, ${nowMs})
        ON CONFLICT(user_id) DO NOTHING
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
          ${entryId},
          ${input.userId},
          ${input.amount},
          0,
          ${input.sourceType},
          ${input.sourceId},
          ${expiresAt},
          ${nowMs}
        WHERE NOT EXISTS (
          SELECT 1
          FROM credit_entries
          WHERE source_type = ${input.sourceType}
            AND source_id = ${input.sourceId}
        )
        ON CONFLICT(source_type, source_id) DO NOTHING
      `),
			this.db.run(sql`
        UPDATE credit_balances
        SET balance = balance + ${input.amount}, updated_at = ${nowMs}
        WHERE user_id = ${input.userId}
          AND EXISTS (SELECT 1 FROM credit_entries WHERE id = ${entryId})
      `),
			this.db.run(sql`
        UPDATE credit_entries
        SET remaining_amount = (
          SELECT
            CASE
              WHEN balance <= 0 THEN 0
              WHEN balance >= ${input.amount} THEN ${input.amount}
              ELSE balance
            END
          FROM credit_balances
          WHERE user_id = ${input.userId}
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
          balance,
          ${input.sourceType},
          ${input.sourceId},
          ${description},
          ${expiresAt},
          ${nowMs}
        FROM credit_balances
        WHERE user_id = ${input.userId}
          AND EXISTS (SELECT 1 FROM credit_entries WHERE id = ${entryId})
      `)
		])

		if (readBatchChanges(batchResults[1]) === 0) {
			const row = await this.findBalance(input.userId)
			return {
				balance: row.balance,
				entryId: '',
				transactionId: '',
				entryRemainingAmount: 0,
				duplicated: true
			}
		}

		const rows: Array<{ balance: number; entryRemainingAmount: number }> = await this.db
			.select({
				balance: creditBalance.balance,
				entryRemainingAmount: creditEntry.remainingAmount
			})
			.from(creditBalance)
			.innerJoin(creditEntry, eq(creditEntry.id, entryId))
			.where(eq(creditBalance.userId, input.userId))
		const row: { balance: number; entryRemainingAmount: number } | undefined = rows[0]
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
		const balanceRow = await this.db.query.creditBalance.findFirst({
			columns: {
				balance: true
			},
			where: eq(creditBalance.userId, input.userId)
		})
		const nowMs: number = input.nowMs ?? Date.now()
		const dayRange: { dayStartMs: number; dayEndMs: number } = getUtcDayRange(nowMs)
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
			balance: balanceRow?.balance ?? 0,
			dailyCheckedIn: Boolean(checkedInRow),
			dailyCheckinAmount: input.dailyCheckinAmount
		}
	}

	async listTransactions(input: ListCreditTransactionsInput): Promise<ListCreditTransactionsResult> {
		const limit: number = resolvePageLimit(input.limit)
		const offset: number = resolveOffset(input.offset)
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

		const where: SQL | undefined = and(...conditions)
		const totalRows: Array<{ total: number }> = await this.db
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
			transactions: rows.map((row): CreditTransactionItem => {
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

		const nowMs: number = input.nowMs ?? Date.now()
		const sourceId: string = `${input.userId}:${formatUtcDate(nowMs)}`
		const result: GrantCreditsResult = await this.grant({
			userId: input.userId,
			type: CREDIT_TRANSACTION_TYPE_DAILY_CHECKIN,
			amount: input.amount,
			sourceType: 'daily_checkin',
			sourceId,
			description: 'Daily check-in reward',
			nowMs
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

	async ensureEnough(input: EnsureEnoughCreditsInput): Promise<EnsureEnoughCreditsResult> {
		validateGrantAmount(input.amount)

		const row = await this.findBalance(input.userId)
		if (row.balance < input.amount) {
			throw new CreditsError('INSUFFICIENT_CREDITS')
		}
		return {
			balance: row.balance
		}
	}

	async deduct(input: DeductCreditsInput): Promise<DeductCreditsResult> {
		validateGrantAmount(input.amount)

		const row = await this.findBalance(input.userId)
		const nowMs: number = input.nowMs ?? Date.now()
		const transactionId: string = crypto.randomUUID()
		const transactionType: CreditTransactionType = input.type ?? CREDIT_TRANSACTION_TYPE_CONSUME
		const statements: [D1RawRunQuery, ...D1RawRunQuery[]] = [
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
          balance - ${input.amount},
          ${input.sourceType},
          ${input.sourceId},
          ${input.description ?? null},
          NULL,
          ${nowMs}
        FROM credit_balances
        WHERE user_id = ${input.userId}
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
        UPDATE credit_balances
        SET balance = balance - ${input.amount}, updated_at = ${nowMs}
        WHERE user_id = ${input.userId}
          AND EXISTS (SELECT 1 FROM credit_transactions WHERE id = ${transactionId})
      `),
			this.db.run(sql`
        UPDATE credit_transactions
        SET balance_after = (
          SELECT balance
          FROM credit_balances
          WHERE user_id = ${input.userId}
        )
        WHERE id = ${transactionId}
      `)
		]

		const batchResults: D1Result[] = await runRawD1Batch(this.db, statements)
		const nextBalanceRow = await this.findBalance(input.userId)
		if (readBatchChanges(batchResults[0]) === 0) {
			return {
				balance: nextBalanceRow.balance,
				deductedAmount: 0,
				duplicated: true
			}
		}

		return {
			balance: nextBalanceRow.balance,
			deductedAmount: input.amount,
			duplicated: false
		}
	}

	async runPaidAction<T>(input: RunPaidActionInput<T>): Promise<T> {
		await this.ensureEnough({
			userId: input.userId,
			amount: input.amount
		})

		const result: T = await input.execute()
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
		const nowMs: number = input.nowMs ?? Date.now()
		const limit: number = resolveExpireLimit(input.limit)

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

		const statements: D1RawRunQuery[] = []
		for (const entry of expiredEntries) {
			const transactionId: string = crypto.randomUUID()
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
          SELECT
            ${transactionId},
            user_id,
            ${CREDIT_TRANSACTION_TYPE_EXPIRED},
            -remaining_amount,
            (
              SELECT balance - credit_entries.remaining_amount
              FROM credit_balances
              WHERE user_id = credit_entries.user_id
            ),
            'expired',
            ${`expired:${entry.id}`},
            'Credits expired',
            NULL,
            ${nowMs}
          FROM credit_entries
          WHERE id = ${entry.id}
            AND remaining_amount > 0
          ON CONFLICT(source_type, source_id) DO NOTHING
        `)
			)
			statements.push(
				this.db.run(sql`
          UPDATE credit_balances
          SET
            balance = balance + (
              SELECT amount
              FROM credit_transactions
              WHERE id = ${transactionId}
            ),
            updated_at = ${nowMs}
          WHERE user_id = ${entry.user_id}
            AND EXISTS (
              SELECT 1
              FROM credit_transactions
              WHERE id = ${transactionId}
            )
        `)
			)
			statements.push(
				this.db.run(sql`
          UPDATE credit_entries
          SET remaining_amount = 0
          WHERE id = ${entry.id}
            AND EXISTS (
              SELECT 1
              FROM credit_transactions
              WHERE id = ${transactionId}
            )
        `)
			)
		}

		const firstStatement: D1RawRunQuery | undefined = statements[0]
		let processedEntries: number = 0
		const processedUserIds: Set<string> = new Set<string>()
		if (firstStatement) {
			const results: D1Result[] = await runRawD1Batch(this.db, [firstStatement, ...statements.slice(1)])
			let resultIndex: number = 0
			for (const entry of expiredEntries) {
				if (readBatchChanges(results[resultIndex]) > 0) {
					processedEntries += 1
					processedUserIds.add(entry.user_id)
				}
				resultIndex += 3
			}
		}

		return {
			processedEntries,
			processedUsers: processedUserIds.size
		}
	}

	async cleanupTransactions(input: CleanupCreditTransactionsInput): Promise<CleanupCreditTransactionsResult> {
		const nowMs: number = input.nowMs ?? Date.now()
		const retentionDays: number = resolveRetentionDays(input.retentionDays)
		const limit: number = resolveCleanupLimit(input.limit)
		const cutoff: number = nowMs - retentionDays * 24 * 60 * 60 * 1000

		const result = await this.db.run(sql`
      DELETE FROM credit_transactions
      WHERE id IN (
        SELECT id
        FROM credit_transactions
        WHERE created_at < ${cutoff}
        ORDER BY created_at ASC
        LIMIT ${limit}
      )
    `)

		return {
			deletedRows: readBatchChanges(result)
		}
	}

	private async findBalance(userId: string): Promise<{ balance: number }> {
		const row = await this.db.query.creditBalance.findFirst({
			columns: {
				balance: true
			},
			where: eq(creditBalance.userId, userId)
		})
		if (!row) {
			throw new CreditsError('CREDIT_USER_NOT_FOUND')
		}
		return row
	}
}

function validateGrantAmount(amount: number): void {
	if (!Number.isSafeInteger(amount) || amount <= 0) {
		throw new CreditsError('INVALID_CREDIT_AMOUNT')
	}
}

function getUtcDayRange(nowMs: number): { dayStartMs: number; dayEndMs: number } {
	const date: Date = new Date(nowMs)
	const dayStartMs: number = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
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

function resolveCleanupLimit(limit: number | undefined): number {
	if (!Number.isInteger(limit) || !limit || limit <= 0) {
		return 500
	}
	return Math.min(limit, 5000)
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

function formatUtcDate(timestampMs: number): string {
	const date: Date = new Date(timestampMs)
	const year: number = date.getUTCFullYear()
	const month: string = String(date.getUTCMonth() + 1).padStart(2, '0')
	const day: string = String(date.getUTCDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

function generateCreditCode(): string {
	const bytes: Uint8Array = new Uint8Array(8)
	crypto.getRandomValues(bytes)
	const alphabet: string = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
	let code: string = ''
	for (const byte of bytes) {
		code += alphabet[byte % alphabet.length]
	}
	return code
}

function readBatchChanges(result: unknown): number {
	const row = result as { meta?: { changes?: number } }
	return Number(row.meta?.changes ?? 0)
}
