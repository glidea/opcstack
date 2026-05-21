import { describe } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import { AffError, AffService, type BindAffInput } from './index'
import type { AppDb } from '../db'

describe('AffService.getSummary', () => {
	type GivenDetail = {
		userExists: boolean
		affCode: string | null
		invitedCount: number
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		errorCode: string
		affCode: string
		invitedCount: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'return aff summary',
			given: 'user exists and has invited users',
			when: 'AffService.getSummary is called',
			then: 'returns code and invited count',
			givenDetail: {
				userExists: true,
				affCode: 'ABC12345',
				invitedCount: 2
			},
			whenDetail: {},
			thenExpected: {
				errorCode: '',
				affCode: 'ABC12345',
				invitedCount: 2
			}
		},
		{
			scenario: 'reject missing user',
			given: 'user does not exist',
			when: 'AffService.getSummary is called',
			then: 'returns user not found',
			givenDetail: {
				userExists: false,
				affCode: null,
				invitedCount: 0
			},
			whenDetail: {},
			thenExpected: {
				errorCode: 'AFF_USER_NOT_FOUND',
				affCode: '',
				invitedCount: 0
			}
		}
	]

	runCases(cases, async (given) => {
		const db = createAffMockDb(given)
		const aff = new AffService(db)
		try {
			const result = await aff.getSummary({
				userId: 'u1'
			})
			return {
				errorCode: '',
				affCode: result.affCode,
				invitedCount: result.invitedCount
			}
		} catch (error) {
			return {
				errorCode: error instanceof AffError ? error.code : 'UNKNOWN',
				affCode: '',
				invitedCount: 0
			}
		}
	})
})

describe('AffService.bind', () => {
	type GivenDetail = {
		inviterUserId: string | null
		inviteeExists: boolean
		batchErrorMessage: string
	}
	type WhenDetail = {
		affCode: string
		inviteeUserId: string
	}
	type ThenExpected = {
		errorCode: string
		batchItemCount: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'reject empty aff code',
			given: 'aff code is blank',
			when: 'AffService.bind is called',
			then: 'returns invalid aff code',
			givenDetail: {
				inviterUserId: 'u2',
				inviteeExists: true,
				batchErrorMessage: ''
			},
			whenDetail: {
				affCode: ' ',
				inviteeUserId: 'u1'
			},
			thenExpected: {
				errorCode: 'INVALID_AFF_CODE',
				batchItemCount: 0
			}
		},
		{
			scenario: 'reject self invite',
			given: 'aff code belongs to invitee',
			when: 'AffService.bind is called',
			then: 'returns invalid aff code',
			givenDetail: {
				inviterUserId: 'u1',
				inviteeExists: true,
				batchErrorMessage: ''
			},
			whenDetail: {
				affCode: 'ABC12345',
				inviteeUserId: 'u1'
			},
			thenExpected: {
				errorCode: 'INVALID_AFF_CODE',
				batchItemCount: 0
			}
		},
		{
			scenario: 'reject missing invitee',
			given: 'invitee user does not exist',
			when: 'AffService.bind is called',
			then: 'returns user not found',
			givenDetail: {
				inviterUserId: 'u2',
				inviteeExists: false,
				batchErrorMessage: ''
			},
			whenDetail: {
				affCode: 'ABC12345',
				inviteeUserId: 'u1'
			},
			thenExpected: {
				errorCode: 'AFF_USER_NOT_FOUND',
				batchItemCount: 0
			}
		},
		{
			scenario: 'reject duplicated binding',
			given: 'insert aff referral violates unique invitee',
			when: 'AffService.bind is called',
			then: 'returns already bound',
			givenDetail: {
				inviterUserId: 'u2',
				inviteeExists: true,
				batchErrorMessage: 'UNIQUE constraint failed: aff_referrals.invitee_user_id'
			},
			whenDetail: {
				affCode: 'ABC12345',
				inviteeUserId: 'u1'
			},
			thenExpected: {
				errorCode: 'AFF_ALREADY_BOUND',
				batchItemCount: 7
			}
		},
		{
			scenario: 'bind aff successfully',
			given: 'inviter and invitee exist',
			when: 'AffService.bind is called',
			then: 'writes relation and reward records',
			givenDetail: {
				inviterUserId: 'u2',
				inviteeExists: true,
				batchErrorMessage: ''
			},
			whenDetail: {
				affCode: 'ABC12345',
				inviteeUserId: 'u1'
			},
			thenExpected: {
				errorCode: '',
				batchItemCount: 7
			}
		}
	]

	runCases(cases, async (given, when) => {
		const db = createAffMockDb({
			userExists: true,
			affCode: given.inviterUserId === null ? null : when.affCode,
			invitedCount: 0,
			inviterUserId: given.inviterUserId,
			inviteeExists: given.inviteeExists,
			batchErrorMessage: given.batchErrorMessage
		})
		const aff = new AffService(db)
		const input: BindAffInput = {
			inviteeUserId: when.inviteeUserId,
			affCode: when.affCode,
			inviterCreditAmount: 50_000_000,
			inviteeCreditAmount: 20_000_000,
			nowMs: 1890000000000
		}

		try {
			await aff.bind(input)
			return {
				errorCode: '',
				batchItemCount: db._state.batchItems.length
			}
		} catch (error) {
			return {
				errorCode: error instanceof AffError ? error.code : 'UNKNOWN',
				batchItemCount: db._state.batchItems.length
			}
		}
	})
})

type AffMockState = {
	batchItems: unknown[]
}

type AffMockDb = AppDb & {
	_state: AffMockState
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

function createAffMockDb(input: {
	userExists: boolean
	affCode: string | null
	invitedCount: number
	inviterUserId?: string | null
	inviteeExists?: boolean
	batchErrorMessage?: string
}): AffMockDb {
	const state: AffMockState = {
		batchItems: []
	}

	const db = {
		_state: state,
		query: {
			user: {
				findFirst: async (query: { columns: Record<string, boolean> }): Promise<unknown> => {
					if (query.columns['affCode']) {
						if (input.inviterUserId === null || input.affCode === null) {
							return undefined
						}
						return {
							id: input.inviterUserId ?? 'u2',
							creditBalance: 100,
							affCode: input.affCode
						}
					}
					if (input.userExists === false || input.inviteeExists === false) {
						return undefined
					}
					return {
						id: 'u1',
						creditBalance: 10,
						affCode: input.affCode
					}
				}
			}
		},
		select: (): {
			from: (_table: unknown) => {
				where: (_condition: unknown) => Promise<Array<{ count: number }>>
			}
		} => {
			return {
				from: () => {
					return {
						where: async () => [{ count: input.invitedCount }]
					}
				}
			}
		},
		run: (payload: unknown): MockRawRunQuery => {
			return createMockRawRunQuery(payload)
		},
		batch: async (items: unknown[]): Promise<unknown[]> => {
			state.batchItems = items
			if (input.batchErrorMessage) {
				throw new Error(input.batchErrorMessage)
			}
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
			batch: async (items: unknown[]): Promise<unknown[]> => {
				state.batchItems = items
				if (input.batchErrorMessage) {
					throw new Error(input.batchErrorMessage)
				}
				return []
			}
		}
	} as unknown as AffMockDb

	return db
}
