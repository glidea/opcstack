import { beforeAll, describe } from 'vitest'
import { runCases, type TestCase } from '../src/testing/bdd'

interface PublicConfigResponse {
	payment_enabled: boolean
}

interface JsonErrorResponse {
	code?: string
}

interface ListResponse {
	items: unknown[]
	total: number
}

type E2EEnv = {
	APP_BASE_URL?: string
	E2E_ADMIN_SECRET?: string
	E2E_PAYMENT_ENABLED?: string
	E2E_PAYMENT_PROVIDERS?: string
	E2E_PAYMENT_DEFAULT_PROVIDER?: string
	E2E_PAYMENT_PRODUCTS?: string
}

const e2eEnv =
	(globalThis as unknown as { process?: { env?: E2EEnv } }).process?.env ?? {}
const appBaseUrl: string = e2eEnv.APP_BASE_URL ?? 'http://localhost:5173'
const adminSecret: string = e2eEnv.E2E_ADMIN_SECRET ?? ''
const paymentEnabled: boolean = e2eEnv.E2E_PAYMENT_ENABLED === 'true'
const paymentProviders: string = e2eEnv.E2E_PAYMENT_PROVIDERS ?? ''
const paymentDefaultProvider: string = e2eEnv.E2E_PAYMENT_DEFAULT_PROVIDER ?? ''
const paymentProducts: string = e2eEnv.E2E_PAYMENT_PRODUCTS ?? ''
const hasPaymentConfig: boolean =
	paymentProviders.trim() !== '' &&
	paymentDefaultProvider.trim() !== '' &&
	paymentProducts.trim() !== ''

describe('payment api e2e', () => {
	beforeAll(async () => {
		const res = await fetch(`${appBaseUrl}/api/health`)
		if (res.status !== 200) {
			throw new Error('dev server is not ready for e2e tests')
		}
	})

	type PublicGiven = Record<string, never>
	type PublicWhen = {
		action: 'get_public_config'
	}
	type PublicThen = {
		status: number
		paymentEnabled: boolean
	}

	const publicCases: TestCase<PublicGiven, PublicWhen, PublicThen>[] = [
		{
			scenario: 'public config exposes payment_enabled',
			given: 'no auth required',
			when: 'calling /api/get_public_config',
			then: 'returns payment_enabled from runtime env',
			givenDetail: {},
			whenDetail: {
				action: 'get_public_config'
			},
			thenExpected: {
				status: 200,
				paymentEnabled
			}
		}
	]

	runCases(publicCases, async () => {
		const res = await postJson('/api/get_public_config', {})
		const payload = (await res.json()) as PublicConfigResponse
		return {
			status: res.status,
			paymentEnabled: payload.payment_enabled
		}
	})

	type AuthGiven = Record<string, never>
	type AuthWhen = {
		action:
			| 'create_payment_checkout'
			| 'get_subscription'
			| 'cancel_subscription'
			| 'upgrade_subscription'
			| 'list_payment_transactions'
	}
	type AuthThen = {
		status: number
		code: string
	}

	const authCases: TestCase<AuthGiven, AuthWhen, AuthThen>[] = [
		{
			scenario: 'create payment checkout requires auth',
			given: 'no bearer token',
			when: 'calling /api/create_payment_checkout',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'create_payment_checkout'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED'
			}
		},
		{
			scenario: 'get subscription requires auth',
			given: 'no bearer token',
			when: 'calling /api/get_subscription',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'get_subscription'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED'
			}
		},
		{
			scenario: 'cancel subscription requires auth',
			given: 'no bearer token',
			when: 'calling /api/cancel_subscription',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'cancel_subscription'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED'
			}
		},
		{
			scenario: 'upgrade subscription requires auth',
			given: 'no bearer token',
			when: 'calling /api/upgrade_subscription',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'upgrade_subscription'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED'
			}
		},
		{
			scenario: 'list payment transactions requires auth',
			given: 'no bearer token',
			when: 'calling /api/list_payment_transactions',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'list_payment_transactions'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED'
			}
		}
	]

	runCases(authCases, async (_given, when) => {
		if (when.action === 'create_payment_checkout') {
			const res = await postJson('/api/create_payment_checkout', {
				product_id: 'pro_monthly',
				return_path: '/billing'
			})
			const payload = (await res.json()) as JsonErrorResponse
			return {
				status: res.status,
				code: payload.code ?? ''
			}
		}

		if (when.action === 'get_subscription') {
			const res = await postJson('/api/get_subscription', {})
			const payload = (await res.json()) as JsonErrorResponse
			return {
				status: res.status,
				code: payload.code ?? ''
			}
		}

		if (when.action === 'cancel_subscription') {
			const res = await postJson('/api/cancel_subscription', {})
			const payload = (await res.json()) as JsonErrorResponse
			return {
				status: res.status,
				code: payload.code ?? ''
			}
		}

		if (when.action === 'upgrade_subscription') {
			const res = await postJson('/api/upgrade_subscription', {
				product_id: 'pro_monthly'
			})
			const payload = (await res.json()) as JsonErrorResponse
			return {
				status: res.status,
				code: payload.code ?? ''
			}
		}

		const res = await postJson('/api/list_payment_transactions', {
			page: 1,
			page_size: 20
		})
		const payload = (await res.json()) as JsonErrorResponse
		return {
			status: res.status,
			code: payload.code ?? ''
		}
	})

	describe.skipIf(!(paymentEnabled === false && hasPaymentConfig))(
		'payment disabled behavior',
		() => {
			type DisabledGiven = Record<string, never>
			type DisabledWhen = {
				action: 'list_payment_products'
			}
			type DisabledThen = {
				status: number
				itemCount: number
			}

			const disabledCases: TestCase<DisabledGiven, DisabledWhen, DisabledThen>[] = [
				{
					scenario: 'payment disabled makes product list empty',
					given: 'PAYMENT_ENABLED=false',
					when: 'calling /api/list_payment_products',
					then: 'returns empty items',
					givenDetail: {},
					whenDetail: {
						action: 'list_payment_products'
					},
					thenExpected: {
						status: 200,
						itemCount: 0
					}
				}
			]

			runCases(disabledCases, async () => {
				const res = await postJson('/api/list_payment_products', {})
				const payload = (await res.json()) as { items?: unknown[] }
				return {
					status: res.status,
					itemCount: payload.items?.length ?? -1
				}
			})
		}
	)

	describe.skipIf(!(adminSecret !== '' && hasPaymentConfig))('return url behavior', () => {
		type ReturnGiven = Record<string, never>
		type ReturnWhen = {
			action: 'visit_return_url'
		}
		type ReturnThen = {
			beforeStatus: number
			pageStatus: number
			afterStatus: number
			transactionDelta: number
		}

		const returnCases: TestCase<ReturnGiven, ReturnWhen, ReturnThen>[] = [
			{
				scenario: 'return url does not create payment transactions',
				given: 'admin can query payment transaction total',
				when: 'visiting localized return page with checkout_order_id',
				then: 'transaction total does not change',
				givenDetail: {},
				whenDetail: {
					action: 'visit_return_url'
				},
				thenExpected: {
					beforeStatus: 200,
					pageStatus: 200,
					afterStatus: 200,
					transactionDelta: 0
				}
			}
		]

		runCases(returnCases, async () => {
			const before = await listAdminPaymentTransactions()
			const page = await fetch(
				`${appBaseUrl}/en?checkout_order_id=e2e-fake-${Date.now()}`
			)
			const after = await listAdminPaymentTransactions()
			return {
				beforeStatus: before.status,
				pageStatus: page.status,
				afterStatus: after.status,
				transactionDelta: after.total - before.total
			}
		})
	})
})

function postJson(path: string, body: unknown): Promise<Response> {
	return fetch(`${appBaseUrl}${path}`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify(body)
	})
}

async function listAdminPaymentTransactions(): Promise<{ status: number; total: number }> {
	const res = await fetch(`${appBaseUrl}/api/admin/list_payment_transactions`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${adminSecret}`
		},
		body: JSON.stringify({
			page: 1,
			page_size: 20
		})
	})
	const payload = (await res.json()) as Partial<ListResponse>
	return {
		status: res.status,
		total: typeof payload.total === 'number' ? payload.total : -1
	}
}
