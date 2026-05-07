import { createHmac } from 'node:crypto'
import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import {
	createCreemPaymentProviderFromEnv,
	CreemPaymentProvider,
	type CreemClient,
	type CreemClientOptions
} from './creem'

describe('CreemPaymentProvider.listProducts', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		providerProductIds: string[]
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		billingModes: string[]
		priceAmounts: number[]
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'map creem products into provider products',
			given: 'two creem products',
			when: 'calling listProducts',
			then: 'returns normalized product fields',
			givenDetail: {
				providerProductIds: ['prod_1', 'prod_2']
			},
			whenDetail: {},
			thenExpected: {
				billingModes: ['one_time', 'subscription'],
				priceAmounts: [1000, 3000]
			}
		}
	]

	runCases(cases, async (given) => {
		const client: CreemClient = createMockClient()
		vi.mocked(client.products.get)
			.mockResolvedValueOnce(createCreemProduct('prod_1', 'onetime', 1000) as never)
			.mockResolvedValueOnce(createCreemProduct('prod_2', 'recurring', 3000) as never)

		const provider = new CreemPaymentProvider(client, 'whsec')
		const products = await provider.listProducts({
			providerProductIds: given.providerProductIds
		})

		return {
			billingModes: products.map((item) => item.billingMode),
			priceAmounts: products.map((item) => item.priceAmount)
		}
	})
})

describe('CreemPaymentProvider.createCheckout', () => {
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
		checkoutSessionId: string
		metadataCheckoutOrderId: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'create checkout with requestId and metadata',
			given: 'a checkout request',
			when: 'calling createCheckout',
			then: 'sends checkout_order_id metadata',
			givenDetail: {
				checkoutOrderId: 'co_10',
				providerProductId: 'prod_10',
				customerEmail: 'user@example.com',
				returnUrl: 'https://app.example.com/billing/result'
			},
			whenDetail: {},
			thenExpected: {
				checkoutSessionId: 'ch_10',
				metadataCheckoutOrderId: 'co_10'
			}
		}
	]

	runCases(cases, async (given) => {
		const client: CreemClient = createMockClient()
		vi.mocked(client.checkouts.create).mockResolvedValue({
			id: 'ch_10',
			checkoutUrl: 'https://pay.creem.io/ch_10',
			requestId: 'co_10'
		} as never)

		const provider = new CreemPaymentProvider(client, 'whsec')
		const result = await provider.createCheckout(given)
		const payload = vi.mocked(client.checkouts.create).mock.calls[0]?.[0]

		return {
			checkoutSessionId: result.providerCheckoutSessionId,
			metadataCheckoutOrderId: String(payload?.metadata['checkout_order_id'] ?? '')
		}
	})
})

describe('CreemPaymentProvider.subscriptionActions', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		providerSubscriptionId: string
		providerProductId: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		updateBehavior: string
		cancelMode: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'upgrade and schedule cancel',
			given: 'subscription ids are provided',
			when: 'calling changeSubscriptionPlan and cancelSubscription',
			then: 'uses creem expected payload',
			givenDetail: {
				providerSubscriptionId: 'sub_20',
				providerProductId: 'prod_20'
			},
			whenDetail: {},
			thenExpected: {
				updateBehavior: 'proration-charge-immediately',
				cancelMode: 'scheduled'
			}
		}
	]

	runCases(cases, async (given) => {
		const client: CreemClient = createMockClient()
		vi.mocked(client.subscriptions.upgrade).mockResolvedValue({
			id: given.providerSubscriptionId,
			lastTransactionId: 'txn_1'
		} as never)
		vi.mocked(client.subscriptions.cancel).mockResolvedValue({} as never)

		const provider = new CreemPaymentProvider(client, 'whsec')
		await provider.changeSubscriptionPlan({
			checkoutOrderId: 'co_20',
			providerSubscriptionId: given.providerSubscriptionId,
			providerProductId: given.providerProductId
		})
		await provider.cancelSubscription({
			providerSubscriptionId: given.providerSubscriptionId
		})

		const upgradePayload = vi.mocked(client.subscriptions.upgrade).mock.calls[0]?.[1]
		const cancelPayload = vi.mocked(client.subscriptions.cancel).mock.calls[0]?.[1]

		return {
			updateBehavior: String(upgradePayload?.updateBehavior ?? ''),
			cancelMode: String(cancelPayload?.mode ?? '')
		}
	})
})

describe('CreemPaymentProvider.unwrapWebhook', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		signature: string
		rawBody: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		errorCode: string
		eventType: string
		checkoutOrderId: string
	}

	const validBody = JSON.stringify({
		id: 'evt_1',
		eventType: 'checkout.completed',
		created_at: 1728734325927,
		object: {
			request_id: 'co_30',
			metadata: {
				checkout_order_id: 'co_30'
			},
			order: {
				id: 'ord_1',
				amount: 1000,
				currency: 'USD'
			}
		}
	})

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'map checkout.completed into payment_succeeded',
			given: 'valid signature and payload',
			when: 'unwrapping creem webhook',
			then: 'returns normalized payment event',
			givenDetail: {
				signature: signBody(validBody, 'whsec'),
				rawBody: validBody
			},
			whenDetail: {},
			thenExpected: {
				errorCode: '',
				eventType: 'payment_succeeded',
				checkoutOrderId: 'co_30'
			}
		},
		{
			scenario: 'reject webhook when signature is invalid',
			given: 'invalid signature',
			when: 'unwrapping creem webhook',
			then: 'returns signature error',
			givenDetail: {
				signature: 'deadbeef',
				rawBody: validBody
			},
			whenDetail: {},
			thenExpected: {
				errorCode: 'CREEM_WEBHOOK_SIGNATURE_INVALID',
				eventType: '',
				checkoutOrderId: ''
			}
		}
	]

	runCases(cases, async (given) => {
		const client: CreemClient = createMockClient()
		const provider = new CreemPaymentProvider(client, 'whsec')

		try {
			const event = await provider.unwrapWebhook({
				rawBody: given.rawBody,
				headers: new Headers({
					'creem-signature': given.signature
				})
			})

			return {
				errorCode: '',
				eventType: event.type,
				checkoutOrderId: event.checkoutOrderId ?? ''
			}
		} catch (error) {
			return {
				errorCode: error instanceof Error ? error.message : 'UNKNOWN',
				eventType: '',
				checkoutOrderId: ''
			}
		}
	})
})

describe('createCreemPaymentProviderFromEnv', () => {
	type GivenDetail = {
		testMode: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		serverIdx: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'use test server in test mode',
			given: 'PAYMENT_CREEM_TEST_MODE=true',
			when: 'creating creem provider',
			then: 'uses test server index',
			givenDetail: {
				testMode: 'true'
			},
			whenDetail: {},
			thenExpected: {
				serverIdx: 1
			}
		}
	]

	runCases(cases, async (given) => {
		let serverIdx: number = -1
		createCreemPaymentProviderFromEnv(
			{
				PAYMENT_CREEM_API_KEY: 'api-key',
				PAYMENT_CREEM_WEBHOOK_SECRET: 'whsec',
				PAYMENT_CREEM_TEST_MODE: given.testMode
			} as unknown as Env,
			(options: CreemClientOptions): CreemClient => {
				serverIdx = options.serverIdx
				return createMockClient()
			}
		)

		return {
			serverIdx
		}
	})
})

function createMockClient(): CreemClient {
	return {
		products: {
			get: vi.fn()
		},
		checkouts: {
			create: vi.fn()
		},
		subscriptions: {
			upgrade: vi.fn(),
			cancel: vi.fn()
		}
	}
}

function createCreemProduct(
	id: string,
	billingType: 'recurring' | 'onetime',
	price: number
): unknown {
	return {
		id,
		name: id,
		description: '',
		price,
		currency: 'USD',
		billingType
	}
}

function signBody(rawBody: string, secret: string): string {
	return createHmac('sha256', secret).update(rawBody).digest('hex')
}
