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
		batchErrorCauseMessage: string
	}
	type WhenDetail = {
		affCode: string
		inviteeUserId: string
	}
	type ThenExpected = {
		errorCode: string
		insertedReferral: boolean
		inviterUserId: string
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
				batchErrorMessage: '',
				batchErrorCauseMessage: ''
			},
			whenDetail: {
				affCode: ' ',
				inviteeUserId: 'u1'
			},
			thenExpected: {
				errorCode: 'INVALID_AFF_CODE',
				insertedReferral: false,
				inviterUserId: ''
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
				batchErrorMessage: '',
				batchErrorCauseMessage: ''
			},
			whenDetail: {
				affCode: 'ABC12345',
				inviteeUserId: 'u1'
			},
			thenExpected: {
				errorCode: 'INVALID_AFF_CODE',
				insertedReferral: false,
				inviterUserId: ''
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
				batchErrorMessage: '',
				batchErrorCauseMessage: ''
			},
			whenDetail: {
				affCode: 'ABC12345',
				inviteeUserId: 'u1'
			},
			thenExpected: {
				errorCode: 'AFF_USER_NOT_FOUND',
				insertedReferral: false,
				inviterUserId: ''
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
				batchErrorMessage: 'UNIQUE constraint failed: aff_referrals.invitee_user_id',
				batchErrorCauseMessage: ''
			},
			whenDetail: {
				affCode: 'ABC12345',
				inviteeUserId: 'u1'
			},
			thenExpected: {
				errorCode: 'AFF_ALREADY_BOUND',
				insertedReferral: true,
				inviterUserId: ''
			}
		},
		{
			scenario: 'reject duplicated binding from wrapped D1 error',
			given: 'drizzle wraps unique invitee error as cause',
			when: 'AffService.bind is called',
			then: 'returns already bound',
			givenDetail: {
				inviterUserId: 'u2',
				inviteeExists: true,
				batchErrorMessage: 'Failed query',
				batchErrorCauseMessage: 'UNIQUE constraint failed: aff_referrals.invitee_user_id'
			},
			whenDetail: {
				affCode: 'ABC12345',
				inviteeUserId: 'u1'
			},
			thenExpected: {
				errorCode: 'AFF_ALREADY_BOUND',
				insertedReferral: true,
				inviterUserId: ''
			}
		},
		{
			scenario: 'bind aff successfully',
			given: 'inviter and invitee exist',
			when: 'AffService.bind is called',
			then: 'writes relation and returns inviter',
			givenDetail: {
				inviterUserId: 'u2',
				inviteeExists: true,
				batchErrorMessage: '',
				batchErrorCauseMessage: ''
			},
			whenDetail: {
				affCode: 'ABC12345',
				inviteeUserId: 'u1'
			},
			thenExpected: {
				errorCode: '',
				insertedReferral: true,
				inviterUserId: 'u2'
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
			batchErrorMessage: given.batchErrorMessage,
			batchErrorCauseMessage: given.batchErrorCauseMessage
		})
		const aff = new AffService(db)
		const input: BindAffInput = {
			inviteeUserId: when.inviteeUserId,
			affCode: when.affCode,
			nowMs: 1890000000000
		}

		try {
			const result = await aff.bind(input)
			return {
				errorCode: '',
				insertedReferral: db._state.insertedReferral,
				inviterUserId: result.inviterUserId
			}
		} catch (error) {
			return {
				errorCode: error instanceof AffError ? error.code : 'UNKNOWN',
				insertedReferral: db._state.insertedReferral,
				inviterUserId: ''
			}
		}
	})
})

type AffMockState = {
	insertedReferral: boolean
}

type AffMockDb = AppDb & {
	_state: AffMockState
}

function createAffMockDb(input: {
	userExists: boolean
	affCode: string | null
	invitedCount: number
	inviterUserId?: string | null
	inviteeExists?: boolean
	batchErrorMessage?: string
	batchErrorCauseMessage?: string
}): AffMockDb {
	const state: AffMockState = {
		insertedReferral: false
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
							affCode: input.affCode
						}
					}
					if (input.userExists === false || input.inviteeExists === false) {
						return undefined
					}
					return {
						id: 'u1',
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
		insert: (): {
			values: (_row: unknown) => Promise<void>
		} => {
			return {
				values: async (): Promise<void> => {
					state.insertedReferral = true
					if (input.batchErrorMessage) {
						const error = new Error(input.batchErrorMessage) as Error & { cause?: Error }
						if (input.batchErrorCauseMessage) {
							error.cause = new Error(input.batchErrorCauseMessage)
						}
						throw error
					}
				}
			}
		}
	} as unknown as AffMockDb

	return db
}
