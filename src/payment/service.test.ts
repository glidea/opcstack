import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import { PaymentProviderRouter, type PaymentConfig } from './config'
import { PaymentService, PaymentServiceError, type PaymentProviderMap } from './service'
import type { PaymentEvent, PaymentProvider } from './provider'
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
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		status: string
		checkoutOrderCount: number
		checkoutUrl: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'create pending checkout order and return checkout url',
			given: 'valid user and product input',
			when: 'creating payment checkout',
			then: 'stores pending order and returns provider url',
			givenDetail: {
				returnPath: '/settings/billing'
			},
			whenDetail: {},
			thenExpected: {
				status: 'pending',
				checkoutOrderCount: 1,
				checkoutUrl: 'https://pay.example.com/cs_1'
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
			appDomain: 'example.com'
		})
		return {
			status: state.checkoutOrders[0]?.status ?? '',
			checkoutOrderCount: state.checkoutOrders.length,
			checkoutUrl: result.checkoutUrl
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
		eventType: 'payment_succeeded' | 'subscription_paid' | 'refund_succeeded' | 'dispute_opened'
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		transactions: number
		checkoutStatus: string
		subscriptionPlan: string
		refundStatus: string
		disputeStatus: string
		webhookEvents: number
		grantCalls: number
		deductCalls: number
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
				refundStatus: '',
				disputeStatus: '',
				webhookEvents: 1,
				grantCalls: 1,
				deductCalls: 0
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
				refundStatus: '',
				disputeStatus: '',
				webhookEvents: 1,
				grantCalls: 1,
				deductCalls: 0
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
				refundStatus: 'refunded',
				disputeStatus: '',
				webhookEvents: 1,
				grantCalls: 0,
				deductCalls: 1
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
				refundStatus: '',
				disputeStatus: 'disputed',
				webhookEvents: 1,
				grantCalls: 0,
				deductCalls: 0
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
				providerPaymentId: null
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
			state.queryQueue.paymentTransaction.push(undefined, state.paymentTransactions[0])
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
			state.queryQueue.paymentTransaction.push(undefined, state.paymentTransactions[0])
			event = createDisputeEvent()
		}

		state.provider.unwrapWebhook.mockResolvedValue(event)
		await service.processWebhook('dodo', '{}', new Headers())

		return {
			transactions: state.paymentTransactions.length,
			checkoutStatus: state.checkoutOrders[0]?.status ?? '',
			subscriptionPlan: state.userSubscriptions[0]?.subscriptionPlan ?? '',
			refundStatus: state.paymentTransactions[0]?.status === 'refunded' ? 'refunded' : '',
			disputeStatus: state.paymentTransactions[0]?.status === 'disputed' ? 'disputed' : '',
			webhookEvents: state.webhookEvents.length,
			grantCalls: vi.mocked(creditServiceMocks.grant).mock.calls.length,
			deductCalls: vi.mocked(creditServiceMocks.deduct).mock.calls.length
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

	return new PaymentService(createMockDb(state), config, providerRouter, providers)
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
						return Promise.resolve()
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
		eventType: 'payment_succeeded' as const,
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

function createSubscriptionPaidEvent() {
	return {
		provider: 'dodo' as const,
		webhookId: 'evt_sub_1',
		eventType: 'subscription_paid' as const,
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
		eventType: 'refund_succeeded' as const,
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
		eventType: 'dispute_opened' as const,
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
