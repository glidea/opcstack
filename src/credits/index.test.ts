import { describe, expect } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import { CreditsError, grantCredits, type GrantCreditsInput } from './index'
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
