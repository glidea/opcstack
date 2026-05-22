import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import { PaymentProviderRouter, type PaymentConfig } from './config'
import { PaymentService, PaymentServiceError, type PaymentProviderMap } from './index'
import type { PaymentEvent, PaymentProvider } from './index'
import type { AppDb } from '../db'
import {
	checkoutOrder,
	paymentTransaction,
	paymentWebhookEvent,
	userSubscription
} from '../db/schema'

const creditServiceMocks = vi.hoisted(() => {
	return {
		grant: vi.fn(),
		deduct: vi.fn()
	}
})

vi.mock('../credits', async () => {
	const actual = await vi.importActual<typeof import('../credits')>('../credits')
	return {
		...actual,
		CreditsService: vi.fn().mockImplementation(function CreditsService() {
			return creditServiceMocks
		})
	}
})

describe('PaymentService.listPaymentProducts', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		paymentEnabled: boolean
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		items: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'return empty items when payment is disabled',
			given: 'PAYMENT_ENABLED is false',
			when: 'listing products',
			then: 'returns empty list',
			givenDetail: {
				paymentEnabled: false
			},
			whenDetail: {},
			thenExpected: {
				items: 0
			}
		}
	]

	runCases(cases, async (given) => {
		const state = createMockState()
		const service = createService(state, {
			enabled: given.paymentEnabled
		})
		const rows = await service.listPaymentProducts({
			country: 'CN'
		})
		return {
			items: rows.length
		}
	})
})

describe('PaymentService.createPaymentCheckout', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		returnPath: string
		appDomain: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: string
		checkoutOrderCount: number
		checkoutUrl: string
		returnUrlOrigin: string
		returnUrlPathname: string
		returnUrlHasCheckoutOrderId: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'create pending checkout order and return checkout url',
			given: 'valid user and product input',
			when: 'creating payment checkout',
			then: 'stores pending order and returns provider url',
			givenDetail: {
				returnPath: '/settings/billing',
				appDomain: 'example.com'
			},
			whenDetail: {},
			thenExpected: {
				status: 'pending',
				checkoutOrderCount: 1,
				checkoutUrl: 'https://pay.example.com/cs_1',
				returnUrlOrigin: 'https://example.com',
				returnUrlPathname: '/settings/billing',
				returnUrlHasCheckoutOrderId: true
			}
		},
		{
			scenario: 'create localhost return url with http',
			given: 'APP_DOMAIN is localhost',
			when: 'creating payment checkout',
			then: 'provider receives http localhost return url',
			givenDetail: {
				returnPath: '/settings/billing',
				appDomain: 'localhost'
			},
			whenDetail: {},
			thenExpected: {
				status: 'pending',
				checkoutOrderCount: 1,
				checkoutUrl: 'https://pay.example.com/cs_1',
				returnUrlOrigin: 'http://localhost',
				returnUrlPathname: '/settings/billing',
				returnUrlHasCheckoutOrderId: true
			}
		}
	]

	runCases(cases, async (given) => {
		const state = createMockState()
		state.users.push({
			id: 'u1',
			email: 'u1@example.com'
		})
		const service = createService(state)
		const result = await service.createPaymentCheckout({
			userId: 'u1',
			productId: 'credits_1000',
			returnPath: given.returnPath,
			country: 'CN',
			appDomain: given.appDomain
		})
		const providerInput = state.provider.createCheckout.mock.calls[0]?.[0]
		const returnUrl = new URL(providerInput.returnUrl)
		return {
			status: state.checkoutOrders[0]?.status ?? '',
			checkoutOrderCount: state.checkoutOrders.length,
			checkoutUrl: result.checkoutUrl,
			returnUrlOrigin: returnUrl.origin,
			returnUrlPathname: returnUrl.pathname,
			returnUrlHasCheckoutOrderId: returnUrl.searchParams.has('checkout_order_id')
		}
	})
})

describe('PaymentService.getSubscription', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		nowMs: number
		currentPeriodEnd: number
		status: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		subscriptionPlan: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'keep paid plan within fixed 2 hour grace period',
			given: 'subscription is active and period expired within 2 hours',
			when: 'querying subscription',
			then: 'returns current paid plan',
			givenDetail: {
				nowMs: 1_000 + 2 * 60 * 60 * 1000 - 1,
				currentPeriodEnd: 1_000,
				status: 'active'
			},
			whenDetail: {},
			thenExpected: {
				subscriptionPlan: 'pro'
			}
		},
		{
			scenario: 'downgrade to free after grace period',
			given: 'subscription is active and period expired after 2 hours',
			when: 'querying subscription',
			then: 'returns free plan',
			givenDetail: {
				nowMs: 1_000 + 2 * 60 * 60 * 1000 + 1,
				currentPeriodEnd: 1_000,
				status: 'active'
			},
			whenDetail: {},
			thenExpected: {
				subscriptionPlan: 'free'
			}
		}
	]

	runCases(cases, async (given) => {
		const state = createMockState()
		state.userSubscriptions.push({
			userId: 'u1',
			provider: 'dodo',
			providerSubscriptionId: 'sub_1',
			productId: 'pro_monthly',
			subscriptionPlan: 'pro',
			periodCreditsAmount: 3000,
			currentPeriodStart: 0,
			currentPeriodEnd: given.currentPeriodEnd,
			status: given.status,
			canceledAt: null,
			createdAt: 0,
			updatedAt: 0
		})
		const service = createService(state)
		const result = await service.getSubscription({
			userId: 'u1',
			nowMs: given.nowMs
		})
		return {
			subscriptionPlan: result.subscriptionPlan
		}
	})
})

describe('PaymentService.upgradeSubscription', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		targetProductId: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		errorCode: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'reject downgrade and horizontal switch',
			given: 'target product rank is not higher',
			when: 'upgrading subscription',
			then: 'returns not allowed error',
			givenDetail: {
				targetProductId: 'pro_monthly'
			},
			whenDetail: {},
			thenExpected: {
				errorCode: 'SUBSCRIPTION_UPGRADE_NOT_ALLOWED'
			}
		}
	]

	runCases(cases, async (given) => {
		const state = createMockState()
		state.userSubscriptions.push({
			userId: 'u1',
			provider: 'dodo',
			providerSubscriptionId: 'sub_1',
			productId: 'pro_monthly',
			subscriptionPlan: 'pro',
			periodCreditsAmount: 3000,
			currentPeriodStart: 0,
			currentPeriodEnd: Date.now() + 1000,
			status: 'active',
			canceledAt: null,
			createdAt: 0,
			updatedAt: 0
		})
		const service = createService(state)
		try {
			await service.upgradeSubscription({
				userId: 'u1',
				productId: given.targetProductId
			})
			return {
				errorCode: ''
			}
		} catch (error) {
			return {
				errorCode: error instanceof PaymentServiceError ? error.code : 'UNKNOWN'
			}
		}
	})
})

describe('PaymentService.processWebhook', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		eventType:
			| 'payment_succeeded'
			| 'payment_failed'
			| 'subscription_paid'
			| 'refund_succeeded'
			| 'dispute_opened'
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		transactions: number
		checkoutStatus: string
		subscriptionPlan: string
		failedStatus: string
		refundStatus: string
		disputeStatus: string
		webhookEvents: number
		grantCalls: number
		deductCalls: number
		grantType: string
		grantSourceType: string
		deductType: string
		deductSourceType: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'handle payment_succeeded for credits purchase',
			given: 'pending credits checkout order exists',
			when: 'processing payment_succeeded webhook',
			then: 'writes transaction and marks checkout completed',
			givenDetail: {
				eventType: 'payment_succeeded'
			},
			whenDetail: {},
			thenExpected: {
				transactions: 1,
				checkoutStatus: 'completed',
				subscriptionPlan: '',
				failedStatus: '',
				refundStatus: '',
				disputeStatus: '',
				webhookEvents: 1,
				grantCalls: 1,
				deductCalls: 0,
				grantType: 'payment_purchase',
				grantSourceType: 'payment_transaction',
				deductType: '',
				deductSourceType: ''
			}
		},
		{
			scenario: 'handle payment_failed for credits purchase',
			given: 'pending credits checkout order exists',
			when: 'processing payment_failed webhook',
			then: 'marks checkout failed without writing transaction',
			givenDetail: {
				eventType: 'payment_failed'
			},
			whenDetail: {},
			thenExpected: {
				transactions: 0,
				checkoutStatus: 'failed',
				subscriptionPlan: '',
				failedStatus: '',
				refundStatus: '',
				disputeStatus: '',
				webhookEvents: 1,
				grantCalls: 0,
				deductCalls: 0,
				grantType: '',
				grantSourceType: '',
				deductType: '',
				deductSourceType: ''
			}
		},
		{
			scenario: 'handle subscription_paid for pending upgrade checkout',
			given: 'pending upgrade checkout and active subscription exist',
			when: 'processing subscription_paid webhook',
			then: 'updates subscription plan and grants period credits diff',
			givenDetail: {
				eventType: 'subscription_paid'
			},
			whenDetail: {},
			thenExpected: {
				transactions: 1,
				checkoutStatus: 'completed',
				subscriptionPlan: 'team',
				failedStatus: '',
				refundStatus: '',
				disputeStatus: '',
				webhookEvents: 1,
				grantCalls: 1,
				deductCalls: 0,
				grantType: 'payment_purchase',
				grantSourceType: 'payment_transaction',
				deductType: '',
				deductSourceType: ''
			}
		},
		{
			scenario: 'handle refund_succeeded and reverse credits once',
			given: 'paid transaction exists with credits granted',
			when: 'processing refund webhook',
			then: 'marks refunded and deducts credits',
			givenDetail: {
				eventType: 'refund_succeeded'
			},
			whenDetail: {},
			thenExpected: {
				transactions: 1,
				checkoutStatus: '',
				subscriptionPlan: '',
				failedStatus: '',
				refundStatus: 'refunded',
				disputeStatus: '',
				webhookEvents: 1,
				grantCalls: 0,
				deductCalls: 1,
				grantType: '',
				grantSourceType: '',
				deductType: 'payment_refund',
				deductSourceType: 'payment_refund'
			}
		},
		{
			scenario: 'handle dispute_opened',
			given: 'paid transaction exists',
			when: 'processing dispute webhook',
			then: 'marks transaction as disputed',
			givenDetail: {
				eventType: 'dispute_opened'
			},
			whenDetail: {},
			thenExpected: {
				transactions: 1,
				checkoutStatus: '',
				subscriptionPlan: '',
				failedStatus: '',
				refundStatus: '',
				disputeStatus: 'disputed',
				webhookEvents: 1,
				grantCalls: 0,
				deductCalls: 0,
				grantType: '',
				grantSourceType: '',
				deductType: '',
				deductSourceType: ''
			}
		}
	]

	runCases(cases, async (given) => {
		const state = createMockState()
		const service = createService(state)
		let event: PaymentEvent = createPaymentSucceededEvent()

		if (given.eventType === 'payment_succeeded') {
			state.checkoutOrders.push({
				id: 'co_1',
				userId: 'u1',
				type: 'credits_purchase',
				status: 'pending',
				productId: 'credits_1000',
				provider: 'dodo',
				providerProductId: 'dp_credits_1000',
				providerCheckoutSessionId: 'cs_1',
				providerPaymentId: null,
				checkoutUrl: 'https://pay.example.com/cs_1',
				createdAt: 0,
				updatedAt: 0
			})
		}

		if (given.eventType === 'payment_failed') {
			state.checkoutOrders.push({
				id: 'co_1',
				userId: 'u1',
				type: 'credits_purchase',
				status: 'pending',
				productId: 'credits_1000',
				provider: 'dodo',
				providerProductId: 'dp_credits_1000',
				providerCheckoutSessionId: 'cs_1',
				providerPaymentId: null,
				checkoutUrl: 'https://pay.example.com/cs_1',
				createdAt: 0,
				updatedAt: 0
			})
			event = createPaymentFailedEvent()
		}

		if (given.eventType === 'subscription_paid') {
			state.checkoutOrders.push({
				id: 'co_upgrade_1',
				userId: 'u1',
				type: 'subscription_upgrade',
				status: 'pending',
				productId: 'team_monthly',
				provider: 'dodo',
				providerProductId: 'dp_team_monthly',
				providerCheckoutSessionId: null,
				providerPaymentId: null,
				checkoutUrl: null,
				createdAt: 0,
				updatedAt: 0
			})
			state.userSubscriptions.push({
				userId: 'u1',
				provider: 'dodo',
				providerSubscriptionId: 'sub_1',
				productId: 'pro_monthly',
				subscriptionPlan: 'pro',
				periodCreditsAmount: 3000,
				currentPeriodStart: 0,
				currentPeriodEnd: 2000,
				status: 'active',
				canceledAt: null,
				createdAt: 0,
				updatedAt: 0
			})
			event = {
				...createSubscriptionPaidEvent(),
				checkoutOrderId: 'co_upgrade_1',
				providerPaymentId: 'pay_upgrade_1'
			}
		}

		if (given.eventType === 'refund_succeeded') {
			state.paymentTransactions.push({
				id: 'pt_1',
				userId: 'u1',
				checkoutOrderId: 'co_1',
				subscriptionId: null,
				type: 'credits_purchase',
				status: 'paid',
				productId: 'credits_1000',
				provider: 'dodo',
				providerPaymentId: 'pay_1',
				providerRefundId: null,
				providerDisputeId: null,
				amount: 1000,
				currency: 'USD',
				creditsGranted: 1000,
				creditsReversedAt: null,
				paidAt: 1000,
				refundedAt: null,
				disputedAt: null,
				createdAt: 1000,
				updatedAt: 1000
			})
			state.queryQueue.paymentTransaction.push(state.paymentTransactions[0])
			event = createRefundEvent()
		}

		if (given.eventType === 'dispute_opened') {
			state.paymentTransactions.push({
				id: 'pt_1',
				userId: 'u1',
				checkoutOrderId: 'co_1',
				subscriptionId: null,
				type: 'credits_purchase',
				status: 'paid',
				productId: 'credits_1000',
				provider: 'dodo',
				providerPaymentId: 'pay_1',
				providerRefundId: null,
				providerDisputeId: null,
				amount: 1000,
				currency: 'USD',
				creditsGranted: 1000,
				creditsReversedAt: null,
				paidAt: 1000,
				refundedAt: null,
				disputedAt: null,
				createdAt: 1000,
				updatedAt: 1000
			})
			state.queryQueue.paymentTransaction.push(state.paymentTransactions[0])
			event = createDisputeEvent()
		}

		state.provider.unwrapWebhook.mockResolvedValue(event)
		await service.processWebhook('dodo', '{}', new Headers())
		const grantInput = vi.mocked(creditServiceMocks.grant).mock.calls[0]?.[0] as
			| { type?: string; sourceType?: string }
			| undefined
		const deductInput = vi.mocked(creditServiceMocks.deduct).mock.calls[0]?.[0] as
			| { type?: string; sourceType?: string }
			| undefined

		return {
			transactions: state.paymentTransactions.length,
			checkoutStatus: state.checkoutOrders[0]?.status ?? '',
			subscriptionPlan: state.userSubscriptions[0]?.subscriptionPlan ?? '',
			failedStatus: state.paymentTransactions[0]?.status === 'failed' ? 'failed' : '',
			refundStatus: state.paymentTransactions[0]?.status === 'refunded' ? 'refunded' : '',
			disputeStatus: state.paymentTransactions[0]?.status === 'disputed' ? 'disputed' : '',
			webhookEvents: state.webhookEvents.length,
			grantCalls: vi.mocked(creditServiceMocks.grant).mock.calls.length,
			deductCalls: vi.mocked(creditServiceMocks.deduct).mock.calls.length,
			grantType: grantInput?.type ?? '',
			grantSourceType: grantInput?.sourceType ?? '',
			deductType: deductInput?.type ?? '',
			deductSourceType: deductInput?.sourceType ?? ''
		}
	})
})

describe('PaymentService.processWebhook subscription event boundary', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = Record<string, never>
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		transactions: number
		checkoutStatus: string
		checkoutProviderPaymentId: string
		webhookEvents: number
		grantCalls: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'ignore payment_succeeded for subscription initial checkout',
			given: 'pending subscription initial checkout order exists',
			when: 'processing payment_succeeded webhook',
			then: 'waits for subscription_paid to create subscription',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				transactions: 0,
				checkoutStatus: 'pending',
				checkoutProviderPaymentId: '',
				webhookEvents: 1,
				grantCalls: 0
			}
		}
	]

	runCases(cases, async () => {
		const state = createMockState()
		const service = createService(state)
		state.checkoutOrders.push({
			id: 'co_1',
			userId: 'u1',
			type: 'subscription_initial',
			status: 'pending',
			productId: 'pro_monthly',
			provider: 'dodo',
			providerProductId: 'dp_pro_monthly',
			providerCheckoutSessionId: 'cs_1',
			providerPaymentId: null,
			checkoutUrl: 'https://pay.example.com/cs_1',
			createdAt: 0,
			updatedAt: 0
		})
		state.provider.unwrapWebhook.mockResolvedValue({
			...createPaymentSucceededEvent(),
			providerSubscriptionId: 'sub_1'
		})

		await service.processWebhook('dodo', '{}', new Headers())

		return {
			transactions: state.paymentTransactions.length,
			checkoutStatus: state.checkoutOrders[0]?.status ?? '',
			checkoutProviderPaymentId: state.checkoutOrders[0]?.providerPaymentId ?? '',
			webhookEvents: state.webhookEvents.length,
			grantCalls: vi.mocked(creditServiceMocks.grant).mock.calls.length
		}
	})
})

describe('PaymentService.processWebhook retry recovery', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		caseName: 'credits_purchase' | 'refund'
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		checkoutStatus: string
		grantCalls: number
		grantSourceId: string
		deductCalls: number
		webhookEvents: number
		creditsReversedAtSet: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'recover half completed credits purchase',
			given: 'paid transaction exists but credit grant and checkout completion are missing',
			when: 'same payment_succeeded webhook retries',
			then: 'grants credits and completes checkout before marking webhook processed',
			givenDetail: {
				caseName: 'credits_purchase'
			},
			whenDetail: {},
			thenExpected: {
				checkoutStatus: 'completed',
				grantCalls: 1,
				grantSourceId: 'pt_1',
				deductCalls: 0,
				webhookEvents: 1,
				creditsReversedAtSet: false
			}
		},
		{
			scenario: 'recover half completed refund',
			given: 'refund id exists but credits reversed marker is missing',
			when: 'same refund_succeeded webhook retries',
			then: 'deducts credits and sets reversed marker before marking webhook processed',
			givenDetail: {
				caseName: 'refund'
			},
			whenDetail: {},
			thenExpected: {
				checkoutStatus: '',
				grantCalls: 0,
				grantSourceId: '',
				deductCalls: 1,
				webhookEvents: 1,
				creditsReversedAtSet: true
			}
		}
	]

	runCases(cases, async (given) => {
		const state = createMockState()
		const service = createService(state)

		if (given.caseName === 'credits_purchase') {
			state.checkoutOrders.push({
				id: 'co_1',
				userId: 'u1',
				type: 'credits_purchase',
				status: 'pending',
				productId: 'credits_1000',
				provider: 'dodo',
				providerProductId: 'dp_credits_1000',
				providerCheckoutSessionId: 'cs_1',
				providerPaymentId: null,
				checkoutUrl: 'https://pay.example.com/cs_1',
				createdAt: 0,
				updatedAt: 0
			})
			state.paymentTransactions.push({
				id: 'pt_1',
				userId: 'u1',
				checkoutOrderId: 'co_1',
				subscriptionId: null,
				type: 'credits_purchase',
				status: 'paid',
				productId: 'credits_1000',
				provider: 'dodo',
				providerPaymentId: 'pay_1',
				providerRefundId: null,
				providerDisputeId: null,
				amount: 1000,
				currency: 'USD',
				creditsGranted: 1000,
				creditsReversedAt: null,
				paidAt: 1000,
				refundedAt: null,
				disputedAt: null,
				createdAt: 1000,
				updatedAt: 1000
			})
			state.queryQueue.paymentTransaction.push(state.paymentTransactions[0])
			state.provider.unwrapWebhook.mockResolvedValue(createPaymentSucceededEvent())
		}

		if (given.caseName === 'refund') {
			state.paymentTransactions.push({
				id: 'pt_1',
				userId: 'u1',
				checkoutOrderId: 'co_1',
				subscriptionId: null,
				type: 'credits_purchase',
				status: 'refunded',
				productId: 'credits_1000',
				provider: 'dodo',
				providerPaymentId: 'pay_1',
				providerRefundId: 'rf_1',
				providerDisputeId: null,
				amount: 1000,
				currency: 'USD',
				creditsGranted: 1000,
				creditsReversedAt: null,
				paidAt: 1000,
				refundedAt: 2000,
				disputedAt: null,
				createdAt: 1000,
				updatedAt: 2000
			})
			state.queryQueue.paymentTransaction.push(state.paymentTransactions[0])
			state.provider.unwrapWebhook.mockResolvedValue(createRefundEvent())
		}

		await service.processWebhook('dodo', '{}', new Headers())
		const grantInput = vi.mocked(creditServiceMocks.grant).mock.calls[0]?.[0] as
			| { sourceId?: string }
			| undefined

		return {
			checkoutStatus: state.checkoutOrders[0]?.status ?? '',
			grantCalls: vi.mocked(creditServiceMocks.grant).mock.calls.length,
			grantSourceId: grantInput?.sourceId ?? '',
			deductCalls: vi.mocked(creditServiceMocks.deduct).mock.calls.length,
			webhookEvents: state.webhookEvents.length,
			creditsReversedAtSet: state.paymentTransactions[0]?.creditsReversedAt !== null
		}
	})
})

describe('PaymentService.processWebhook completion marker', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		caseName: 'missing_payment_identity' | 'grant_failure' | 'duplicated_webhook'
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		errorCode: string
		webhookEvents: number
		grantCalls: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'skip completion marker when required payment identity is missing',
			given: 'credits purchase webhook has no provider payment id',
			when: 'processing payment_succeeded webhook',
			then: 'does not write webhook event',
			givenDetail: {
				caseName: 'missing_payment_identity'
			},
			whenDetail: {},
			thenExpected: {
				errorCode: '',
				webhookEvents: 0,
				grantCalls: 0
			}
		},
		{
			scenario: 'skip completion marker when business processing fails',
			given: 'credit grant throws during payment processing',
			when: 'processing payment_succeeded webhook',
			then: 'rethrows error and does not write webhook event',
			givenDetail: {
				caseName: 'grant_failure'
			},
			whenDetail: {},
			thenExpected: {
				errorCode: 'GRANT_FAILED',
				webhookEvents: 0,
				grantCalls: 1
			}
		},
		{
			scenario: 'skip business processing for completed webhook delivery',
			given: 'webhook event already exists',
			when: 'same webhook is delivered again',
			then: 'does not run payment side effects again',
			givenDetail: {
				caseName: 'duplicated_webhook'
			},
			whenDetail: {},
			thenExpected: {
				errorCode: '',
				webhookEvents: 1,
				grantCalls: 0
			}
		}
	]

	runCases(cases, async (given) => {
		const state = createMockState()
		const service = createService(state)
		state.checkoutOrders.push({
			id: 'co_1',
			userId: 'u1',
			type: 'credits_purchase',
			status: 'pending',
			productId: 'credits_1000',
			provider: 'dodo',
			providerProductId: 'dp_credits_1000',
			providerCheckoutSessionId: 'cs_1',
			providerPaymentId: null,
			checkoutUrl: 'https://pay.example.com/cs_1',
			createdAt: 0,
			updatedAt: 0
		})

		if (given.caseName === 'missing_payment_identity') {
			state.provider.unwrapWebhook.mockResolvedValue({
				...createPaymentSucceededEvent(),
				providerPaymentId: null
			})
		}

		if (given.caseName === 'grant_failure') {
			vi.mocked(creditServiceMocks.grant).mockRejectedValueOnce(new Error('GRANT_FAILED'))
			state.provider.unwrapWebhook.mockResolvedValue(createPaymentSucceededEvent())
		}

		if (given.caseName === 'duplicated_webhook') {
			state.webhookEvents.push({
				id: 'pwe_1',
				provider: 'dodo',
				webhookId: 'evt_pay_1',
				eventType: 'payment_succeeded',
				processedAt: 1000
			})
			state.provider.unwrapWebhook.mockResolvedValue(createPaymentSucceededEvent())
		}

		try {
			await service.processWebhook('dodo', '{}', new Headers())
			return {
				errorCode: '',
				webhookEvents: state.webhookEvents.length,
				grantCalls: vi.mocked(creditServiceMocks.grant).mock.calls.length
			}
		} catch (error) {
			return {
				errorCode: error instanceof Error ? error.message : 'UNKNOWN',
				webhookEvents: state.webhookEvents.length,
				grantCalls: vi.mocked(creditServiceMocks.grant).mock.calls.length
			}
		}
	})
})

describe('PaymentService.processWebhook subscription retry recovery', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		caseName: 'initial_half_completed' | 'renewal_duplicate_payment' | 'renewal_missing_payment_id'
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		transactions: number
		checkoutStatus: string
		subscriptionPlan: string
		webhookEvents: number
		grantCalls: number
		firstGrantSourceId: string
		secondGrantSourceId: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'recover half completed initial subscription',
			given: 'paid transaction exists but subscription, grant and checkout completion are missing',
			when: 'same subscription_paid webhook retries',
			then: 'creates subscription, grants credits and completes checkout',
			givenDetail: {
				caseName: 'initial_half_completed'
			},
			whenDetail: {},
			thenExpected: {
				transactions: 1,
				checkoutStatus: 'completed',
				subscriptionPlan: 'pro',
				webhookEvents: 1,
				grantCalls: 1,
				firstGrantSourceId: 'pt_initial_1',
				secondGrantSourceId: ''
			}
		},
		{
			scenario: 'reuse payment transaction for duplicated renewal payment',
			given: 'same provider payment id is delivered with another webhook id',
			when: 'processing both renewal webhooks',
			then: 'keeps one payment transaction and grants with the same source',
			givenDetail: {
				caseName: 'renewal_duplicate_payment'
			},
			whenDetail: {},
			thenExpected: {
				transactions: 1,
				checkoutStatus: '',
				subscriptionPlan: 'pro',
				webhookEvents: 2,
				grantCalls: 2,
				firstGrantSourceId: 'pt_renewal_1',
				secondGrantSourceId: 'pt_renewal_1'
			}
		},
		{
			scenario: 'skip renewal entitlement when provider payment id is missing',
			given: 'subscription_paid renewal has provider subscription id but no provider payment id',
			when: 'processing renewal webhook',
			then: 'does not grant credits or mark webhook completed',
			givenDetail: {
				caseName: 'renewal_missing_payment_id'
			},
			whenDetail: {},
			thenExpected: {
				transactions: 0,
				checkoutStatus: '',
				subscriptionPlan: 'pro',
				webhookEvents: 0,
				grantCalls: 0,
				firstGrantSourceId: '',
				secondGrantSourceId: ''
			}
		}
	]

	runCases(cases, async (given) => {
		const state = createMockState()
		const service = createService(state)

		if (given.caseName === 'initial_half_completed') {
			state.checkoutOrders.push({
				id: 'co_initial_1',
				userId: 'u1',
				type: 'subscription_initial',
				status: 'pending',
				productId: 'pro_monthly',
				provider: 'dodo',
				providerProductId: 'dp_pro_monthly',
				providerCheckoutSessionId: 'cs_1',
				providerPaymentId: null,
				checkoutUrl: 'https://pay.example.com/cs_1',
				createdAt: 0,
				updatedAt: 0
			})
			state.paymentTransactions.push({
				id: 'pt_initial_1',
				userId: 'u1',
				checkoutOrderId: 'co_initial_1',
				subscriptionId: 'u1',
				type: 'subscription_initial',
				status: 'paid',
				productId: 'pro_monthly',
				provider: 'dodo',
				providerPaymentId: 'pay_initial_1',
				providerRefundId: null,
				providerDisputeId: null,
				amount: 1990,
				currency: 'USD',
				creditsGranted: 3000,
				creditsReversedAt: null,
				paidAt: 1000,
				refundedAt: null,
				disputedAt: null,
				createdAt: 1000,
				updatedAt: 1000
			})
			state.queryQueue.paymentTransaction.push(state.paymentTransactions[0])
			state.provider.unwrapWebhook.mockResolvedValue({
				...createSubscriptionPaidEvent(),
				webhookId: 'evt_initial_1',
				providerPaymentId: 'pay_initial_1',
				checkoutOrderId: 'co_initial_1',
				providerSubscriptionId: 'sub_initial_1',
				amount: 1990
			})
			await service.processWebhook('dodo', '{}', new Headers())
		}

		if (given.caseName === 'renewal_duplicate_payment') {
			state.userSubscriptions.push({
				userId: 'u1',
				provider: 'dodo',
				providerSubscriptionId: 'sub_1',
				productId: 'pro_monthly',
				subscriptionPlan: 'pro',
				periodCreditsAmount: 3000,
				currentPeriodStart: 0,
				currentPeriodEnd: 2000,
				status: 'active',
				canceledAt: null,
				createdAt: 0,
				updatedAt: 0
			})
			state.paymentTransactions.push({
				id: 'pt_renewal_1',
				userId: 'u1',
				checkoutOrderId: null,
				subscriptionId: 'u1',
				type: 'subscription_renewal',
				status: 'paid',
				productId: 'pro_monthly',
				provider: 'dodo',
				providerPaymentId: 'pay_renewal_1',
				providerRefundId: null,
				providerDisputeId: null,
				amount: 1990,
				currency: 'USD',
				creditsGranted: 3000,
				creditsReversedAt: null,
				paidAt: 2000,
				refundedAt: null,
				disputedAt: null,
				createdAt: 1000,
				updatedAt: 1000
			})
			state.queryQueue.paymentWebhookEvent.push(undefined, undefined)
			state.provider.unwrapWebhook.mockResolvedValue({
				...createSubscriptionPaidEvent(),
				webhookId: 'evt_renewal_1',
				checkoutOrderId: null,
				providerPaymentId: 'pay_renewal_1'
			})
			await service.processWebhook('dodo', '{}', new Headers())
			state.provider.unwrapWebhook.mockResolvedValue({
				...createSubscriptionPaidEvent(),
				webhookId: 'evt_renewal_2',
				checkoutOrderId: null,
				providerPaymentId: 'pay_renewal_1'
			})
			await service.processWebhook('dodo', '{}', new Headers())
		}

		if (given.caseName === 'renewal_missing_payment_id') {
			state.userSubscriptions.push({
				userId: 'u1',
				provider: 'dodo',
				providerSubscriptionId: 'sub_1',
				productId: 'pro_monthly',
				subscriptionPlan: 'pro',
				periodCreditsAmount: 3000,
				currentPeriodStart: 0,
				currentPeriodEnd: 2000,
				status: 'active',
				canceledAt: null,
				createdAt: 0,
				updatedAt: 0
			})
			state.provider.unwrapWebhook.mockResolvedValue({
				...createSubscriptionPaidEvent(),
				checkoutOrderId: null,
				providerPaymentId: null
			})
			await service.processWebhook('dodo', '{}', new Headers())
		}

		const firstGrantInput = vi.mocked(creditServiceMocks.grant).mock.calls[0]?.[0] as
			| { sourceId?: string }
			| undefined
		const secondGrantInput = vi.mocked(creditServiceMocks.grant).mock.calls[1]?.[0] as
			| { sourceId?: string }
			| undefined

		return {
			transactions: state.paymentTransactions.length,
			checkoutStatus: state.checkoutOrders[0]?.status ?? '',
			subscriptionPlan: state.userSubscriptions[0]?.subscriptionPlan ?? '',
			webhookEvents: state.webhookEvents.length,
			grantCalls: vi.mocked(creditServiceMocks.grant).mock.calls.length,
			firstGrantSourceId: firstGrantInput?.sourceId ?? '',
			secondGrantSourceId: secondGrantInput?.sourceId ?? ''
		}
	})
})

describe('PaymentService.processWebhook subscription upgrade recovery', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		caseName: 'upgrade_half_completed' | 'zero_credits_diff'
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		transactions: number
		checkoutStatus: string
		subscriptionPlan: string
		webhookEvents: number
		grantCalls: number
		grantSourceId: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'recover half completed subscription upgrade',
			given: 'upgrade transaction exists but subscription, grant and checkout completion are missing',
			when: 'same subscription_paid webhook retries',
			then: 'upgrades subscription, grants diff credits and completes checkout',
			givenDetail: {
				caseName: 'upgrade_half_completed'
			},
			whenDetail: {},
			thenExpected: {
				transactions: 1,
				checkoutStatus: 'completed',
				subscriptionPlan: 'team',
				webhookEvents: 1,
				grantCalls: 1,
				grantSourceId: 'pt_upgrade_1'
			}
		},
		{
			scenario: 'skip upgrade credit grant when credits diff is zero',
			given: 'upgrade checkout target has same period credits amount',
			when: 'processing subscription_paid webhook',
			then: 'completes upgrade without calling credit grant',
			givenDetail: {
				caseName: 'zero_credits_diff'
			},
			whenDetail: {},
			thenExpected: {
				transactions: 1,
				checkoutStatus: 'completed',
				subscriptionPlan: 'pro',
				webhookEvents: 1,
				grantCalls: 0,
				grantSourceId: ''
			}
		}
	]

	runCases(cases, async (given) => {
		const state = createMockState()
		const service = createService(state)
		const checkoutProductId = given.caseName === 'zero_credits_diff' ? 'pro_monthly' : 'team_monthly'
		const providerPaymentId = given.caseName === 'zero_credits_diff' ? 'pay_upgrade_zero_1' : 'pay_upgrade_1'
		const transactionId = given.caseName === 'zero_credits_diff' ? 'pt_upgrade_zero_1' : 'pt_upgrade_1'
		state.checkoutOrders.push({
			id: 'co_upgrade_1',
			userId: 'u1',
			type: 'subscription_upgrade',
			status: 'pending',
			productId: checkoutProductId,
			provider: 'dodo',
			providerProductId: 'dp_team_monthly',
			providerCheckoutSessionId: null,
			providerPaymentId: null,
			checkoutUrl: null,
			createdAt: 0,
			updatedAt: 0
		})
		state.userSubscriptions.push({
			userId: 'u1',
			provider: 'dodo',
			providerSubscriptionId: 'sub_1',
			productId: 'pro_monthly',
			subscriptionPlan: 'pro',
			periodCreditsAmount: 3000,
			currentPeriodStart: 0,
			currentPeriodEnd: 2000,
			status: 'active',
			canceledAt: null,
			createdAt: 0,
			updatedAt: 0
		})
		state.paymentTransactions.push({
			id: transactionId,
			userId: 'u1',
			checkoutOrderId: 'co_upgrade_1',
			subscriptionId: 'u1',
			type: 'subscription_upgrade',
			status: 'paid',
			productId: checkoutProductId,
			provider: 'dodo',
			providerPaymentId,
			providerRefundId: null,
			providerDisputeId: null,
			amount: 3990,
			currency: 'USD',
			creditsGranted: given.caseName === 'zero_credits_diff' ? 0 : 3000,
			creditsReversedAt: null,
			paidAt: 1000,
			refundedAt: null,
			disputedAt: null,
			createdAt: 1000,
			updatedAt: 1000
		})
		state.queryQueue.paymentTransaction.push(state.paymentTransactions[0])
		state.provider.unwrapWebhook.mockResolvedValue({
			...createSubscriptionPaidEvent(),
			webhookId: given.caseName === 'zero_credits_diff' ? 'evt_upgrade_zero_1' : 'evt_upgrade_1',
			checkoutOrderId: 'co_upgrade_1',
			providerPaymentId
		})

		await service.processWebhook('dodo', '{}', new Headers())
		const grantInput = vi.mocked(creditServiceMocks.grant).mock.calls[0]?.[0] as
			| { sourceId?: string }
			| undefined

		return {
			transactions: state.paymentTransactions.length,
			checkoutStatus: state.checkoutOrders[0]?.status ?? '',
			subscriptionPlan: state.userSubscriptions[0]?.subscriptionPlan ?? '',
			webhookEvents: state.webhookEvents.length,
			grantCalls: vi.mocked(creditServiceMocks.grant).mock.calls.length,
			grantSourceId: grantInput?.sourceId ?? ''
		}
	})
})

describe('PaymentService.processWebhook refund and failure recovery', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		caseName: 'duplicated_refund' | 'failed_completed_checkout' | 'dispute_identity'
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		checkoutStatus: string
		transactionStatus: string
		providerDisputeId: string
		webhookEvents: number
		deductCalls: number
		creditsReversedAtSet: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'deduplicate refund credit reversal by reversed marker',
			given: 'same refund is delivered with another webhook id after credits are reversed',
			when: 'processing both refund webhooks',
			then: 'deducts credits once and records both completed deliveries',
			givenDetail: {
				caseName: 'duplicated_refund'
			},
			whenDetail: {},
			thenExpected: {
				checkoutStatus: '',
				transactionStatus: 'refunded',
				providerDisputeId: '',
				webhookEvents: 2,
				deductCalls: 1,
				creditsReversedAtSet: true
			}
		},
		{
			scenario: 'keep completed checkout when payment failed arrives later',
			given: 'checkout order is already completed',
			when: 'processing payment_failed webhook',
			then: 'does not overwrite checkout status',
			givenDetail: {
				caseName: 'failed_completed_checkout'
			},
			whenDetail: {},
			thenExpected: {
				checkoutStatus: 'completed',
				transactionStatus: '',
				providerDisputeId: '',
				webhookEvents: 1,
				deductCalls: 0,
				creditsReversedAtSet: false
			}
		},
		{
			scenario: 'record dispute identity on paid transaction',
			given: 'paid transaction exists',
			when: 'processing dispute_opened webhook',
			then: 'marks transaction disputed and stores provider dispute id',
			givenDetail: {
				caseName: 'dispute_identity'
			},
			whenDetail: {},
			thenExpected: {
				checkoutStatus: '',
				transactionStatus: 'disputed',
				providerDisputeId: 'dp_1',
				webhookEvents: 1,
				deductCalls: 0,
				creditsReversedAtSet: false
			}
		}
	]

	runCases(cases, async (given) => {
		const state = createMockState()
		const service = createService(state)

		if (given.caseName === 'duplicated_refund' || given.caseName === 'dispute_identity') {
			state.paymentTransactions.push({
				id: 'pt_1',
				userId: 'u1',
				checkoutOrderId: 'co_1',
				subscriptionId: null,
				type: 'credits_purchase',
				status: 'paid',
				productId: 'credits_1000',
				provider: 'dodo',
				providerPaymentId: 'pay_1',
				providerRefundId: null,
				providerDisputeId: null,
				amount: 1000,
				currency: 'USD',
				creditsGranted: 1000,
				creditsReversedAt: null,
				paidAt: 1000,
				refundedAt: null,
				disputedAt: null,
				createdAt: 1000,
				updatedAt: 1000
			})
		}

		if (given.caseName === 'duplicated_refund') {
			state.queryQueue.paymentWebhookEvent.push(undefined, undefined)
			state.provider.unwrapWebhook.mockResolvedValue(createRefundEvent())
			await service.processWebhook('dodo', '{}', new Headers())
			state.provider.unwrapWebhook.mockResolvedValue({
				...createRefundEvent(),
				webhookId: 'evt_refund_2'
			})
			await service.processWebhook('dodo', '{}', new Headers())
		}

		if (given.caseName === 'failed_completed_checkout') {
			state.checkoutOrders.push({
				id: 'co_1',
				userId: 'u1',
				type: 'credits_purchase',
				status: 'completed',
				productId: 'credits_1000',
				provider: 'dodo',
				providerProductId: 'dp_credits_1000',
				providerCheckoutSessionId: 'cs_1',
				providerPaymentId: 'pay_1',
				checkoutUrl: 'https://pay.example.com/cs_1',
				createdAt: 0,
				updatedAt: 0
			})
			state.provider.unwrapWebhook.mockResolvedValue(createPaymentFailedEvent())
			await service.processWebhook('dodo', '{}', new Headers())
		}

		if (given.caseName === 'dispute_identity') {
			state.provider.unwrapWebhook.mockResolvedValue(createDisputeEvent())
			await service.processWebhook('dodo', '{}', new Headers())
		}

		return {
			checkoutStatus: state.checkoutOrders[0]?.status ?? '',
			transactionStatus: state.paymentTransactions[0]?.status ?? '',
			providerDisputeId: state.paymentTransactions[0]?.providerDisputeId ?? '',
			webhookEvents: state.webhookEvents.length,
			deductCalls: vi.mocked(creditServiceMocks.deduct).mock.calls.length,
			creditsReversedAtSet:
				state.paymentTransactions[0]?.creditsReversedAt !== null &&
				state.paymentTransactions[0]?.creditsReversedAt !== undefined
		}
	})
})

type MockState = {
	users: Array<{ id: string; email: string }>
	checkoutOrders: Array<typeof checkoutOrder.$inferSelect>
	paymentTransactions: Array<typeof paymentTransaction.$inferSelect>
	userSubscriptions: Array<typeof userSubscription.$inferSelect>
	webhookEvents: Array<typeof paymentWebhookEvent.$inferSelect>
	queryQueue: {
		checkoutOrder: Array<typeof checkoutOrder.$inferSelect | undefined>
		paymentTransaction: Array<typeof paymentTransaction.$inferSelect | undefined>
		userSubscription: Array<typeof userSubscription.$inferSelect | undefined>
		paymentWebhookEvent: Array<typeof paymentWebhookEvent.$inferSelect | undefined>
		user: Array<{ id: string; email: string } | undefined>
	}
	provider: ReturnType<typeof createProviderMock>
}

function createMockState(): MockState {
	return {
		users: [],
		checkoutOrders: [],
		paymentTransactions: [],
		userSubscriptions: [],
		webhookEvents: [],
		queryQueue: {
			checkoutOrder: [],
			paymentTransaction: [],
			userSubscription: [],
			paymentWebhookEvent: [],
			user: []
		},
		provider: createProviderMock()
	}
}

function createService(
	state: MockState,
	options?: {
		enabled?: boolean
	}
): PaymentService {
	const config: PaymentConfig = {
		enabled: options?.enabled ?? true,
		providers: ['dodo', 'creem'],
		defaultProvider: 'dodo',
		providerCountryOverrides: [{ country: 'CN', provider: 'dodo' }],
		products: [
			{
				productId: 'credits_1000',
				creditsAmount: 1000,
				subscriptionPlan: null,
				upgradeRank: null,
				periodCreditsAmount: null,
				providerProductIds: {
					dodo: 'dp_credits_1000',
					creem: 'cp_credits_1000'
				}
			},
			{
				productId: 'pro_monthly',
				creditsAmount: null,
				subscriptionPlan: 'pro',
				upgradeRank: 20,
				periodCreditsAmount: 3000,
				providerProductIds: {
					dodo: 'dp_pro_monthly',
					creem: 'cp_pro_monthly'
				}
			},
			{
				productId: 'team_monthly',
				creditsAmount: null,
				subscriptionPlan: 'team',
				upgradeRank: 30,
				periodCreditsAmount: 6000,
				providerProductIds: {
					dodo: 'dp_team_monthly',
					creem: 'cp_team_monthly'
				}
			}
		]
	}
	const providerRouter = new PaymentProviderRouter({
		defaultProvider: config.defaultProvider,
		providerCountryOverrides: config.providerCountryOverrides
	})

	state.provider.listProducts.mockResolvedValue([
		{
			providerProductId: 'dp_credits_1000',
			name: 'Credits 1000',
			description: '',
			priceAmount: 1000,
			currency: 'USD',
			billingMode: 'one_time'
		},
		{
			providerProductId: 'dp_pro_monthly',
			name: 'Pro Monthly',
			description: '',
			priceAmount: 1990,
			currency: 'USD',
			billingMode: 'subscription'
		},
		{
			providerProductId: 'dp_team_monthly',
			name: 'Team Monthly',
			description: '',
			priceAmount: 3990,
			currency: 'USD',
			billingMode: 'subscription'
		}
	])
	state.provider.createCheckout.mockResolvedValue({
		providerCheckoutSessionId: 'cs_1',
		checkoutUrl: 'https://pay.example.com/cs_1'
	})
	state.provider.changeSubscriptionPlan.mockResolvedValue({
		providerPaymentId: null
	})
		state.provider.cancelSubscription.mockResolvedValue(undefined)
	state.provider.unwrapWebhook.mockResolvedValue(createPaymentSucceededEvent())

	const providers: PaymentProviderMap = {
		dodo: state.provider as unknown as PaymentProvider,
		creem: state.provider as unknown as PaymentProvider
	}

	return new PaymentService(
		createMockDb(state),
		config,
		providerRouter,
		providers,
		async (): Promise<never> => {
			return creditServiceMocks as never
		}
	)
}

function createMockDb(state: MockState): AppDb {
	const db = {
		query: {
			user: {
				findFirst: async (): Promise<{ email: string } | undefined> => {
					if (state.queryQueue.user.length > 0) {
						const queued = state.queryQueue.user.shift()
						return queued
					}
					const row = state.users[0]
					if (!row) {
						return undefined
					}
					return {
						email: row.email
					}
				}
			},
			checkoutOrder: {
				findFirst: async (): Promise<typeof checkoutOrder.$inferSelect | undefined> => {
					if (state.queryQueue.checkoutOrder.length > 0) {
						const queued = state.queryQueue.checkoutOrder.shift()
						return queued
					}
					return state.checkoutOrders[0]
				}
			},
			paymentTransaction: {
				findFirst: async (): Promise<typeof paymentTransaction.$inferSelect | undefined> => {
					if (state.queryQueue.paymentTransaction.length > 0) {
						const queued = state.queryQueue.paymentTransaction.shift()
						return queued
					}
					return state.paymentTransactions[0]
				}
			},
			userSubscription: {
				findFirst: async (): Promise<typeof userSubscription.$inferSelect | undefined> => {
					if (state.queryQueue.userSubscription.length > 0) {
						const queued = state.queryQueue.userSubscription.shift()
						return queued
					}
					return state.userSubscriptions[0]
				}
			},
			paymentWebhookEvent: {
				findFirst: async (): Promise<typeof paymentWebhookEvent.$inferSelect | undefined> => {
					if (state.queryQueue.paymentWebhookEvent.length > 0) {
						const queued = state.queryQueue.paymentWebhookEvent.shift()
						return queued
					}
					return state.webhookEvents[0]
				}
			}
		},
		insert: (table: unknown) => {
			return {
				values: (payload: unknown): unknown => {
					if (table === checkoutOrder) {
						state.checkoutOrders.push(payload as typeof checkoutOrder.$inferSelect)
						return Promise.resolve()
					}
					if (table === paymentTransaction) {
						state.paymentTransactions.push(payload as typeof paymentTransaction.$inferSelect)
						return {
							onConflictDoNothing: async (): Promise<void> => {}
						}
					}
					if (table === paymentWebhookEvent) {
						state.webhookEvents.push(payload as typeof paymentWebhookEvent.$inferSelect)
						return Promise.resolve()
					}
					if (table === userSubscription) {
						const row = payload as typeof userSubscription.$inferSelect
						return {
							onConflictDoUpdate: async (input: {
								target: unknown
								set: Partial<typeof userSubscription.$inferSelect>
							}): Promise<void> => {
								const index = state.userSubscriptions.findIndex((item) => item.userId === row.userId)
								if (index === -1) {
									state.userSubscriptions.push(row)
									return
								}
									state.userSubscriptions[index] = {
										...state.userSubscriptions[index],
										...input.set
									} as typeof userSubscription.$inferSelect
							}
						}
					}
					return Promise.resolve()
				}
			}
		},
		update: (table: unknown) => {
			return {
				set: (payload: unknown) => {
					return {
						where: async (): Promise<void> => {
							if (table === checkoutOrder && state.checkoutOrders[0]) {
								state.checkoutOrders[0] = {
									...state.checkoutOrders[0],
									...(payload as Partial<typeof checkoutOrder.$inferSelect>)
								}
							}
							if (table === paymentTransaction && state.paymentTransactions[0]) {
								state.paymentTransactions[0] = {
									...state.paymentTransactions[0],
									...(payload as Partial<typeof paymentTransaction.$inferSelect>)
								}
							}
							if (table === userSubscription && state.userSubscriptions[0]) {
								state.userSubscriptions[0] = {
									...state.userSubscriptions[0],
									...(payload as Partial<typeof userSubscription.$inferSelect>)
								}
							}
						}
					}
				}
			}
		}
	}
	return db as unknown as AppDb
}

function createProviderMock(): {
	listProducts: ReturnType<typeof vi.fn>
	createCheckout: ReturnType<typeof vi.fn>
	changeSubscriptionPlan: ReturnType<typeof vi.fn>
	cancelSubscription: ReturnType<typeof vi.fn>
	unwrapWebhook: ReturnType<typeof vi.fn>
} {
	return {
		listProducts: vi.fn(),
		createCheckout: vi.fn(),
		changeSubscriptionPlan: vi.fn(),
		cancelSubscription: vi.fn(),
		unwrapWebhook: vi.fn()
	}
}

function createPaymentSucceededEvent() {
	return {
		provider: 'dodo' as const,
		webhookId: 'evt_pay_1',
		type: 'payment_succeeded' as const,
		providerPaymentId: 'pay_1',
		providerRefundId: null,
		providerDisputeId: null,
		providerSubscriptionId: null,
		checkoutOrderId: 'co_1',
		amount: 1000,
		currency: 'USD',
		periodStart: null,
		periodEnd: null,
		occurredAt: 1717200000
	}
}

function createPaymentFailedEvent() {
	return {
		provider: 'dodo' as const,
		webhookId: 'evt_pay_failed_1',
		type: 'payment_failed' as const,
		providerPaymentId: 'pay_failed_1',
		providerRefundId: null,
		providerDisputeId: null,
		providerSubscriptionId: null,
		checkoutOrderId: 'co_1',
		amount: 1000,
		currency: 'USD',
		periodStart: null,
		periodEnd: null,
		occurredAt: 1717200000
	}
}

function createSubscriptionPaidEvent() {
	return {
		provider: 'dodo' as const,
		webhookId: 'evt_sub_1',
		type: 'subscription_paid' as const,
		providerPaymentId: 'pay_upgrade_1',
		providerRefundId: null,
		providerDisputeId: null,
		providerSubscriptionId: 'sub_1',
		checkoutOrderId: 'co_upgrade_1',
		amount: 3990,
		currency: 'USD',
		periodStart: 1717200000,
		periodEnd: 1719792000,
		occurredAt: 1717200000
	}
}

function createRefundEvent() {
	return {
		provider: 'dodo' as const,
		webhookId: 'evt_refund_1',
		type: 'refund_succeeded' as const,
		providerPaymentId: 'pay_1',
		providerRefundId: 'rf_1',
		providerDisputeId: null,
		providerSubscriptionId: null,
		checkoutOrderId: null,
		amount: 1000,
		currency: 'USD',
		periodStart: null,
		periodEnd: null,
		occurredAt: 1717200000
	}
}

function createDisputeEvent() {
	return {
		provider: 'dodo' as const,
		webhookId: 'evt_dispute_1',
		type: 'dispute_opened' as const,
		providerPaymentId: 'pay_1',
		providerRefundId: null,
		providerDisputeId: 'dp_1',
		providerSubscriptionId: null,
		checkoutOrderId: null,
		amount: 1000,
		currency: 'USD',
		periodStart: null,
		periodEnd: null,
		occurredAt: 1717200000
	}
}
