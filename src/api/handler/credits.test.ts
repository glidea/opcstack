import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import {
	dailyCheckinHandler,
	getCreditSummaryHandler,
	listCreditTransactionsHandler,
	type ListCreditTransactionsRequest
} from './credits'
import {
	CreditsError,
	dailyCheckin,
	getCreditSummary,
	listCreditTransactions
} from '../../credits'
import type { Context } from 'hono'
import type { ApiEnv } from '..'

vi.mock('../../credits', async () => {
	const actual = await vi.importActual<typeof import('../../credits')>('../../credits')
	return {
		...actual,
		dailyCheckin: vi.fn(),
		getCreditSummary: vi.fn(),
		listCreditTransactions: vi.fn()
	}
})

describe('getCreditSummaryHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		referralEnabled: string
		dailyCheckinAmount: string
		summaryErrorCode: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		dailyCheckedIn: boolean
		invitedCount: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'map summary fields into response',
			given: 'summary query succeeds',
			when: 'calling getCreditSummaryHandler',
			then: 'returns snake_case response',
			givenDetail: {
				referralEnabled: 'true',
				dailyCheckinAmount: '10',
				summaryErrorCode: ''
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				dailyCheckedIn: true,
				invitedCount: 3
			}
		},
		{
			scenario: 'return 404 when user is missing',
			given: 'summary query throws CREDIT_USER_NOT_FOUND',
			when: 'calling getCreditSummaryHandler',
			then: 'returns 404 with code',
			givenDetail: {
				referralEnabled: 'false',
				dailyCheckinAmount: '0',
				summaryErrorCode: 'CREDIT_USER_NOT_FOUND'
			},
			whenDetail: {},
			thenExpected: {
				status: 404,
				code: 'CREDIT_USER_NOT_FOUND',
				dailyCheckedIn: false,
				invitedCount: 0
			}
		}
	]

	runCases(cases, async (given) => {
		if (given.summaryErrorCode !== '') {
			vi.mocked(getCreditSummary).mockRejectedValue(new CreditsError(given.summaryErrorCode))
		} else {
			vi.mocked(getCreditSummary).mockResolvedValue({
				balance: 120,
				dailyCheckedIn: true,
				dailyCheckinAmount: 10,
				referralEnabled: true,
				referralCode: 'ABC12345',
				invitedCount: 3
			})
		}

		const ctx = createJsonContext({
			env: {
				CREDITS_REFERRAL_ENABLED: given.referralEnabled,
				CREDITS_DAILY_CHECKIN_AMOUNT: given.dailyCheckinAmount
			},
			userId: 'u1',
			db: {},
			body: {}
		})
		const res = await getCreditSummaryHandler(ctx)
		const payload = (await res.json()) as {
			code?: string
			daily_checked_in?: boolean
			invited_count?: number
		}
		return {
			status: res.status,
			code: payload.code ?? '',
			dailyCheckedIn: payload.daily_checked_in ?? false,
			invitedCount: payload.invited_count ?? 0
		}
	})
})

describe('dailyCheckinHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		enabled: string
		amount: string
		errorCode: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		checkedIn: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'skip checkin when feature is disabled',
			given: 'daily checkin switch is false',
			when: 'calling dailyCheckinHandler',
			then: 'returns empty object',
			givenDetail: {
				enabled: 'false',
				amount: '10',
				errorCode: ''
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				checkedIn: false
			}
		},
		{
			scenario: 'reject invalid daily checkin amount',
			given: 'daily checkin amount is zero',
			when: 'calling dailyCheckinHandler',
			then: 'returns invalid amount',
			givenDetail: {
				enabled: 'true',
				amount: '0',
				errorCode: ''
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'INVALID_DAILY_CHECKIN_AMOUNT',
				checkedIn: false
			}
		},
		{
			scenario: 'return duplicated code when user checked in already',
			given: 'dailyCheckin core throws DAILY_CHECKIN_ALREADY_DONE',
			when: 'calling dailyCheckinHandler',
			then: 'returns 409 duplicated error',
			givenDetail: {
				enabled: 'true',
				amount: '10',
				errorCode: 'DAILY_CHECKIN_ALREADY_DONE'
			},
			whenDetail: {},
			thenExpected: {
				status: 409,
				code: 'DAILY_CHECKIN_ALREADY_DONE',
				checkedIn: false
			}
		},
		{
			scenario: 'checkin success returns checked_in true',
			given: 'daily checkin feature enabled and core call succeeds',
			when: 'calling dailyCheckinHandler',
			then: 'returns balance and checked_in',
			givenDetail: {
				enabled: 'true',
				amount: '10',
				errorCode: ''
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				checkedIn: true
			}
		}
	]

	runCases(cases, async (given) => {
		if (given.errorCode !== '') {
			vi.mocked(dailyCheckin).mockRejectedValue(new CreditsError(given.errorCode))
		} else {
			vi.mocked(dailyCheckin).mockResolvedValue({
				balance: 100,
				checkedIn: true,
				amount: 10
			})
		}

		const ctx = createJsonContext({
			env: {
				CREDITS_DAILY_CHECKIN_ENABLED: given.enabled,
				CREDITS_DAILY_CHECKIN_AMOUNT: given.amount
			},
			userId: 'u1',
			db: {},
			body: {}
		})
		const res = await dailyCheckinHandler(ctx)
		const payload = (await res.json()) as { code?: string; checked_in?: boolean }
		return {
			status: res.status,
			code: payload.code ?? '',
			checkedIn: payload.checked_in ?? false
		}
	})
})

describe('listCreditTransactionsHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		body: ListCreditTransactionsRequest | null
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		transactionCount: number
		firstBalanceAfter: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'reject invalid request body',
			given: 'json parse failed',
			when: 'calling listCreditTransactionsHandler',
			then: 'returns invalid request',
			givenDetail: {
				body: null
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'INVALID_REQUEST',
				transactionCount: 0,
				firstBalanceAfter: 0
			}
		},
		{
			scenario: 'map transactions to snake_case',
			given: 'query returns one transaction',
			when: 'calling listCreditTransactionsHandler',
			then: 'returns mapped response list',
			givenDetail: {
				body: {
					limit: 20,
					offset: 0
				}
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				transactionCount: 1,
				firstBalanceAfter: 99
			}
		}
	]

	runCases(cases, async (given) => {
		vi.mocked(listCreditTransactions).mockResolvedValue([
			{
				id: 't1',
				type: 'signup',
				amount: 100,
				balanceAfter: 99,
				sourceType: 'signup',
				sourceId: 'u1',
				description: 'desc',
				expiresAt: null,
				createdAt: 123
			}
		])
		const ctx = createJsonContext({
			env: {},
			userId: 'u1',
			db: {},
			body: given.body
		})
		const res = await listCreditTransactionsHandler(ctx)
		const payload = (await res.json()) as {
			code?: string
			transactions?: Array<{ balance_after: number }>
		}
		return {
			status: res.status,
			code: payload.code ?? '',
			transactionCount: payload.transactions?.length ?? 0,
			firstBalanceAfter: payload.transactions?.[0]?.balance_after ?? 0
		}
	})
})

function createJsonContext(input: {
	env: Record<string, string>
	userId: string
	db: unknown
	body: unknown
}): Context<ApiEnv> {
	const req = {
		json: async <U>(): Promise<U> => {
			if (input.body === null) {
				throw new Error('invalid json')
			}
			return input.body as U
		}
	}

	const ctx = {
		env: input.env,
		req,
		get: (key: string): unknown => {
			if (key === 'userId') {
				return input.userId
			}
			return input.db
		},
		json: (payload: unknown, status?: number): Response => {
			return new Response(JSON.stringify(payload), {
				status: status ?? 200,
				headers: {
					'content-type': 'application/json'
				}
			})
		}
	}

	return ctx as unknown as Context<ApiEnv>
}
