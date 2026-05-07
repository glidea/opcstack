import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import {
	DodoPaymentProvider,
	newDodoPayment,
	type DodoClient,
	type DodoClientOptions
} from './dodo'
import type { PaymentEvent } from './index'

describe('DodoPaymentProvider.listProducts', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		providerProductIds: string[]
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		providerProductIds: string[]
		billingModes: string[]
		priceAmounts: number[]
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'map dodo products into provider products',
			given: 'two products from dodo',
			when: 'calling listProducts',
			then: 'returns normalized product fields',
			givenDetail: {
				providerProductIds: ['p1', 'p2']
			},
			whenDetail: {},
			thenExpected: {
				providerProductIds: ['p1', 'p2'],
				billingModes: ['one_time', 'subscription'],
				priceAmounts: [1200, 5600]
			}
		}
	]

	runCases(cases, async (given) => {
		const client: DodoClient = createMockClient()
		vi.mocked(client.products.retrieve)
			.mockResolvedValueOnce(createDodoProduct('p1', false, 1200) as never)
			.mockResolvedValueOnce(createDodoProduct('p2', true, 5600) as never)

		const provider = new DodoPaymentProvider(client, 'whsec')
		const products = await provider.listProducts({
			providerProductIds: given.providerProductIds
		})

		return {
			providerProductIds: products.map((item) => item.providerProductId),
			billingModes: products.map((item) => item.billingMode),
			priceAmounts: products.map((item) => item.priceAmount)
		}
	})
})

describe('DodoPaymentProvider.createCheckout', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		checkoutOrderId: string
		providerProductId: string
		customerEmail: string
		returnUrl: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		sessionId: string
		checkoutUrl: string
		metadataCheckoutOrderId: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'create checkout with checkout_order_id metadata',
			given: 'a checkout input',
			when: 'calling createCheckout',
			then: 'returns session and passes metadata',
			givenDetail: {
				checkoutOrderId: 'co_1',
				providerProductId: 'p_1',
				customerEmail: 'user@example.com',
				returnUrl: 'https://app.example.com/billing/result'
			},
			whenDetail: {},
			thenExpected: {
				sessionId: 'cs_1',
				checkoutUrl: 'https://pay.example.com/cs_1',
				metadataCheckoutOrderId: 'co_1'
			}
		}
	]

	runCases(cases, async (given) => {
		const client: DodoClient = createMockClient()
		vi.mocked(client.checkoutSessions.create).mockResolvedValue({
			session_id: 'cs_1',
			checkout_url: 'https://pay.example.com/cs_1'
		})

		const provider = new DodoPaymentProvider(client, 'whsec')
		const result = await provider.createCheckout(given)
		const payload = vi.mocked(client.checkoutSessions.create).mock.calls[0]?.[0]

		return {
			sessionId: result.providerCheckoutSessionId,
			checkoutUrl: result.checkoutUrl,
			metadataCheckoutOrderId: String(payload?.metadata['checkout_order_id'] ?? '')
		}
	})
})

describe('DodoPaymentProvider.subscriptionActions', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		checkoutOrderId: string
		providerSubscriptionId: string
		providerProductId: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		changePlanCheckoutOrderId: string
		cancelAtNextBillingDate: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'change plan and cancel at period end',
			given: 'subscription ids are provided',
			when: 'calling changeSubscriptionPlan and cancelSubscription',
			then: 'passes expected dodo payload',
			givenDetail: {
				checkoutOrderId: 'co_2',
				providerSubscriptionId: 'sub_1',
				providerProductId: 'prod_2'
			},
			whenDetail: {},
			thenExpected: {
				changePlanCheckoutOrderId: 'co_2',
				cancelAtNextBillingDate: true
			}
		}
	]

	runCases(cases, async (given) => {
		const client: DodoClient = createMockClient()
		vi.mocked(client.subscriptions.changePlan).mockResolvedValue()
		vi.mocked(client.subscriptions.update).mockResolvedValue({} as never)

		const provider = new DodoPaymentProvider(client, 'whsec')
		await provider.changeSubscriptionPlan(given)
		await provider.cancelSubscription({
			providerSubscriptionId: given.providerSubscriptionId
		})

		const changePlanPayload = vi.mocked(client.subscriptions.changePlan).mock.calls[0]?.[1]
		const cancelPayload = vi.mocked(client.subscriptions.update).mock.calls[0]?.[1]

		return {
			changePlanCheckoutOrderId: String(changePlanPayload?.metadata['checkout_order_id'] ?? ''),
			cancelAtNextBillingDate: cancelPayload?.cancel_at_next_billing_date === true
		}
	})
})

describe('DodoPaymentProvider.unwrapWebhook', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		webhookEvent: PaymentEvent
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		eventType: string
		providerPaymentId: string
		checkoutOrderId: string
		periodEnd: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'map payment.succeeded to payment_succeeded',
			given: 'dodo payment success webhook',
			when: 'unwrapping webhook',
			then: 'returns normalized payment event',
			givenDetail: {
				webhookEvent: {
					provider: 'dodo',
					webhookId: 'payment.succeeded:pay_1:2026-01-01T00:00:00Z',
					type: 'payment_succeeded',
					providerPaymentId: 'pay_1',
					providerRefundId: null,
					providerDisputeId: null,
					providerSubscriptionId: null,
					checkoutOrderId: 'co_3',
					amount: 1234,
					currency: 'USD',
					periodStart: null,
					periodEnd: null,
					occurredAt: 1767225600
				}
			},
			whenDetail: {},
			thenExpected: {
				eventType: 'payment_succeeded',
				providerPaymentId: 'pay_1',
				checkoutOrderId: 'co_3',
				periodEnd: -1
			}
		},
		{
			scenario: 'map subscription.renewed to subscription_paid',
			given: 'dodo subscription renewed webhook',
			when: 'unwrapping webhook',
			then: 'returns normalized subscription event',
			givenDetail: {
				webhookEvent: {
					provider: 'dodo',
					webhookId: 'subscription.renewed:sub_2:2026-01-01T00:00:00Z',
					type: 'subscription_paid',
					providerPaymentId: null,
					providerRefundId: null,
					providerDisputeId: null,
					providerSubscriptionId: 'sub_2',
					checkoutOrderId: 'co_4',
					amount: 2000,
					currency: 'USD',
					periodStart: 1764547200,
					periodEnd: 1767225600,
					occurredAt: 1767225600
				}
			},
			whenDetail: {},
			thenExpected: {
				eventType: 'subscription_paid',
				providerPaymentId: '',
				checkoutOrderId: 'co_4',
				periodEnd: 1767225600
			}
		}
	]

	runCases(cases, async (given) => {
		const client: DodoClient = createMockClient()
		vi.mocked(client.webhooks.unwrap).mockReturnValue(
			toDodoWebhookEvent(given.webhookEvent) as never
		)
		const provider = new DodoPaymentProvider(client, 'whsec')

		const event = await provider.unwrapWebhook({
			rawBody: '{"ok":true}',
			headers: new Headers({
				'x-signature': 'abc'
			})
		})

		return {
			eventType: event.type,
			providerPaymentId: event.providerPaymentId ?? '',
			checkoutOrderId: event.checkoutOrderId ?? '',
			periodEnd: event.periodEnd ?? -1
		}
	})
})

describe('newDodoPayment', () => {
	type GivenDetail = {
		testMode: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		environment: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'use test_mode in test env',
			given: 'PAYMENT_DODO_TEST_MODE=true',
			when: 'creating dodo provider',
			then: 'sdk client uses test_mode',
			givenDetail: {
				testMode: 'true'
			},
			whenDetail: {},
			thenExpected: {
				environment: 'test_mode'
			}
		}
	]

	runCases(cases, async (given) => {
		let environment: string = ''
		newDodoPayment(
			{
				PAYMENT_DODO_API_KEY: 'api-key',
				PAYMENT_DODO_WEBHOOK_SECRET: 'webhook-secret',
				PAYMENT_DODO_TEST_MODE: given.testMode
			} as unknown as Env,
			(input: DodoClientOptions): DodoClient => {
				environment = input.environment
				return createMockClient()
			}
		)

		return {
			environment
		}
	})
})

function createMockClient(): DodoClient {
	return {
		products: {
			retrieve: vi.fn()
		},
		checkoutSessions: {
			create: vi.fn()
		},
		subscriptions: {
			changePlan: vi.fn(),
			update: vi.fn()
		},
		webhooks: {
			unwrap: vi.fn()
		}
	}
}

function createDodoProduct(
	productId: string,
	isRecurring: boolean,
	priceAmount: number
): unknown {
	return {
		product_id: productId,
		name: productId,
		description: null,
		is_recurring: isRecurring,
		price: {
			type: isRecurring ? 'recurring_price' : 'one_time_price',
			price: priceAmount,
			currency: 'USD'
		}
	}
}

function toDodoWebhookEvent(event: PaymentEvent): unknown {
	if (event.type === 'payment_succeeded') {
		return {
			type: 'payment.succeeded',
			timestamp: '2026-01-01T00:00:00Z',
			data: {
				payment_id: event.providerPaymentId,
				subscription_id: null,
				total_amount: event.amount,
				currency: event.currency,
				metadata: {
					checkout_order_id: event.checkoutOrderId
				}
			}
		}
	}

	return {
		type: 'subscription.renewed',
		timestamp: '2026-01-01T00:00:00Z',
		data: {
			subscription_id: event.providerSubscriptionId,
			recurring_pre_tax_amount: event.amount,
			currency: event.currency,
			previous_billing_date: '2025-12-01T00:00:00Z',
			next_billing_date: '2026-01-01T00:00:00Z',
			metadata: {
				checkout_order_id: event.checkoutOrderId
			}
		}
	}
}
