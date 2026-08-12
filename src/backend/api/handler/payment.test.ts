import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import type { Context } from 'hono'
import type { ApiEnv } from '..'
import {
	cancelSubscriptionHandler,
	createPaymentCheckoutHandler,
	dodoWebhookHandler,
	getSubscriptionHandler,
	listAdminPaymentTransactionsHandler,
	listPaymentProductsHandler,
	listPaymentTransactionsHandler,
	upgradeSubscriptionHandler
} from './payment'
import { PaymentProviderError, type PaymentProviderErrorCode } from '../../payment/contract'
import type { PaymentServiceErrorCode } from '../../payment'

const paymentServiceMocks = vi.hoisted(() => {
	return {
		listPaymentProducts: vi.fn(),
		createPaymentCheckout: vi.fn(),
		getSubscription: vi.fn(),
		cancelSubscription: vi.fn(),
		upgradeSubscription: vi.fn(),
		listPaymentTransactions: vi.fn(),
		listAdminPaymentTransactions: vi.fn(),
		processWebhook: vi.fn()
	}
})

vi.mock('../../payment', async () => {
	const actual = await vi.importActual<typeof import('../../payment')>('../../payment')
	return {
		...actual,
		createPaymentServiceFromEnv: vi.fn().mockImplementation(() => paymentServiceMocks),
		createPaymentService: vi.fn().mockImplementation(() => paymentServiceMocks)
	}
})

describe('listPaymentProductsHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = Record<string, never>
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		itemCount: number
		total: number
		hasProviderProductId: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'return mapped product fields without provider ids',
			given: 'service returns one payment product',
			when: 'calling listPaymentProductsHandler',
			then: 'response contains product fields only',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				itemCount: 1,
				total: 1,
				hasProviderProductId: false
			}
		}
	]

	runCases(cases, async () => {
		vi.mocked(paymentServiceMocks.listPaymentProducts).mockResolvedValue([
			{
				productId: 'pro_monthly',
				type: 'subscription',
				name: 'Pro',
				description: null,
				priceAmount: 1990,
				currency: 'USD',
				creditsAmount: null,
				subscriptionPlan: 'pro',
				upgradeRank: 20,
				periodCreditsAmount: 3000
			}
		])

		const ctx = createJsonContext({
			body: {},
			userId: 'u1'
		})
		const res = await listPaymentProductsHandler(ctx)
		const payload = (await res.json()) as {
			items: Array<Record<string, unknown>>
			total: number
		}
		return {
			itemCount: payload.items.length,
			total: payload.total,
			hasProviderProductId: Object.prototype.hasOwnProperty.call(
				payload.items[0] ?? {},
				'provider_product_id'
			)
		}
	})
})

describe('createPaymentCheckoutHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		body: unknown
		errorCode: '' | PaymentServiceErrorCode
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
		checkoutOrderId: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'reject invalid request body',
			given: 'product_id is missing',
			when: 'calling createPaymentCheckoutHandler',
			then: 'returns invalid request',
			givenDetail: {
				body: {},
				errorCode: ''
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'INVALID_REQUEST',
				checkoutOrderId: ''
			}
		},
		{
			scenario: 'return service error code',
			given: 'service throws PAYMENT_DISABLED',
			when: 'calling createPaymentCheckoutHandler',
			then: 'returns mapped 400 error',
			givenDetail: {
				body: {
					product_id: 'pro_monthly',
					return_path: '/settings/billing'
				},
				errorCode: 'PAYMENT_DISABLED'
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'PAYMENT_DISABLED',
				checkoutOrderId: ''
			}
		},
		{
			scenario: 'create checkout with product_id and return_path only',
			given: 'valid request body',
			when: 'calling createPaymentCheckoutHandler',
			then: 'returns checkout_order_id and checkout_url',
			givenDetail: {
				body: {
					product_id: 'pro_monthly',
					return_path: '/settings/billing'
				},
				errorCode: ''
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: '',
				checkoutOrderId: 'co_1'
			}
		}
	]

	runCases(cases, async (given) => {
		if (given.errorCode !== '') {
			const { PaymentServiceError } = await import('../../payment')
			vi.mocked(paymentServiceMocks.createPaymentCheckout).mockRejectedValue(
				new PaymentServiceError(given.errorCode)
			)
		} else {
			vi.mocked(paymentServiceMocks.createPaymentCheckout).mockResolvedValue({
				checkoutOrderId: 'co_1',
				checkoutUrl: 'https://pay.example.com/co_1'
			})
		}

		const ctx = createJsonContext({
			body: given.body,
			userId: 'u1'
		})
		const res = await createPaymentCheckoutHandler(ctx)
		const payload = (await res.json()) as {
			code?: string
			checkout_order_id?: string
		}
		return {
			status: res.status,
			code: payload.code ?? '',
			checkoutOrderId: payload.checkout_order_id ?? ''
		}
	})
})

describe('subscription handlers', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = Record<string, never>
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		plan: string
		cancelStatus: string
		upgradeStatus: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'map get cancel upgrade responses',
			given: 'service returns normal values',
			when: 'calling subscription handlers',
			then: 'returns expected response fields',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				plan: 'pro',
				cancelStatus: 'cancel_at_period_end',
				upgradeStatus: 'pending'
			}
		}
	]

	runCases(cases, async () => {
		vi.mocked(paymentServiceMocks.getSubscription).mockResolvedValue({
			subscriptionPlan: 'pro',
			subscription: {
				productId: 'pro_monthly',
				status: 'active',
				currentPeriodStart: 1000,
				currentPeriodEnd: 2000,
				canceledAt: null
			}
		})
		vi.mocked(paymentServiceMocks.cancelSubscription).mockResolvedValue({
			status: 'cancel_at_period_end',
			currentPeriodEnd: 2000,
			canceledAt: 1500
		})
		vi.mocked(paymentServiceMocks.upgradeSubscription).mockResolvedValue({
			status: 'pending'
		})

		const getCtx = createJsonContext({ body: {}, userId: 'u1' })
		const cancelCtx = createJsonContext({ body: {}, userId: 'u1' })
		const upgradeCtx = createJsonContext({
			body: {
				product_id: 'team_monthly'
			},
			userId: 'u1'
		})

		const getRes = await getSubscriptionHandler(getCtx)
		const cancelRes = await cancelSubscriptionHandler(cancelCtx)
		const upgradeRes = await upgradeSubscriptionHandler(upgradeCtx)

		const getPayload = (await getRes.json()) as { subscription_plan?: string }
		const cancelPayload = (await cancelRes.json()) as { status?: string }
		const upgradePayload = (await upgradeRes.json()) as { status?: string }

		return {
			plan: getPayload.subscription_plan ?? '',
			cancelStatus: cancelPayload.status ?? '',
			upgradeStatus: upgradePayload.status ?? ''
		}
	})
})

describe('payment transaction handlers', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = Record<string, never>
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		userItemCount: number
		adminItemCount: number
		userHasProviderId: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'list user and admin payment transactions',
			given: 'service returns one transaction',
			when: 'calling list transaction handlers',
			then: 'user side hides provider fields',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				userItemCount: 1,
				adminItemCount: 1,
				userHasProviderId: false
			}
		}
	]

	runCases(cases, async () => {
		vi.mocked(paymentServiceMocks.listPaymentTransactions).mockResolvedValue({
			items: [
				{
					id: 'pt_1',
					userId: 'u1',
					type: 'credits_purchase',
					status: 'paid',
					productId: 'credits_1000',
					amount: 1000,
					currency: 'USD',
					creditsGranted: 1000,
					paidAt: 1000,
					refundedAt: null,
					disputedAt: null,
					createdAt: 1000
				}
			],
			total: 1
		})
		vi.mocked(paymentServiceMocks.listAdminPaymentTransactions).mockResolvedValue({
			items: [
				{
					id: 'pt_1',
					userId: 'u1',
					type: 'credits_purchase',
					status: 'paid',
					productId: 'credits_1000',
					amount: 1000,
					currency: 'USD',
					creditsGranted: 1000,
					paidAt: 1000,
					refundedAt: null,
					disputedAt: null,
					createdAt: 1000
				}
			],
			total: 1
		})

		const userCtx = createJsonContext({
			body: {
				page: 1,
				page_size: 20
			},
			userId: 'u1'
		})
		const adminCtx = createJsonContext({
			body: {
				page: 1,
				page_size: 20
			},
			userId: 'admin'
		})

		const userRes = await listPaymentTransactionsHandler(userCtx)
		const adminRes = await listAdminPaymentTransactionsHandler(adminCtx)
		const userPayload = (await userRes.json()) as {
			items?: Array<Record<string, unknown>>
		}
		const adminPayload = (await adminRes.json()) as {
			items?: Array<Record<string, unknown>>
		}
		const userFirst = userPayload.items?.[0] ?? {}

		return {
			userItemCount: userPayload.items?.length ?? 0,
			adminItemCount: adminPayload.items?.length ?? 0,
			userHasProviderId: Object.prototype.hasOwnProperty.call(userFirst, 'provider_payment_id')
		}
	})
})

describe('dodoWebhookHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		signatureError: '' | PaymentProviderErrorCode
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: number
		code: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'return 400 for signature invalid',
			given: 'service throws signature error',
			when: 'calling dodoWebhookHandler',
			then: 'returns 400 code',
			givenDetail: {
				signatureError: 'DODO_WEBHOOK_SIGNATURE_INVALID'
			},
			whenDetail: {},
			thenExpected: {
				status: 400,
				code: 'DODO_WEBHOOK_SIGNATURE_INVALID'
			}
		},
		{
			scenario: 'return 200 when webhook processed',
			given: 'service processes webhook without error',
			when: 'calling dodoWebhookHandler',
			then: 'returns 200',
			givenDetail: {
				signatureError: ''
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				code: ''
			}
		}
	]

	runCases(cases, async (given) => {
		if (given.signatureError !== '') {
			vi.mocked(paymentServiceMocks.processWebhook).mockRejectedValue(
				new PaymentProviderError(given.signatureError)
			)
		} else {
			vi.mocked(paymentServiceMocks.processWebhook).mockResolvedValue(undefined)
		}

		const ctx = createJsonContext({
			body: {},
			userId: 'u1',
			rawText: '{"ok":true}'
		})
		const res = await dodoWebhookHandler(ctx)
		const payload = (await res.json()) as { code?: string }

		return {
			status: res.status,
			code: payload.code ?? ''
		}
	})
})

function createJsonContext(input: {
	body: unknown
	userId: string
	rawText?: string
}): Context<ApiEnv> {
	const req = {
		json: async <T>(): Promise<T> => {
			return input.body as T
		},
		raw: {
			headers: new Headers(),
			text: async (): Promise<string> => {
				return input.rawText ?? '{}'
			},
			cf: {
				country: 'CN'
			}
		}
	}

	const ctx = {
		env: {
			APP_DOMAIN: 'example.com'
		},
		req,
		get: (key: string): unknown => {
			if (key === 'userId') {
				return input.userId
			}
			return {}
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
