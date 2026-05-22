import { describe, expect } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import { CreditsError, CreditsService, type DeductCreditsInput, type GrantCreditsInput } from './index'
import type { AppDb } from '../db'

describe('CreditsService.grant', () => {
	type GivenDetail = {
		userBalance: number | null
		amount: number
		batchErrorMessage: string
		duplicatedSource: boolean
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		errorCode: string
		balance: number
		entryRemainingAmount: number
		duplicated: boolean
		batchItemCount: number
		changedRows: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'grant credits for normal positive balance user',
			given: 'user has non-negative balance and positive grant amount',
			when: 'CreditsService.grant is called',
			then: 'balance grows and entry remaining amount equals grant amount',
			givenDetail: {
				userBalance: 10,
				amount: 30,
				batchErrorMessage: '',
				duplicatedSource: false
			},
			whenDetail: {},
			thenExpected: {
				errorCode: '',
				balance: 40,
				entryRemainingAmount: 30,
				duplicated: false,
				batchItemCount: 4,
				changedRows: 1
			}
		},
		{
			scenario: 'repay debt first when user balance is negative',
			given: 'user has negative balance and grant amount is smaller than debt',
			when: 'CreditsService.grant is called',
			then: 'entry remaining amount becomes zero',
			givenDetail: {
				userBalance: -20,
				amount: 10,
				batchErrorMessage: '',
				duplicatedSource: false
			},
			whenDetail: {},
			thenExpected: {
				errorCode: '',
				balance: -10,
				entryRemainingAmount: 0,
				duplicated: false,
				batchItemCount: 4,
				changedRows: 1
			}
		},
		{
			scenario: 'keep remaining amount after debt repayment',
			given: 'user has negative balance and grant amount is larger than debt',
			when: 'CreditsService.grant is called',
			then: 'entry remaining amount is leftover after debt repayment',
			givenDetail: {
				userBalance: -8,
				amount: 20,
				batchErrorMessage: '',
				duplicatedSource: false
			},
			whenDetail: {},
			thenExpected: {
				errorCode: '',
				balance: 12,
				entryRemainingAmount: 12,
				duplicated: false,
				batchItemCount: 4,
				changedRows: 1
			}
		},
		{
			scenario: 'return duplicated when same source is granted again',
			given: 'conditional credit entry insert changes no rows',
			when: 'CreditsService.grant is called',
			then: 'returns duplicated result and keeps original balance',
			givenDetail: {
				userBalance: 10,
				amount: 20,
				batchErrorMessage: '',
				duplicatedSource: true
			},
			whenDetail: {},
			thenExpected: {
				errorCode: '',
				balance: 10,
				entryRemainingAmount: 0,
				duplicated: true,
				batchItemCount: 4,
				changedRows: 0
			}
		},
		{
			scenario: 'grant credits through raw d1 batch',
			given: 'drizzle raw batch cannot bind parameterized sql',
			when: 'CreditsService.grant is called',
			then: 'grant succeeds through d1 prepared batch',
			givenDetail: {
				userBalance: 10,
				amount: 30,
				batchErrorMessage: "Cannot read properties of undefined (reading 'bind')",
				duplicatedSource: false
			},
			whenDetail: {},
			thenExpected: {
				errorCode: '',
				balance: 40,
				entryRemainingAmount: 30,
				duplicated: false,
				batchItemCount: 4,
				changedRows: 1
			}
		},
		{
			scenario: 'reject invalid non-positive amount',
			given: 'grant amount is zero',
			when: 'CreditsService.grant is called',
			then: 'returns invalid amount error',
			givenDetail: {
				userBalance: 10,
				amount: 0,
				batchErrorMessage: '',
				duplicatedSource: false
			},
			whenDetail: {},
			thenExpected: {
				errorCode: 'INVALID_CREDIT_AMOUNT',
				balance: 0,
				entryRemainingAmount: 0,
				duplicated: false,
				batchItemCount: 0,
				changedRows: 0
			}
		},
		{
			scenario: 'reject missing user',
			given: 'user does not exist',
			when: 'CreditsService.grant is called',
			then: 'returns user not found error',
			givenDetail: {
				userBalance: null,
				amount: 10,
				batchErrorMessage: '',
				duplicatedSource: false
			},
			whenDetail: {},
			thenExpected: {
				errorCode: 'CREDIT_USER_NOT_FOUND',
				balance: 0,
				entryRemainingAmount: 0,
				duplicated: false,
				batchItemCount: 4,
				changedRows: 0
			}
		}
	]

	runCases(cases, async (given) => {
		const db = createMockDb(given)
		const credits = new CreditsService(db)

		const input: GrantCreditsInput = {
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
			const result = await credits.grant(input)
			return {
				errorCode: '',
				balance: result.balance,
				entryRemainingAmount: result.entryRemainingAmount,
				duplicated: result.duplicated,
				batchItemCount: db._state.batchItems.length,
				changedRows: db._state.changes
			}
		} catch (error) {
			return {
				errorCode: error instanceof CreditsError ? error.code : 'UNKNOWN',
				balance: 0,
				entryRemainingAmount: 0,
				duplicated: false,
				batchItemCount: db._state.batchItems.length,
				changedRows: db._state.changes
			}
		}
	})
})

describe('CreditsService payment source idempotency', () => {
	type GivenDetail = {
		caseName: 'different_grant_sources' | 'same_grant_source' | 'same_refund_source'
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		firstBalance: number
		secondBalance: number
		firstDuplicated: boolean
		secondDuplicated: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'accumulate payment grants from different sources',
			given: 'two different payment transaction sources',
			when: 'granting both sources',
			then: 'balance includes both grants',
			givenDetail: {
				caseName: 'different_grant_sources'
			},
			whenDetail: {},
			thenExpected: {
				firstBalance: 40,
				secondBalance: 80,
				firstDuplicated: false,
				secondDuplicated: false
			}
		},
		{
			scenario: 'deduplicate payment grant from same source',
			given: 'same payment transaction source is retried',
			when: 'granting same source twice',
			then: 'second grant keeps balance unchanged',
			givenDetail: {
				caseName: 'same_grant_source'
			},
			whenDetail: {},
			thenExpected: {
				firstBalance: 40,
				secondBalance: 40,
				firstDuplicated: false,
				secondDuplicated: true
			}
		},
		{
			scenario: 'deduplicate refund deduction from same source',
			given: 'same payment refund source is retried',
			when: 'deducting same source twice',
			then: 'second deduction keeps balance unchanged',
			givenDetail: {
				caseName: 'same_refund_source'
			},
			whenDetail: {},
			thenExpected: {
				firstBalance: 60,
				secondBalance: 60,
				firstDuplicated: false,
				secondDuplicated: true
			}
		}
	]

	runCases(cases, async (given) => {
		if (given.caseName === 'same_refund_source') {
			const db = createDeductSequenceMockDb(100, 40, [false, true])
			const credits = new CreditsService(db)
			const input: DeductCreditsInput = {
				userId: 'u1',
				type: 'payment_refund',
				amount: 40,
				sourceType: 'payment_refund',
				sourceId: 'dodo:rf_1',
				description: 'refund',
				nowMs: 1890000000000
			}
			const first = await credits.deduct(input)
			const second = await credits.deduct(input)
			return {
				firstBalance: first.balance,
				secondBalance: second.balance,
				firstDuplicated: first.duplicated,
				secondDuplicated: second.duplicated
			}
		}

		const duplicatedCalls = given.caseName === 'same_grant_source' ? [false, true] : [false, false]
		const db = createGrantSequenceMockDb(10, [30, 40], duplicatedCalls)
		const credits = new CreditsService(db)
		const firstInput: GrantCreditsInput = {
			userId: 'u1',
			type: 'payment_purchase',
			amount: 30,
			sourceType: 'payment_transaction',
			sourceId: 'pt_1',
			description: 'payment',
			nowMs: 1890000000000
		}
		const secondInput: GrantCreditsInput = {
			userId: 'u1',
			type: 'payment_purchase',
			amount: 40,
			sourceType: 'payment_transaction',
			sourceId: given.caseName === 'same_grant_source' ? 'pt_1' : 'pt_2',
			description: 'payment',
			nowMs: 1890000000000
		}

		const first = await credits.grant(firstInput)
		const second = await credits.grant(secondInput)
		return {
			firstBalance: first.balance,
			secondBalance: second.balance,
			firstDuplicated: first.duplicated,
			secondDuplicated: second.duplicated
		}
	})
})

type MockDbState = {
	batchItems: unknown[]
	changes: number
}

type MockDb = AppDb & {
	_state: MockDbState
}

type MockRawRunQuery = {
	getQuery: () => {
		sql: string
		params: unknown[]
	}
}

function createMockRawRunQuery(payload: unknown): MockRawRunQuery {
	return {
		getQuery: () => {
			return {
				sql: String(payload),
				params: [payload]
			}
		}
	}
}

function createMockDb(given: {
	userBalance: number | null
	amount: number
	batchErrorMessage: string
	duplicatedSource: boolean
}): MockDb {
	const state: MockDbState = {
		batchItems: [],
		changes: 0
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
		select: (): {
			from: (_table: unknown) => {
				innerJoin: (_table: unknown, _condition: unknown) => {
					where: (_condition: unknown) => Promise<Array<{ balance: number; entryRemainingAmount: number }>>
				}
			}
		} => {
			return {
				from: () => {
					return {
						innerJoin: () => {
							return {
								where: async () => {
									const userBalance = given.userBalance ?? 0
									return [
										{
											balance: userBalance + given.amount,
											entryRemainingAmount: resolveTestEntryRemainingAmount(userBalance, given.amount)
										}
									]
								}
							}
						}
					}
				}
			}
		},
		run: (payload: unknown): MockRawRunQuery => {
			return createMockRawRunQuery(payload)
		},
		batch: async (items: unknown[]): Promise<unknown[]> => {
			state.batchItems = items
			if (given.batchErrorMessage !== '') {
				throw new Error(given.batchErrorMessage)
			}
			state.changes = given.userBalance !== null && !given.duplicatedSource ? 1 : 0
			return [
				{
					meta: {
						changes: state.changes
					}
				}
			]
		},
		$client: {
			prepare: (query: string): { bind: (...params: unknown[]) => unknown } => {
				return {
					bind: (...params: unknown[]) => {
						return {
							query,
							params
						}
					}
				}
			},
			batch: async (items: unknown[]): Promise<unknown[]> => {
				state.batchItems = items
				state.changes = given.userBalance !== null && !given.duplicatedSource ? 1 : 0
				return [
					{
						meta: {
							changes: state.changes
						}
					}
				]
			}
		}
	} as unknown as MockDb

	return db
}

function resolveTestEntryRemainingAmount(currentBalance: number, amount: number): number {
	const debtToRepay = currentBalance < 0 ? Math.min(-currentBalance, amount) : 0
	return amount - debtToRepay
}

type GrantSequenceMockState = {
	balance: number
	lastAmount: number
	amounts: number[]
	duplicatedCalls: boolean[]
}

type GrantSequenceMockDb = AppDb & {
	_grantSequenceState: GrantSequenceMockState
}

function createGrantSequenceMockDb(
	initialBalance: number,
	amounts: number[],
	duplicatedCalls: boolean[]
): GrantSequenceMockDb {
	const state: GrantSequenceMockState = {
		balance: initialBalance,
		lastAmount: 0,
		amounts: [...amounts],
		duplicatedCalls: [...duplicatedCalls]
	}

	return {
		_grantSequenceState: state,
		query: {
			user: {
				findFirst: async (): Promise<{ id: string; creditBalance: number } | undefined> => {
					return {
						id: 'u1',
						creditBalance: state.balance
					}
				}
			}
		},
		select: (): {
			from: (_table: unknown) => {
				innerJoin: (_table: unknown, _condition: unknown) => {
					where: (_condition: unknown) => Promise<Array<{ balance: number; entryRemainingAmount: number }>>
				}
			}
		} => {
			return {
				from: () => {
					return {
						innerJoin: () => {
							return {
								where: async () => [
									{
										balance: state.balance,
										entryRemainingAmount: state.lastAmount
									}
								]
							}
						}
					}
				}
			}
		},
		run: (payload: unknown): MockRawRunQuery => {
			return createMockRawRunQuery(payload)
		},
		$client: {
			prepare: (query: string): { bind: (...params: unknown[]) => unknown } => {
				return {
					bind: (...params: unknown[]) => {
						return {
							query,
							params
						}
					}
				}
			},
			batch: async (): Promise<unknown[]> => {
				const amount = state.amounts.shift() ?? 0
				const duplicated = state.duplicatedCalls.shift() ?? false
				state.lastAmount = duplicated ? 0 : amount
				if (!duplicated) {
					state.balance += amount
				}
				return [
					{
						meta: {
							changes: duplicated ? 0 : 1
						}
					}
				]
			}
		}
	} as unknown as GrantSequenceMockDb
}

describe('CreditsService.ensureEnough', () => {
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
			when: 'CreditsService.ensureEnough is called',
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
			when: 'CreditsService.ensureEnough is called',
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
		const credits = new CreditsService(db)
		try {
			const result = await credits.ensureEnough({
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

describe('CreditsService.deduct and CreditsService.runPaidAction', () => {
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
		duplicated: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'deduct allows balance to become negative',
			given: 'user has low balance and deduction is larger',
			when: 'CreditsService.deduct is called',
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
				batchCalled: true,
				duplicated: false
			}
		},
		{
			scenario: 'business failure path does not deduct credits',
			given: 'ensure passes but business throws error',
			when: 'CreditsService.runPaidAction is called',
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
				batchCalled: false,
				duplicated: false
			}
		}
	]

	runCases(cases, async (given) => {
		const db = createDeductMockDb(given.initialBalance, given.entries, given.amount)
		const credits = new CreditsService(db)

		if (!given.executeThrows) {
			const result = await credits.deduct({
				userId: 'u1',
				amount: given.amount,
				sourceType: 'consume',
				sourceId: 'job-1',
				description: 'consume test'
			})
			return {
				errorCode: '',
				nextBalance: result.balance,
				batchCalled: db._deductState.batchCalled,
				duplicated: result.duplicated
			}
		}

		try {
			await credits.runPaidAction({
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
				batchCalled: db._deductState.batchCalled,
				duplicated: false
			}
		} catch (error) {
			return {
				errorCode: error instanceof CreditsError ? error.code : 'UNKNOWN',
				nextBalance: 0,
				batchCalled: db._deductState.batchCalled,
				duplicated: false
			}
		}
	})
})

type DeductMockState = {
	batchCalled: boolean
	nextBalance: number
}

type DeductMockDb = AppDb & {
	_deductState: DeductMockState
}

function createDeductMockDb(
	userBalance: number | null,
	entries: Array<{ id: string; remaining_amount: number }> = [],
	deductAmount = 0
): DeductMockDb {
	const state: DeductMockState = {
		batchCalled: false,
		nextBalance: userBalance ?? 0
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
		run: (payload: unknown): MockRawRunQuery => {
			return createMockRawRunQuery(payload)
		},
		batch: async (): Promise<unknown[]> => {
			state.batchCalled = true
			state.nextBalance = (userBalance ?? 0) - deductAmount
			return [
				{
					meta: {
						changes: 1
					}
				}
			]
		},
		$client: {
			prepare: (query: string): { bind: (...params: unknown[]) => unknown } => {
				return {
					bind: (...params: unknown[]) => {
						return {
							query,
							params
						}
					}
				}
			},
			batch: async (): Promise<unknown[]> => {
				state.batchCalled = true
				state.nextBalance = (userBalance ?? 0) - deductAmount
				return [
					{
						meta: {
							changes: 1
						}
					}
				]
			}
		},
		select: (): {
			from: (_table: unknown) => {
				where: (_condition: unknown) => Promise<Array<{ creditBalance: number }>>
			}
		} => {
			return {
				from: () => {
					return {
						where: async () => [
							{
								creditBalance: state.nextBalance
							}
						]
					}
				}
			}
		}
	} as unknown as DeductMockDb
}

type DeductSequenceMockState = {
	balance: number
	amount: number
	duplicatedCalls: boolean[]
}

type DeductSequenceMockDb = AppDb & {
	_deductSequenceState: DeductSequenceMockState
}

function createDeductSequenceMockDb(
	initialBalance: number,
	amount: number,
	duplicatedCalls: boolean[]
): DeductSequenceMockDb {
	const state: DeductSequenceMockState = {
		balance: initialBalance,
		amount,
		duplicatedCalls: [...duplicatedCalls]
	}

	return {
		_deductSequenceState: state,
		query: {
			user: {
				findFirst: async (): Promise<{ id: string; creditBalance: number } | undefined> => {
					return {
						id: 'u1',
						creditBalance: state.balance
					}
				}
			}
		},
		run: (payload: unknown): MockRawRunQuery => {
			return createMockRawRunQuery(payload)
		},
		$client: {
			prepare: (query: string): { bind: (...params: unknown[]) => unknown } => {
				return {
					bind: (...params: unknown[]) => {
						return {
							query,
							params
						}
					}
				}
			},
			batch: async (): Promise<unknown[]> => {
				const duplicated = state.duplicatedCalls.shift() ?? false
				if (!duplicated) {
					state.balance -= state.amount
				}
				return [
					{
						meta: {
							changes: duplicated ? 0 : 1
						}
					}
				]
			}
		},
		select: (): {
			from: (_table: unknown) => {
				where: (_condition: unknown) => Promise<Array<{ creditBalance: number }>>
			}
		} => {
			return {
				from: () => {
					return {
						where: async () => [
							{
								creditBalance: state.balance
							}
						]
					}
				}
			}
		}
	} as unknown as DeductSequenceMockDb
}

describe('CreditsService.expire', () => {
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
			when: 'CreditsService.expire is called',
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
			when: 'CreditsService.expire is called',
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
		const credits = new CreditsService(db)
		const result = await credits.expire({
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

describe('CreditsService.cleanupTransactions', () => {
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
			when: 'CreditsService.cleanupTransactions is called',
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
			when: 'CreditsService.cleanupTransactions is called',
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
		const credits = new CreditsService(db)
		const result = await credits.cleanupTransactions({
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
		run: (payload: unknown): MockRawRunQuery => {
			return createMockRawRunQuery(payload)
		},
		batch: async (statements: unknown[]): Promise<unknown[]> => {
			state.batchCalled = true
			state.statements = statements
			return []
		},
		$client: {
			prepare: (query: string): { bind: (...params: unknown[]) => unknown } => {
				return {
					bind: (...params: unknown[]) => {
						return {
							query,
							params
						}
					}
				}
			},
			batch: async (statements: unknown[]): Promise<unknown[]> => {
				state.batchCalled = true
				state.statements = statements
				return []
			}
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
