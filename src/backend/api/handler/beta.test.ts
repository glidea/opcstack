import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import {
	bindBetaCodeHandler,
	generateBetaCodesHandler,
	listBetaCodesHandler,
	type BindBetaCodeRequest,
	type GenerateBetaCodesRequest,
	type GenerateBetaCodesResponse,
	type ListBetaCodesResponse
} from './beta'
import type { Context } from 'hono'
import type { ApiEnv } from '..'
import type { AuthRuntimeConfig } from '../../config'

type UUID = `${string}-${string}-${string}-${string}-${string}`

type MockDb = {
	update: ReturnType<typeof vi.fn>
	insert: ReturnType<typeof vi.fn>
	select: ReturnType<typeof vi.fn>
	query: {
		betaCode: {
			findFirst: ReturnType<typeof vi.fn>
			findMany: ReturnType<typeof vi.fn>
		}
	}
}

describe('bindBetaCodeHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		betaEnabled: boolean
		userId: string
		reqBody: BindBetaCodeRequest | null
		updateChanges: number
		alreadyBound: boolean
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		body: Record<string, string>
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'skip bind when beta code gate is disabled',
			given: 'beta code gate disabled',
			when: 'binding beta code',
			then: 'returns empty response',
			givenDetail: {
				betaEnabled: false,
				userId: 'u1',
				reqBody: { beta_code: 'AAAA1111' },
				updateChanges: 0,
				alreadyBound: false
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				body: {}
			}
		},
		{
			scenario: 'reject malformed request body',
			given: 'beta code gate enabled and body parse failed',
			when: 'binding beta code',
			then: 'returns invalid request',
			givenDetail: {
				betaEnabled: true,
				userId: 'u1',
				reqBody: null,
				updateChanges: 0,
				alreadyBound: false
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				body: { code: 'INVALID_REQUEST', message: 'Invalid JSON' }
			}
		},
		{
			scenario: 'bind beta code when update succeeds',
			given: 'beta code is valid and unused',
			when: 'binding beta code',
			then: 'returns empty response',
			givenDetail: {
				betaEnabled: true,
				userId: 'u1',
				reqBody: { beta_code: 'AAAA1111' },
				updateChanges: 1,
				alreadyBound: false
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				body: {}
			}
		},
		{
			scenario: 'reject when user already bound a beta code',
			given: 'update failed and current user already has beta code',
			when: 'binding beta code',
			then: 'returns beta code already bound',
			givenDetail: {
				betaEnabled: true,
				userId: 'u1',
				reqBody: { beta_code: 'AAAA1111' },
				updateChanges: 0,
				alreadyBound: true
			},
			whenDetail: {},
			thenExpected: {
				status: 409,
				body: { code: 'BETA_CODE_ALREADY_BOUND', message: 'Beta code is already bound' }
			}
		},
		{
			scenario: 'reject when beta code is invalid and user is not bound',
			given: 'update failed and user has no beta code binding',
			when: 'binding beta code',
			then: 'returns invalid beta code',
			givenDetail: {
				betaEnabled: true,
				userId: 'u1',
				reqBody: { beta_code: 'AAAA1111' },
				updateChanges: 0,
				alreadyBound: false
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				body: { code: 'INVALID_BETA_CODE', message: 'Beta code is invalid' }
			}
		}
	]

	runCases(cases, async (given) => {
		const db = createMockDb()
		db.update.mockReturnValue({
			set: () => ({
				where: async () => {
					return {
						meta: { changes: given.updateChanges }
					}
				}
			})
		})
		db.query.betaCode.findFirst.mockResolvedValue(
			given.alreadyBound ? { id: 'bound-id' } : null
		)
		const ctx = createJsonContext({
			betaCodeEnabled: given.betaEnabled,
			userId: given.userId,
			db,
			body: given.reqBody
		})

		const res = await bindBetaCodeHandler(ctx)
		return {
			status: res.status,
			body: (await res.json()) as Record<string, string>
		}
	})
})

describe('generateBetaCodesHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		body: unknown
		uuidValues: UUID[]
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		codeCount: number
		firstCodeLength: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'reject non-positive count request',
			given: 'request count is 0',
			when: 'generating beta codes',
			then: 'returns 400 invalid request',
			givenDetail: {
				body: { count: 0 },
				uuidValues: []
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'INVALID_REQUEST',
				codeCount: 0,
				firstCodeLength: 0
			}
		},
		{
			scenario: 'reject type error request for count',
			given: 'request count is string',
			when: 'generating beta codes',
			then: 'returns 400 invalid request',
			givenDetail: {
				body: { count: '2' },
				uuidValues: []
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'INVALID_REQUEST',
				codeCount: 0,
				firstCodeLength: 0
			}
		},
		{
			scenario: 'generates requested beta code count',
			given: 'request count is 2',
			when: 'generating beta codes',
			then: 'returns 2 codes and each code has 8 chars',
			givenDetail: {
				body: { count: 2 },
				uuidValues: [
					'11111111-1111-1111-1111-111111111111',
					'22222222-2222-2222-2222-222222222222',
					'33333333-3333-3333-3333-333333333333',
					'44444444-4444-4444-4444-444444444444'
				]
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				codeCount: 2,
				firstCodeLength: 8
			}
		}
	]

	runCases(cases, async (given) => {
		const db = createMockDb()
		db.insert.mockReturnValue({
			values: async () => {
				return
			}
		})
		if (given.uuidValues.length > 0) {
			let index = 0
			const fallbackUuid: UUID = '00000000-0000-0000-0000-000000000000'
			vi.spyOn(crypto, 'randomUUID').mockImplementation((): UUID => {
				const value = given.uuidValues[index] ?? fallbackUuid
				index += 1
				return value
			})
		}

		const ctx = createJsonContext({
			betaCodeEnabled: true,
			userId: 'u1',
			db,
			body: given.body
		})

		const res = await generateBetaCodesHandler(ctx)
		const payload = (await res.json()) as {
			code?: string
			codes?: GenerateBetaCodesResponse['codes']
		}
		const codes = payload.codes ?? []
		const firstCode = codes[0]
		return {
			status: res.status,
			code: payload.code ?? '',
			codeCount: codes.length,
			firstCodeLength: firstCode ? firstCode.code.length : 0
		}
	})
})

describe('listBetaCodesHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		rows: Array<{
			id: string
			code: string
			usedBy: string | null
			usedAt: number | null
			createdAt: number
		}>
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		items: ListBetaCodesResponse['items']
		total: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'maps database rows to api response fields',
			given: 'one used beta code row',
			when: 'listing beta codes',
			then: 'returns snake_case response fields',
			givenDetail: {
				rows: [
					{
						id: 'i1',
						code: 'ABCDEFGH',
						usedBy: 'u1',
						usedAt: 123,
						createdAt: 456
					}
				]
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				items: [
					{
						id: 'i1',
						code: 'ABCDEFGH',
						used_by: 'u1',
						used_at: 123,
						created_at: 456
					}
				],
				total: 1
			}
		}
	]

	runCases(cases, async (given) => {
		const db = createMockDb()
		db.query.betaCode.findMany.mockResolvedValue(given.rows)

		const ctx = createJsonContext({
			betaCodeEnabled: true,
			userId: 'u1',
			db,
			body: {}
		})

		const res = await listBetaCodesHandler(ctx)
	const payload = (await res.json()) as ListBetaCodesResponse
		return {
			status: res.status,
			items: payload.items,
			total: payload.total
		}
	})
})

function createMockDb(): MockDb {
	return {
		update: vi.fn(),
		insert: vi.fn(),
		select: vi.fn(() => {
			return {
				from: () => {
					return {
						where: async () => {
							return [{ total: 1 }]
						}
					}
				}
			}
		}),
		query: {
			betaCode: {
				findFirst: vi.fn(),
				findMany: vi.fn()
			}
		}
	}
}

function createJsonContext(input: {
	betaCodeEnabled: boolean
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
		env: {},
		req,
		get: (key: string): unknown => {
			if (key === 'userId') {
				return input.userId
			}
			if (key === 'authRuntimeConfig') {
				return createAuthRuntimeConfig(input.betaCodeEnabled)
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

function createAuthRuntimeConfig(betaCodeEnabled: boolean): AuthRuntimeConfig {
	return {
		authentication: {
			betaCodeEnabled,
			emailSignupEnabled: false,
			emailSignupDomainAllowlist: [],
			emailRequireVerification: false,
			emailUserActionCooldownSeconds: 50,
			turnstile: { enabled: false, siteKey: null, secretKey: null },
			providers: {
				google: { enabled: false, clientId: null, clientSecret: null },
				github: { enabled: false, clientId: null, clientSecret: null },
				linuxdo: { enabled: false, clientId: null, clientSecret: null }
			}
		},
		email: { enabled: false, provider: null, resendApiKey: null }
	}
}
