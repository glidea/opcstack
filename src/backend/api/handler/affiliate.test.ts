import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import { AffError, type AffErrorCode } from '../../affiliate'
import { bindAffiliateHandler, getAffiliateSummaryHandler, listAdminAffiliateReferralsHandler } from './affiliate'
import type { Context } from 'hono'
import type { ApiEnv } from '..'

const configMocks = vi.hoisted(() => {
	return {
		getAffiliateConfig: vi.fn()
	}
})

vi.mock('../../config', () => {
	return {
		getAffiliateConfig: configMocks.getAffiliateConfig
	}
})

const affServiceMocks = vi.hoisted(() => {
	return {
		bind: vi.fn(),
		getSummary: vi.fn(),
		listReferrals: vi.fn(),
		markRewardGranted: vi.fn()
	}
})

describe('listAdminAffiliateReferralsHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('returns inviter and invitee identities with reward status', async () => {
		vi.mocked(affServiceMocks.listReferrals).mockResolvedValue({
			referrals: [
				{
					id: 'referral-1',
					inviterUserId: 'inviter-1',
					inviterName: 'Lin',
					inviterEmail: 'lin@example.com',
					inviteeUserId: 'invitee-1',
					inviteeName: 'Ada',
					inviteeEmail: 'ada@example.com',
					inviterGrantedAt: 100,
					inviteeGrantedAt: null,
					createdAt: 99
				}
			],
			total: 1
		})
		const ctx = createJsonContext({
			env: {},
			userId: 'admin',
			db: { name: 'meta' },
			body: { page: 1, page_size: 20, reward_status: 'pending' }
		})

		const response: Response = await listAdminAffiliateReferralsHandler(ctx)
		const body = (await response.json()) as {
			items?: Array<{ inviter: { email: string }; invitee: { email: string }; reward_status: string }>
		}

		expect({ status: response.status, item: body.items?.[0] }).toEqual({
			status: 200,
			item: {
				id: 'referral-1',
				inviter: { id: 'inviter-1', name: 'Lin', email: 'lin@example.com' },
				invitee: { id: 'invitee-1', name: 'Ada', email: 'ada@example.com' },
				reward_status: 'pending',
				created_at: 99
			}
		})
	})
})

const creditServiceMocks = vi.hoisted(() => {
	return {
		constructorArgs: [] as unknown[][],
		grant: vi.fn()
	}
})

const shardRouterMocks = vi.hoisted(() => {
	return {
		openUserDb: vi.fn()
	}
})

vi.mock('../../affiliate', async () => {
	const actual = await vi.importActual<typeof import('../../affiliate')>('../../affiliate')
	return {
		...actual,
		AffService: vi.fn().mockImplementation(function AffService() {
			return affServiceMocks
		})
	}
})

vi.mock('../../credits', async () => {
	const actual = await vi.importActual<typeof import('../../credits')>('../../credits')
	return {
		...actual,
		CreditsService: vi.fn().mockImplementation(function CreditsService(...args: unknown[]) {
			creditServiceMocks.constructorArgs.push(args)
			return creditServiceMocks
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
	creditServiceMocks.constructorArgs = []
	shardRouterMocks.openUserDb.mockResolvedValue({
		shardId: 'shard_0000',
		bindingName: 'TENANT_DB_0000',
		db: { name: 'tenant-db' }
	})
	creditServiceMocks.grant.mockResolvedValue({
		balance: 1,
		entryId: 'entry-id',
		transactionId: 'transaction-id',
		entryRemainingAmount: 1,
		duplicated: false
	})
})

describe('getAffiliateSummaryHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		enabled: boolean
		errorCode: '' | AffErrorCode
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		affEnabled: boolean
		affCode: string
		invitedCount: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'skip summary when aff is disabled',
			given: 'aff switch is false',
			when: 'calling getAffiliateSummaryHandler',
			then: 'returns disabled summary',
			givenDetail: {
				enabled: false,
				errorCode: ''
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				affEnabled: false,
				affCode: '',
				invitedCount: 0
			}
		},
		{
			scenario: 'map summary fields into response',
			given: 'aff query succeeds',
			when: 'calling getAffiliateSummaryHandler',
			then: 'returns snake_case response',
			givenDetail: {
				enabled: true,
				errorCode: ''
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				affEnabled: true,
				affCode: 'ABC12345',
				invitedCount: 3
			}
		},
		{
			scenario: 'return 404 when user is missing',
			given: 'summary query throws AFF_USER_NOT_FOUND',
			when: 'calling getAffiliateSummaryHandler',
			then: 'returns 404 with code',
			givenDetail: {
					enabled: true,
				errorCode: 'AFF_USER_NOT_FOUND'
			},
			whenDetail: {},
			thenExpected: {
				status: 404,
				code: 'AFF_USER_NOT_FOUND',
				affEnabled: false,
				affCode: '',
				invitedCount: 0
			}
		}
	]

	runCases(cases, async (given) => {
		if (given.errorCode !== '') {
			vi.mocked(affServiceMocks.getSummary).mockRejectedValue(new AffError(given.errorCode))
		} else {
			vi.mocked(affServiceMocks.getSummary).mockResolvedValue({
				affCode: 'ABC12345',
				invitedCount: 3
			})
		}

		configMocks.getAffiliateConfig.mockResolvedValue({
			enabled: given.enabled,
			inviterCreditAmount: 50_000_000,
			inviteeCreditAmount: 20_000_000,
			version: 1
		})
		const ctx = createJsonContext({
			env: {},
			userId: 'u1',
			db: {},
			body: {}
		})
		const res = await getAffiliateSummaryHandler(ctx)
		const payload = (await res.json()) as {
			code?: string
			aff_enabled?: boolean
			aff_code?: string
			invited_count?: number
		}
		return {
			status: res.status,
			code: payload.code ?? '',
			affEnabled: payload.aff_enabled ?? false,
			affCode: payload.aff_code ?? '',
			invitedCount: payload.invited_count ?? 0
		}
	})
})

describe('bindAffiliateHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		enabled: boolean
		body: { aff_code: string } | null
		inviterAmount: number
		inviteeAmount: number
		errorCode: '' | AffErrorCode
		inviterGrantedAt: number | null
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		grantCalls: number
		markCalls: number
		firstGrantUsesCurrentTenant: boolean
		secondGrantUsesCurrentTenant: boolean
		openUserDbCalls: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'skip bind when aff is disabled',
			given: 'aff switch is false',
			when: 'calling bindAffiliateHandler',
			then: 'returns empty response',
			givenDetail: {
				enabled: false,
				body: { aff_code: 'ABCD1234' },
				inviterAmount: 50_000_000,
				inviteeAmount: 20_000_000,
				errorCode: '',
				inviterGrantedAt: null
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				grantCalls: 0,
				markCalls: 0,
				firstGrantUsesCurrentTenant: false,
				secondGrantUsesCurrentTenant: false,
				openUserDbCalls: 0
			}
		},
		{
			scenario: 'reject invalid request payload',
			given: 'body parse failed',
			when: 'calling bindAffiliateHandler',
			then: 'returns invalid request',
			givenDetail: {
				enabled: true,
				body: null,
				inviterAmount: 50_000_000,
				inviteeAmount: 20_000_000,
				errorCode: '',
				inviterGrantedAt: null
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'INVALID_REQUEST',
				grantCalls: 0,
				markCalls: 0,
				firstGrantUsesCurrentTenant: false,
				secondGrantUsesCurrentTenant: false,
				openUserDbCalls: 0
			}
		},
		{
			scenario: 'reject duplicated aff binding',
			given: 'core bind throws AFF_ALREADY_BOUND',
			when: 'calling bindAffiliateHandler',
			then: 'returns conflict code',
			givenDetail: {
				enabled: true,
				body: { aff_code: 'ABCD1234' },
				inviterAmount: 50_000_000,
				inviteeAmount: 20_000_000,
				errorCode: 'AFF_ALREADY_BOUND',
				inviterGrantedAt: null
			},
			whenDetail: {},
			thenExpected: {
				status: 409,
				code: 'AFF_ALREADY_BOUND',
				grantCalls: 0,
				markCalls: 0,
				firstGrantUsesCurrentTenant: false,
				secondGrantUsesCurrentTenant: false,
				openUserDbCalls: 0
			}
		},
		{
			scenario: 'reject invalid aff code from core',
			given: 'core bind throws INVALID_AFF_CODE',
			when: 'calling bindAffiliateHandler',
			then: 'returns bad request code',
			givenDetail: {
				enabled: true,
				body: { aff_code: 'ABCD1234' },
				inviterAmount: 50_000_000,
				inviteeAmount: 20_000_000,
				errorCode: 'INVALID_AFF_CODE',
				inviterGrantedAt: null
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'INVALID_AFF_CODE',
				grantCalls: 0,
				markCalls: 0,
				firstGrantUsesCurrentTenant: false,
				secondGrantUsesCurrentTenant: false,
				openUserDbCalls: 0
			}
		},
		{
			scenario: 'bind aff successfully',
			given: 'core bind succeeds',
			when: 'calling bindAffiliateHandler',
			then: 'returns empty response',
			givenDetail: {
				enabled: true,
				body: { aff_code: 'ABCD1234' },
				inviterAmount: 50_000_000,
				inviteeAmount: 20_000_000,
				errorCode: '',
				inviterGrantedAt: null
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				grantCalls: 2,
				markCalls: 2,
				firstGrantUsesCurrentTenant: false,
				secondGrantUsesCurrentTenant: true,
				openUserDbCalls: 1
			}
		},
		{
			scenario: 'resume partially granted aff binding',
			given: 'inviter reward was already granted',
			when: 'calling bindAffiliateHandler again',
			then: 'only grants invitee reward',
			givenDetail: {
				enabled: true,
				body: { aff_code: 'ABCD1234' },
				inviterAmount: 50_000_000,
				inviteeAmount: 20_000_000,
				errorCode: '',
				inviterGrantedAt: 1890000000000
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				grantCalls: 1,
				markCalls: 1,
				firstGrantUsesCurrentTenant: true,
				secondGrantUsesCurrentTenant: false,
				openUserDbCalls: 0
			}
		}
	]

	runCases(cases, async (given) => {
		if (given.errorCode !== '') {
			vi.mocked(affServiceMocks.bind).mockRejectedValue(new AffError(given.errorCode))
		} else {
			vi.mocked(affServiceMocks.bind).mockResolvedValue({
				affId: 'aff-id',
				inviterUserId: 'inviter',
				inviteeUserId: 'u1',
				inviterGrantedAt: given.inviterGrantedAt,
				inviteeGrantedAt: null
			})
		}
		vi.mocked(affServiceMocks.markRewardGranted).mockResolvedValue(undefined)

		configMocks.getAffiliateConfig.mockResolvedValue({
			enabled: given.enabled,
			inviterCreditAmount: given.inviterAmount,
			inviteeCreditAmount: given.inviteeAmount,
			version: 1
		})
		const ctx = createJsonContext({
			env: {},
			userId: 'u1',
			metaDb: { name: 'meta-db' },
			tenantDb: { name: 'current-tenant-db' },
			body: given.body
		})
		const res = await bindAffiliateHandler(ctx)
		const payload = (await res.json()) as { code?: string }
		return {
			status: res.status,
			code: payload.code ?? '',
			grantCalls: creditServiceMocks.grant.mock.calls.length,
			markCalls: affServiceMocks.markRewardGranted.mock.calls.length,
			firstGrantUsesCurrentTenant: creditServiceMocks.constructorArgs[0]?.[0] === ctx.get('tenantDb'),
			secondGrantUsesCurrentTenant: creditServiceMocks.constructorArgs[1]?.[0] === ctx.get('tenantDb'),
			openUserDbCalls: shardRouterMocks.openUserDb.mock.calls.length
		}
	})
})

function createJsonContext(input: {
	env: Record<string, string>
	userId: string
	metaDb?: unknown
	tenantDb?: unknown
	db?: unknown
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
				return input.tenantDb ?? input.db
			}
			return input.metaDb ?? input.db
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
