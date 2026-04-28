import { describe, expect } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import {
	cleanupCreditTransactions,
	CreditsError,
	deductCredits,
	ensureEnoughCredits,
	expireCredits,
	grantCredits,
	runPaidActionWithCredits,
	type GrantCreditsInput
} from './index'
import type { AppDb } from '../db'

describe('grantCredits', () => {
	type GivenDetail = {
		userBalance: number | null
		amount: number
		batchErrorMessage: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		errorCode: string
		balance: number
		entryRemainingAmount: number
		duplicated: boolean
		batchItemCount: number
		insertedEntryRemainingAmount: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'grant credits for normal positive balance user',
			given: 'user has non-negative balance and positive grant amount',
			when: 'grantCredits is called',
			then: 'balance grows and entry remaining amount equals grant amount',
			givenDetail: {
				userBalance: 10,
				amount: 30,
				batchErrorMessage: ''
			},
			whenDetail: {},
			thenExpected: {
				errorCode: '',
				balance: 40,
				entryRemainingAmount: 30,
				duplicated: false,
				batchItemCount: 3,
				insertedEntryRemainingAmount: 30
			}
		},
		{
			scenario: 'repay debt first when user balance is negative',
			given: 'user has negative balance and grant amount is smaller than debt',
			when: 'grantCredits is called',
			then: 'entry remaining amount becomes zero',
			givenDetail: {
				userBalance: -20,
				amount: 10,
				batchErrorMessage: ''
			},
			whenDetail: {},
			thenExpected: {
				errorCode: '',
				balance: -10,
				entryRemainingAmount: 0,
				duplicated: false,
				batchItemCount: 3,
				insertedEntryRemainingAmount: 0
			}
		},
		{
			scenario: 'keep remaining amount after debt repayment',
			given: 'user has negative balance and grant amount is larger than debt',
			when: 'grantCredits is called',
			then: 'entry remaining amount is leftover after debt repayment',
			givenDetail: {
				userBalance: -8,
				amount: 20,
				batchErrorMessage: ''
			},
			whenDetail: {},
			thenExpected: {
				errorCode: '',
				balance: 12,
				entryRemainingAmount: 12,
				duplicated: false,
				batchItemCount: 3,
				insertedEntryRemainingAmount: 12
			}
		},
		{
			scenario: 'return duplicated when same source is granted again',
			given: 'batch insert hits credit entry unique constraint',
			when: 'grantCredits is called',
			then: 'returns duplicated result and keeps original balance',
			givenDetail: {
				userBalance: 10,
				amount: 20,
				batchErrorMessage:
					'UNIQUE constraint failed: credit_entries.source_type, credit_entries.source_id'
			},
			whenDetail: {},
			thenExpected: {
				errorCode: '',
				balance: 10,
				entryRemainingAmount: 0,
				duplicated: true,
				batchItemCount: 3,
				insertedEntryRemainingAmount: 20
			}
		},
		{
			scenario: 'reject invalid non-positive amount',
			given: 'grant amount is zero',
			when: 'grantCredits is called',
			then: 'returns invalid amount error',
			givenDetail: {
				userBalance: 10,
				amount: 0,
				batchErrorMessage: ''
			},
			whenDetail: {},
			thenExpected: {
				errorCode: 'INVALID_CREDIT_AMOUNT',
				balance: 0,
				entryRemainingAmount: 0,
				duplicated: false,
				batchItemCount: 0,
				insertedEntryRemainingAmount: 0
			}
		},
		{
			scenario: 'reject missing user',
			given: 'user does not exist',
			when: 'grantCredits is called',
			then: 'returns user not found error',
			givenDetail: {
				userBalance: null,
				amount: 10,
				batchErrorMessage: ''
			},
			whenDetail: {},
			thenExpected: {
				errorCode: 'CREDIT_USER_NOT_FOUND',
				balance: 0,
				entryRemainingAmount: 0,
				duplicated: false,
				batchItemCount: 0,
				insertedEntryRemainingAmount: 0
			}
		}
	]

	runCases(cases, async (given) => {
		const db = createMockDb(given)

		const input: GrantCreditsInput = {
			db,
			userId: 'u1',
			type: 'signup',
			amount: given.amount,
			sourceType: 'signup',
			sourceId: 'u1',
			description: 'signup bonus',
			expiresAt: 1893456000000,
			nowMs: 1890000000000
		}

		try {
			const result = await grantCredits(input)
			const batchItems = db._state.batchItems
			const entryInsert = batchItems[1] as { payload?: { remainingAmount?: number } }
			return {
				errorCode: '',
				balance: result.balance,
				entryRemainingAmount: result.entryRemainingAmount,
				duplicated: result.duplicated,
				batchItemCount: batchItems.length,
				insertedEntryRemainingAmount: entryInsert.payload?.remainingAmount ?? 0
			}
		} catch (error) {
			return {
				errorCode: error instanceof CreditsError ? error.code : 'UNKNOWN',
				balance: 0,
				entryRemainingAmount: 0,
				duplicated: false,
				batchItemCount: db._state.batchItems.length,
				insertedEntryRemainingAmount: 0
			}
		}
	})
})

type MockDbState = {
	batchItems: unknown[]
}

type MockDb = AppDb & {
	_state: MockDbState
}

function createMockDb(given: {
	userBalance: number | null
	batchErrorMessage: string
}): MockDb {
	const state: MockDbState = {
		batchItems: []
	}

	const db = {
		_state: state,
		query: {
			user: {
				findFirst: async (): Promise<{ id: string; creditBalance: number } | undefined> => {
					if (given.userBalance === null) {
						return undefined
					}
					return {
						id: 'u1',
						creditBalance: given.userBalance
					}
				}
			}
		},
		update: (): {
			set: (payload: unknown) => {
				where: (_condition: unknown) => { kind: string; payload: unknown }
			}
		} => {
			return {
				set: (payload: unknown) => {
					return {
						where: () => {
							return { kind: 'update', payload }
						}
					}
				}
			}
		},
		insert: (): {
			values: (payload: unknown) => { kind: string; payload: unknown }
		} => {
			return {
				values: (payload: unknown) => {
					return { kind: 'insert', payload }
				}
			}
		},
		batch: async (items: unknown[]): Promise<unknown[]> => {
			state.batchItems = items
			if (given.batchErrorMessage !== '') {
				throw new Error(given.batchErrorMessage)
			}
			return []
		}
	} as unknown as MockDb

	return db
}

describe('ensureEnoughCredits', () => {
	type GivenDetail = {
		userBalance: number | null
		amount: number
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		errorCode: string
		balance: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'allow request when balance is enough',
			given: 'user has balance 100 and request amount 60',
			when: 'ensureEnoughCredits is called',
			then: 'returns current balance',
			givenDetail: {
				userBalance: 100,
				amount: 60
			},
			whenDetail: {},
			thenExpected: {
				errorCode: '',
				balance: 100
			}
		},
		{
			scenario: 'reject request when balance is insufficient',
			given: 'user has balance 10 and request amount 60',
			when: 'ensureEnoughCredits is called',
			then: 'returns insufficient credits',
			givenDetail: {
				userBalance: 10,
				amount: 60
			},
			whenDetail: {},
			thenExpected: {
				errorCode: 'INSUFFICIENT_CREDITS',
				balance: 0
			}
		}
	]

	runCases(cases, async (given) => {
		const db = createDeductMockDb(given.userBalance)
		try {
			const result = await ensureEnoughCredits({
				db,
				userId: 'u1',
				amount: given.amount
			})
			return {
				errorCode: '',
				balance: result.balance
			}
		} catch (error) {
			return {
				errorCode: error instanceof CreditsError ? error.code : 'UNKNOWN',
				balance: 0
			}
		}
	})
})

describe('deductCredits and runPaidActionWithCredits', () => {
	type GivenDetail = {
		initialBalance: number
		entries: Array<{ id: string; remaining_amount: number }>
		amount: number
		executeThrows: boolean
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		errorCode: string
		nextBalance: number
		batchCalled: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'deduct allows balance to become negative',
			given: 'user has low balance and deduction is larger',
			when: 'deductCredits is called',
			then: 'returns negative balance and still writes batch',
			givenDetail: {
				initialBalance: 5,
				entries: [{ id: 'e1', remaining_amount: 5 }],
				amount: 20,
				executeThrows: false
			},
			whenDetail: {},
			thenExpected: {
				errorCode: '',
				nextBalance: -15,
				batchCalled: true
			}
		},
		{
			scenario: 'business failure path does not deduct credits',
			given: 'ensure passes but business throws error',
			when: 'runPaidActionWithCredits is called',
			then: 'returns business error and no batch write',
			givenDetail: {
				initialBalance: 100,
				entries: [{ id: 'e1', remaining_amount: 100 }],
				amount: 20,
				executeThrows: true
			},
			whenDetail: {},
			thenExpected: {
				errorCode: 'BUSINESS_FAILED',
				nextBalance: 0,
				batchCalled: false
			}
		}
	]

	runCases(cases, async (given) => {
		const db = createDeductMockDb(given.initialBalance, given.entries)

		if (!given.executeThrows) {
			const result = await deductCredits({
				db,
				userId: 'u1',
				amount: given.amount,
				sourceType: 'consume',
				sourceId: 'job-1',
				description: 'consume test'
			})
			return {
				errorCode: '',
				nextBalance: result.balance,
				batchCalled: db._deductState.batchCalled
			}
		}

		try {
			await runPaidActionWithCredits({
				db,
				userId: 'u1',
				amount: given.amount,
				sourceType: 'consume',
				sourceId: 'job-2',
				description: 'paid action test',
				execute: async (): Promise<void> => {
					throw new CreditsError('BUSINESS_FAILED')
				}
			})
			return {
				errorCode: '',
				nextBalance: 0,
				batchCalled: db._deductState.batchCalled
			}
		} catch (error) {
			return {
				errorCode: error instanceof CreditsError ? error.code : 'UNKNOWN',
				nextBalance: 0,
				batchCalled: db._deductState.batchCalled
			}
		}
	})
})

type DeductMockState = {
	batchCalled: boolean
}

type DeductMockDb = AppDb & {
	_deductState: DeductMockState
}

function createDeductMockDb(
	userBalance: number | null,
	entries: Array<{ id: string; remaining_amount: number }> = []
): DeductMockDb {
	const state: DeductMockState = {
		batchCalled: false
	}

	return {
		_deductState: state,
		query: {
			user: {
				findFirst: async (): Promise<{ id: string; creditBalance: number } | undefined> => {
					if (userBalance === null) {
						return undefined
					}
					return {
						id: 'u1',
						creditBalance: userBalance
					}
				}
			}
		},
		all: async (): Promise<Array<{ id: string; remaining_amount: number }>> => {
			return entries
		},
		run: (payload: unknown): unknown => {
			return payload
		},
		batch: async (): Promise<unknown[]> => {
			state.batchCalled = true
			return []
		}
	} as unknown as DeductMockDb
}

describe('expireCredits', () => {
	type GivenDetail = {
		expiredEntries: Array<{ id: string; user_id: string; remaining_amount: number }>
		users: Array<{ id: string; creditBalance: number }>
		limit?: number
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		processedEntries: number
		processedUsers: number
		batchCalled: boolean
		statementCount: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'skip when no expired entries',
			given: 'query returns empty expired list',
			when: 'expireCredits is called',
			then: 'no batch write happens',
			givenDetail: {
				expiredEntries: [],
				users: []
			},
			whenDetail: {},
			thenExpected: {
				processedEntries: 0,
				processedUsers: 0,
				batchCalled: false,
				statementCount: 0
			}
		},
		{
			scenario: 'process fixed number of expired entries and grouped users',
			given: 'expired entries contain two users',
			when: 'expireCredits is called',
			then: 'returns processed counts and runs one batch',
			givenDetail: {
				expiredEntries: [
					{ id: 'e1', user_id: 'u1', remaining_amount: 3 },
					{ id: 'e2', user_id: 'u1', remaining_amount: 2 },
					{ id: 'e3', user_id: 'u2', remaining_amount: 5 }
				],
				users: [
					{ id: 'u1', creditBalance: 10 },
					{ id: 'u2', creditBalance: 8 }
				],
				limit: 20
			},
			whenDetail: {},
			thenExpected: {
				processedEntries: 3,
				processedUsers: 2,
				batchCalled: true,
				statementCount: 7
			}
		}
	]

	runCases(cases, async (given) => {
		const db = createExpireMockDb(given.expiredEntries, given.users)
		const result = await expireCredits({
			db,
			nowMs: 1890000000000,
			limit: given.limit
		})

		return {
			processedEntries: result.processedEntries,
			processedUsers: result.processedUsers,
			batchCalled: db._expireState.batchCalled,
			statementCount: db._expireState.statements.length
		}
	})
})

describe('cleanupCreditTransactions', () => {
	type GivenDetail = {
		changes: number
		retentionDays?: number
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		deletedRows: number
		called: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'delete old transactions with default retention',
			given: 'run returns affected rows',
			when: 'cleanupCreditTransactions is called',
			then: 'returns deleted rows',
			givenDetail: {
				changes: 4
			},
			whenDetail: {},
			thenExpected: {
				deletedRows: 4,
				called: true
			}
		},
		{
			scenario: 'support explicit retention days',
			given: 'retention days is provided',
			when: 'cleanupCreditTransactions is called',
			then: 'still returns affected rows',
			givenDetail: {
				changes: 2,
				retentionDays: 30
			},
			whenDetail: {},
			thenExpected: {
				deletedRows: 2,
				called: true
			}
		}
	]

	runCases(cases, async (given) => {
		const db = createCleanupMockDb(given.changes)
		const result = await cleanupCreditTransactions({
			db,
			nowMs: 1890000000000,
			retentionDays: given.retentionDays
		})
		return {
			deletedRows: result.deletedRows,
			called: db._cleanupState.called
		}
	})
})

type ExpireMockState = {
	batchCalled: boolean
	statements: unknown[]
}

type ExpireMockDb = AppDb & {
	_expireState: ExpireMockState
}

function createExpireMockDb(
	expiredEntries: Array<{ id: string; user_id: string; remaining_amount: number }>,
	users: Array<{ id: string; creditBalance: number }>
): ExpireMockDb {
	const state: ExpireMockState = {
		batchCalled: false,
		statements: []
	}

	return {
		_expireState: state,
		all: async (): Promise<Array<{ id: string; user_id: string; remaining_amount: number }>> => {
			return expiredEntries
		},
		select: (): {
			from: (_table: unknown) => {
				where: (_condition: unknown) => Promise<Array<{ id: string; creditBalance: number }>>
			}
		} => {
			return {
				from: () => {
					return {
						where: async () => users
					}
				}
			}
		},
		run: (payload: unknown): unknown => {
			return payload
		},
		batch: async (statements: unknown[]): Promise<unknown[]> => {
			state.batchCalled = true
			state.statements = statements
			return []
		}
	} as unknown as ExpireMockDb
}

type CleanupMockState = {
	called: boolean
}

type CleanupMockDb = AppDb & {
	_cleanupState: CleanupMockState
}

function createCleanupMockDb(changes: number): CleanupMockDb {
	const state: CleanupMockState = {
		called: false
	}

	return {
		_cleanupState: state,
		run: async (): Promise<{ meta: { changes: number } }> => {
			state.called = true
			return {
				meta: {
					changes
				}
			}
		}
	} as unknown as CleanupMockDb
}
