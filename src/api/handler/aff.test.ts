import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import { AffError } from '../../aff'
import { bindAffHandler, getAffSummaryHandler } from './aff'
import type { Context } from 'hono'
import type { ApiEnv } from '..'

const affServiceMocks = vi.hoisted(() => {
	return {
		bind: vi.fn(),
		getSummary: vi.fn()
	}
})

vi.mock('../../aff', async () => {
	const actual = await vi.importActual<typeof import('../../aff')>('../../aff')
	return {
		...actual,
		AffService: vi.fn().mockImplementation(function AffService() {
			return affServiceMocks
		})
	}
})

describe('getAffSummaryHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		enabled: string
		errorCode: string
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
			when: 'calling getAffSummaryHandler',
			then: 'returns disabled summary',
			givenDetail: {
				enabled: 'false',
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
			when: 'calling getAffSummaryHandler',
			then: 'returns snake_case response',
			givenDetail: {
				enabled: 'true',
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
			when: 'calling getAffSummaryHandler',
			then: 'returns 404 with code',
			givenDetail: {
				enabled: 'true',
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

		const ctx = createJsonContext({
			env: {
				AFF_ENABLED: given.enabled
			},
			userId: 'u1',
			db: {},
			body: {}
		})
		const res = await getAffSummaryHandler(ctx)
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

describe('bindAffHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		enabled: string
		body: { aff_code: string } | null
		inviterAmount: string
		inviteeAmount: string
		errorCode: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'skip bind when aff is disabled',
			given: 'aff switch is false',
			when: 'calling bindAffHandler',
			then: 'returns empty response',
			givenDetail: {
				enabled: 'false',
				body: { aff_code: 'ABCD1234' },
				inviterAmount: '50',
				inviteeAmount: '20',
				errorCode: ''
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: ''
			}
		},
		{
			scenario: 'reject invalid request payload',
			given: 'body parse failed',
			when: 'calling bindAffHandler',
			then: 'returns invalid aff code',
			givenDetail: {
				enabled: 'true',
				body: null,
				inviterAmount: '50',
				inviteeAmount: '20',
				errorCode: ''
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'INVALID_AFF_CODE'
			}
		},
		{
			scenario: 'reject duplicated aff binding',
			given: 'core bind throws AFF_ALREADY_BOUND',
			when: 'calling bindAffHandler',
			then: 'returns conflict code',
			givenDetail: {
				enabled: 'true',
				body: { aff_code: 'ABCD1234' },
				inviterAmount: '50',
				inviteeAmount: '20',
				errorCode: 'AFF_ALREADY_BOUND'
			},
			whenDetail: {},
			thenExpected: {
				status: 409,
				code: 'AFF_ALREADY_BOUND'
			}
		},
		{
			scenario: 'reject invalid aff code from core',
			given: 'core bind throws INVALID_AFF_CODE',
			when: 'calling bindAffHandler',
			then: 'returns bad request code',
			givenDetail: {
				enabled: 'true',
				body: { aff_code: 'ABCD1234' },
				inviterAmount: '50',
				inviteeAmount: '20',
				errorCode: 'INVALID_AFF_CODE'
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'INVALID_AFF_CODE'
			}
		},
		{
			scenario: 'bind aff successfully',
			given: 'core bind succeeds',
			when: 'calling bindAffHandler',
			then: 'returns empty response',
			givenDetail: {
				enabled: 'true',
				body: { aff_code: 'ABCD1234' },
				inviterAmount: '50',
				inviteeAmount: '20',
				errorCode: ''
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: ''
			}
		}
	]

	runCases(cases, async (given) => {
		if (given.errorCode !== '') {
			vi.mocked(affServiceMocks.bind).mockRejectedValue(new AffError(given.errorCode))
		} else {
			vi.mocked(affServiceMocks.bind).mockResolvedValue({})
		}

		const ctx = createJsonContext({
			env: {
				AFF_ENABLED: given.enabled,
				AFF_INVITER_CREDIT_AMOUNT: given.inviterAmount,
				AFF_INVITEE_CREDIT_AMOUNT: given.inviteeAmount
			},
			userId: 'u1',
			db: {},
			body: given.body
		})
		const res = await bindAffHandler(ctx)
		const payload = (await res.json()) as { code?: string }
		return {
			status: res.status,
			code: payload.code ?? ''
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
