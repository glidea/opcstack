import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import {
	dailyCheckinHandler,
	generateCreditCodesHandler,
	grantCreditsHandler,
	getCreditSummaryHandler,
	listCreditCodesHandler,
	listCreditTransactionsHandler,
	redeemCreditCodeHandler,
	type ListCreditTransactionsRequest
} from './credits'
import { CreditsError } from '../../credits'

const creditServiceMocks = vi.hoisted(() => {
	return {
		constructorArgs: [] as unknown[][],
		dailyCheckin: vi.fn(),
		grant: vi.fn(),
		getSummary: vi.fn(),
		listTransactions: vi.fn()
	}
})

const creditRedemptionServiceMocks = vi.hoisted(() => {
	return {
		constructorArgs: [] as unknown[][],
		claimCode: vi.fn(),
		generateCodes: vi.fn(),
		listCodes: vi.fn(),
		markGranted: vi.fn()
	}
})

const shardRouterMocks = vi.hoisted(() => {
	return {
		openUserDb: vi.fn()
	}
})
import type { Context } from 'hono'
import type { ApiEnv } from '..'

vi.mock('../../credits', async () => {
	const actual = await vi.importActual<typeof import('../../credits')>('../../credits')
	return {
		...actual,
		CreditsService: vi.fn().mockImplementation(function CreditsService(...args: unknown[]) {
			creditServiceMocks.constructorArgs.push(args)
			return creditServiceMocks
		}),
		CreditRedemptionService: vi
			.fn()
			.mockImplementation(function CreditRedemptionService(...args: unknown[]) {
				creditRedemptionServiceMocks.constructorArgs.push(args)
				return creditRedemptionServiceMocks
			})
	}
})

vi.mock('../../db/shard-router', () => {
	return {
		createTenantShardAccess: vi.fn(() => {
			return {
				openUserDb: shardRouterMocks.openUserDb
			}
		})
	}
})

beforeEach(() => {
	shardRouterMocks.openUserDb.mockResolvedValue({
		shardId: 'shard_0001',
		bindingName: 'TENANT_DB_0001',
		db: { name: 'admin-tenant' }
	})
	creditRedemptionServiceMocks.markGranted.mockResolvedValue(undefined)
})

describe('getCreditSummaryHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		creditServiceMocks.constructorArgs = []
	})

	type GivenDetail = {
		dailyCheckinAmount: string
		summaryErrorCode: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		dailyCheckedIn: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'map summary fields into response',
			given: 'summary query succeeds',
			when: 'calling getCreditSummaryHandler',
			then: 'returns snake_case response',
			givenDetail: {
				dailyCheckinAmount: '10',
				summaryErrorCode: ''
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				dailyCheckedIn: true
			}
		},
		{
			scenario: 'return 404 when user is missing',
			given: 'summary query throws CREDIT_USER_NOT_FOUND',
			when: 'calling getCreditSummaryHandler',
			then: 'returns 404 with code',
			givenDetail: {
				dailyCheckinAmount: '0',
				summaryErrorCode: 'CREDIT_USER_NOT_FOUND'
			},
			whenDetail: {},
			thenExpected: {
				status: 404,
				code: 'CREDIT_USER_NOT_FOUND',
				dailyCheckedIn: false
			}
		}
	]

	runCases(cases, async (given) => {
		if (given.summaryErrorCode !== '') {
			vi.mocked(creditServiceMocks.getSummary).mockRejectedValue(new CreditsError(given.summaryErrorCode))
		} else {
			vi.mocked(creditServiceMocks.getSummary).mockResolvedValue({
				balance: 120_000_000,
				dailyCheckedIn: true,
				dailyCheckinAmount: 10_000_000
			})
		}

		const ctx = createJsonContext({
			env: {
				CREDITS_DAILY_CHECKIN_AMOUNT: given.dailyCheckinAmount
			},
			userId: 'u1',
			metaDb: { name: 'meta' },
			tenantDb: { name: 'tenant' },
			body: {}
		})
		const res = await getCreditSummaryHandler(ctx)
		const payload = (await res.json()) as {
			code?: string
			daily_checked_in?: boolean
		}
		return {
			status: res.status,
			code: payload.code ?? '',
			dailyCheckedIn: payload.daily_checked_in ?? false
		}
	})
})

describe('dailyCheckinHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		creditServiceMocks.constructorArgs = []
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
			vi.mocked(creditServiceMocks.dailyCheckin).mockRejectedValue(new CreditsError(given.errorCode))
		} else {
			vi.mocked(creditServiceMocks.dailyCheckin).mockResolvedValue({
				balance: 100_000_000,
				checkedIn: true,
				amount: 10_000_000
			})
		}

		const ctx = createJsonContext({
			env: {
				CREDITS_DAILY_CHECKIN_ENABLED: given.enabled,
				CREDITS_DAILY_CHECKIN_AMOUNT: given.amount
			},
			userId: 'u1',
			metaDb: { name: 'meta' },
			tenantDb: { name: 'tenant' },
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

describe('generateCreditCodesHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		creditServiceMocks.constructorArgs = []
		creditRedemptionServiceMocks.constructorArgs = []
	})

	type GivenDetail = {
		body: unknown
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		codeCount: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'reject invalid generate request',
			given: 'request body has invalid amount',
			when: 'calling generateCreditCodesHandler',
			then: 'returns invalid request',
			givenDetail: {
				body: { count: 1, amount: 0 }
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'INVALID_REQUEST',
				codeCount: 0
			}
		},
		{
			scenario: 'generate code list successfully',
			given: 'request body is valid',
			when: 'calling generateCreditCodesHandler',
			then: 'returns generated code list',
			givenDetail: {
				body: { count: 2, amount: '100' }
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				codeCount: 2
			}
		}
	]

	runCases(cases, async (given) => {
		vi.mocked(creditRedemptionServiceMocks.generateCodes).mockResolvedValue([
			{ id: 'c1', code: 'AAAA1111', amount: 100_000_000, expiresAt: null, createdAt: 123 },
			{ id: 'c2', code: 'BBBB2222', amount: 100_000_000, expiresAt: null, createdAt: 123 }
		])

		const ctx = createJsonContext({
			env: {},
			userId: 'u1',
			metaDb: { name: 'meta' },
			tenantDb: { name: 'tenant' },
			body: given.body
		})
		const res = await generateCreditCodesHandler(ctx)
		const payload = (await res.json()) as { code?: string; codes?: unknown[] }
		return {
			status: res.status,
			code: payload.code ?? '',
			codeCount: payload.codes?.length ?? 0
		}
	})
})

describe('listCreditCodesHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		creditServiceMocks.constructorArgs = []
		creditRedemptionServiceMocks.constructorArgs = []
	})

	type GivenDetail = {
		body: unknown
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		codeCount: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'reject invalid list request',
			given: 'limit is invalid',
			when: 'calling listCreditCodesHandler',
			then: 'returns invalid request',
			givenDetail: {
				body: { page_size: 0 }
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'INVALID_REQUEST',
				codeCount: 0
			}
		},
		{
			scenario: 'list code rows successfully',
			given: 'request body is valid',
			when: 'calling listCreditCodesHandler',
			then: 'returns mapped list',
			givenDetail: {
				body: { page: 1, page_size: 10 }
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				codeCount: 1
			}
		}
	]

	runCases(cases, async (given) => {
		vi.mocked(creditRedemptionServiceMocks.listCodes).mockResolvedValue({
			codes: [
				{
					id: 'c1',
					code: 'AAAA1111',
					amount: 100_000_000,
					status: 'unused',
					expiresAt: null,
					claimedBy: null,
					claimedAt: null,
					grantedAt: null,
					createdAt: 123
				}
			],
			total: 1
		})

		const ctx = createJsonContext({
			env: {},
			userId: 'u1',
			metaDb: { name: 'meta' },
			tenantDb: { name: 'tenant' },
			body: given.body
		})
		const res = await listCreditCodesHandler(ctx)
		const payload = (await res.json()) as { code?: string; items?: unknown[] }
		return {
			status: res.status,
			code: payload.code ?? '',
			codeCount: payload.items?.length ?? 0
		}
	})
})

describe('redeemCreditCodeHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		creditServiceMocks.constructorArgs = []
		creditRedemptionServiceMocks.constructorArgs = []
	})

	type GivenDetail = {
		body: unknown
		errorCode: string
		grantError: string
		duplicatedGrant: boolean
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		amount: string
		markedGranted: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'reject invalid redeem request',
			given: 'body parse failed',
			when: 'calling redeemCreditCodeHandler',
			then: 'returns invalid credit code',
			givenDetail: {
				body: null,
				errorCode: '',
				grantError: '',
				duplicatedGrant: false
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'INVALID_CREDIT_CODE',
				amount: '',
				markedGranted: false
			}
		},
		{
			scenario: 'return conflict when code already used',
			given: 'core redeem throws CREDIT_CODE_USED',
			when: 'calling redeemCreditCodeHandler',
			then: 'returns 409',
			givenDetail: {
				body: { code: 'AAAA1111' },
				errorCode: 'CREDIT_CODE_USED',
				grantError: '',
				duplicatedGrant: false
			},
			whenDetail: {},
			thenExpected: {
				status: 409,
				code: 'CREDIT_CODE_USED',
				amount: '',
				markedGranted: false
			}
		},
		{
			scenario: 'return invalid when code is expired or missing',
			given: 'core redeem throws INVALID_CREDIT_CODE',
			when: 'calling redeemCreditCodeHandler',
			then: 'returns 400',
			givenDetail: {
				body: { code: 'AAAA1111' },
				errorCode: 'INVALID_CREDIT_CODE',
				grantError: '',
				duplicatedGrant: false
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'INVALID_CREDIT_CODE',
				amount: '',
				markedGranted: false
			}
		},
		{
			scenario: 'redeem code successfully',
			given: 'meta claim and tenant grant succeed',
			when: 'calling redeemCreditCodeHandler',
			then: 'returns balance and amount',
			givenDetail: {
				body: { code: 'AAAA1111' },
				errorCode: '',
				grantError: '',
				duplicatedGrant: false
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				amount: '100.000000',
				markedGranted: true
			}
		},
		{
			scenario: 'resume pending redeem code successfully',
			given: 'meta claim already exists and tenant grant is duplicated',
			when: 'calling redeemCreditCodeHandler',
			then: 'marks meta code granted and returns amount',
			givenDetail: {
				body: { code: 'AAAA1111' },
				errorCode: '',
				grantError: '',
				duplicatedGrant: true
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				amount: '100.000000',
				markedGranted: true
			}
		},
		{
			scenario: 'return pending when tenant grant fails after claim',
			given: 'meta claim succeeds and tenant grant fails',
			when: 'calling redeemCreditCodeHandler',
			then: 'keeps claim and returns pending',
			givenDetail: {
				body: { code: 'AAAA1111' },
				errorCode: '',
				grantError: 'D1_DOWN',
				duplicatedGrant: false
			},
			whenDetail: {},
			thenExpected: {
				status: 202,
				code: 'CREDIT_GRANT_PENDING',
				amount: '',
				markedGranted: false
			}
		}
	]

	runCases(cases, async (given) => {
		if (given.errorCode !== '') {
			vi.mocked(creditRedemptionServiceMocks.claimCode).mockRejectedValue(
				new CreditsError(given.errorCode)
			)
		} else {
			vi.mocked(creditRedemptionServiceMocks.claimCode).mockResolvedValue({
				id: 'code-id',
				amount: 100_000_000
			})
			if (given.grantError !== '') {
				vi.mocked(creditServiceMocks.grant).mockRejectedValue(new Error(given.grantError))
			} else {
				vi.mocked(creditServiceMocks.grant).mockResolvedValue({
					balance: 300_000_000,
					entryId: 'e1',
					transactionId: 't1',
					entryRemainingAmount: 100_000_000,
					duplicated: given.duplicatedGrant
				})
			}
		}

		const ctx = createJsonContext({
			env: {},
			userId: 'u1',
			metaDb: { name: 'meta' },
			tenantDb: { name: 'tenant' },
			body: given.body
		})
		const res = await redeemCreditCodeHandler(ctx)
		const payload = (await res.json()) as { code?: string; amount?: string }
		return {
			status: res.status,
			code: payload.code ?? '',
			amount: payload.amount ?? '',
			markedGranted: creditRedemptionServiceMocks.markGranted.mock.calls.length > 0
		}
	})
})

describe('grantCreditsHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		creditServiceMocks.constructorArgs = []
		creditRedemptionServiceMocks.constructorArgs = []
	})

	type GivenDetail = {
		body: unknown
		duplicated: boolean
		errorCode: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		balance: string
		grantType: string
		grantSourceType: string
		grantAmount: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'reject invalid admin grant request',
			given: 'missing source_id field',
			when: 'calling grantCreditsHandler',
			then: 'returns invalid request',
			givenDetail: {
				body: { user_id: 'u1', amount: 10 },
				duplicated: false,
				errorCode: ''
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'INVALID_REQUEST',
				balance: '',
				grantType: '',
				grantSourceType: '',
				grantAmount: 0
			}
		},
		{
			scenario: 'return duplicated code when source id already granted',
			given: 'CreditsService.grant returns duplicated true',
			when: 'calling grantCreditsHandler',
			then: 'returns conflict',
			givenDetail: {
				body: { user_id: 'u1', amount: '10', source_id: 'manual-1' },
				duplicated: true,
				errorCode: ''
			},
			whenDetail: {},
			thenExpected: {
				status: 409,
				code: 'CREDIT_GRANT_DUPLICATED',
				balance: '',
				grantType: 'manual_grant',
				grantSourceType: 'manual_grant',
				grantAmount: 10_000_000
			}
		},
		{
			scenario: 'return user not found for invalid target user',
			given: 'CreditsService.grant throws CREDIT_USER_NOT_FOUND',
			when: 'calling grantCreditsHandler',
			then: 'returns 404',
			givenDetail: {
				body: { user_id: 'u1', amount: '10', source_id: 'manual-1' },
				duplicated: false,
				errorCode: 'CREDIT_USER_NOT_FOUND'
			},
			whenDetail: {},
			thenExpected: {
				status: 404,
				code: 'CREDIT_USER_NOT_FOUND',
				balance: '',
				grantType: 'manual_grant',
				grantSourceType: 'manual_grant',
				grantAmount: 10_000_000
			}
		},
		{
			scenario: 'grant credits successfully',
			given: 'CreditsService.grant succeeds',
			when: 'calling grantCreditsHandler',
			then: 'returns latest balance',
			givenDetail: {
				body: { user_id: 'u1', amount: '10', source_id: 'manual-1' },
				duplicated: false,
				errorCode: ''
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				balance: '120.000000',
				grantType: 'manual_grant',
				grantSourceType: 'manual_grant',
				grantAmount: 10_000_000
			}
		}
	]

	runCases(cases, async (given) => {
		if (given.errorCode !== '') {
			vi.mocked(creditServiceMocks.grant).mockRejectedValue(new CreditsError(given.errorCode))
		} else {
			vi.mocked(creditServiceMocks.grant).mockResolvedValue({
				balance: 120_000_000,
				entryId: 'e1',
				transactionId: 't1',
				entryRemainingAmount: 10_000_000,
				duplicated: given.duplicated
			})
		}

		const ctx = createJsonContext({
			env: {},
			userId: 'admin',
			metaDb: { name: 'meta' },
			tenantDb: { name: 'tenant' },
			body: given.body
		})
		const res = await grantCreditsHandler(ctx)
		const payload = (await res.json()) as { code?: string; balance?: string }
		const grantInput = vi.mocked(creditServiceMocks.grant).mock.calls[0]?.[0] as
			| { type?: string; sourceType?: string; amount?: number }
			| undefined
		return {
			status: res.status,
			code: payload.code ?? '',
			balance: payload.balance ?? '',
			grantType: grantInput?.type ?? '',
			grantSourceType: grantInput?.sourceType ?? '',
			grantAmount: grantInput?.amount ?? 0
		}
	})
})

describe('listCreditTransactionsHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		creditServiceMocks.constructorArgs = []
	})

	type GivenDetail = {
		body: ListCreditTransactionsRequest | null
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		transactionCount: number
		firstBalanceAfter: string
		usesTenantDb: boolean
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
				firstBalanceAfter: '',
				usesTenantDb: false
			}
		},
		{
			scenario: 'map transactions to snake_case',
			given: 'query returns one transaction',
			when: 'calling listCreditTransactionsHandler',
			then: 'returns mapped response list',
			givenDetail: {
				body: {
					page: 1,
					page_size: 20
				}
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				transactionCount: 1,
				firstBalanceAfter: '99.000000',
				usesTenantDb: true
			}
		}
	]

	runCases(cases, async (given) => {
		vi.mocked(creditServiceMocks.listTransactions).mockResolvedValue({
			transactions: [
				{
					id: 't1',
					type: 'signup',
					amount: 100_000_000,
					balanceAfter: 99_000_000,
					sourceType: 'signup',
					sourceId: 'u1',
					description: 'desc',
					expiresAt: null,
					createdAt: 123
				}
			],
			total: 1
		})
		const ctx = createJsonContext({
			env: {},
			userId: 'u1',
			metaDb: { name: 'meta' },
			tenantDb: { name: 'tenant' },
			body: given.body
		})
		const res = await listCreditTransactionsHandler(ctx)
		const payload = (await res.json()) as {
			code?: string
			items?: Array<{ balance_after: string }>
		}
		return {
			status: res.status,
			code: payload.code ?? '',
			transactionCount: payload.items?.length ?? 0,
			firstBalanceAfter: payload.items?.[0]?.balance_after ?? '',
			usesTenantDb: creditServiceMocks.constructorArgs[0]?.[0] === ctx.get('tenantDb')
		}
	})
})

function createJsonContext(input: {
	env: Record<string, string>
	userId: string
	metaDb: unknown
	tenantDb: unknown
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
			if (key === 'tenantDb') {
				return input.tenantDb
			}
			return input.metaDb
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
