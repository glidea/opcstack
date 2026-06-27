import { describe } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import {
	parsePaymentConfig,
	PaymentConfigError,
	PaymentProviderRouter,
	type PaymentProviderName
} from './config'

describe('parsePaymentConfig', () => {
	type GivenDetail = {
		paymentEnabled: string
		provider: string
		overrides: string
		products: string
	}
	type WhenDetail = {
		country: string | null
	}
	type ThenExpected = {
		errorCode: string
		paymentEnabled: boolean
		selectedProvider: PaymentProviderName | ''
		providerCount: number
		firstCreditsAmount: number
		firstDodoKind: string
	}

	const remoteProducts = JSON.stringify([
		{
			product_id: 'p1',
			type: 'one_time',
			credits_amount: '1.23',
			providers: {
				creem: {
					kind: 'remote_product',
					product_id: 'prod_1'
				}
			}
		}
	])
	const mixedProducts = JSON.stringify([
		{
			product_id: 'p1',
			type: 'one_time',
			credits_amount: '1.23',
			providers: {
				dodo: {
					kind: 'inline_product',
					name: '100 Credits',
					description: '',
					amount: 990,
					currency: 'cny',
					pay_type: 'native'
				},
				creem: {
					kind: 'remote_product',
					product_id: 'prod_1'
				}
			}
		}
	])

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'select configured provider when country is missing',
			given: 'PAYMENT_PROVIDER is creem',
			when: 'router selects provider',
			then: 'returns configured provider',
			givenDetail: {
				paymentEnabled: 'true',
				provider: 'creem',
				overrides: '[{"country":"CN","provider":"dodo"}]',
				products: mixedProducts
			},
			whenDetail: {
				country: null
			},
			thenExpected: {
				errorCode: '',
				paymentEnabled: true,
				selectedProvider: 'creem',
				providerCount: 2,
				firstCreditsAmount: 1_230_000,
				firstDodoKind: 'inline_product'
			}
		},
		{
			scenario: 'select country override provider',
			given: 'CN override is dodo',
			when: 'router selects with country CN',
			then: 'returns dodo',
			givenDetail: {
				paymentEnabled: 'true',
				provider: 'creem',
				overrides: '[{"country":"CN","provider":"dodo"}]',
				products: mixedProducts
			},
			whenDetail: {
				country: 'CN'
			},
			thenExpected: {
				errorCode: '',
				paymentEnabled: true,
				selectedProvider: 'dodo',
				providerCount: 2,
				firstCreditsAmount: 1_230_000,
				firstDodoKind: 'inline_product'
			}
		},
		{
			scenario: 'allow disabled payment without products',
			given: 'PAYMENT_ENABLED is false and products are empty',
			when: 'config is parsed',
			then: 'payment disabled config is valid',
			givenDetail: {
				paymentEnabled: 'false',
				provider: 'creem',
				overrides: '[{"country":"CN","provider":"dodo"}]',
				products: '[]'
			},
			whenDetail: {
				country: null
			},
			thenExpected: {
				errorCode: '',
				paymentEnabled: false,
				selectedProvider: 'creem',
				providerCount: 0,
				firstCreditsAmount: 0,
				firstDodoKind: ''
			}
		},
		{
			scenario: 'reject provider not present in product providers',
			given: 'PAYMENT_PROVIDER is dodo but products only contain creem',
			when: 'config is parsed',
			then: 'returns provider invalid error',
			givenDetail: {
				paymentEnabled: 'true',
				provider: 'dodo',
				overrides: '[]',
				products: remoteProducts
			},
			whenDetail: {
				country: null
			},
			thenExpected: {
				errorCode: 'PAYMENT_PROVIDER_INVALID',
				paymentEnabled: false,
				selectedProvider: '',
				providerCount: 0,
				firstCreditsAmount: 0,
				firstDodoKind: ''
			}
		},
		{
			scenario: 'reject override provider not present in product providers',
			given: 'CN override is dodo but products only contain creem',
			when: 'config is parsed',
			then: 'returns country override invalid error',
			givenDetail: {
				paymentEnabled: 'true',
				provider: 'creem',
				overrides: '[{"country":"CN","provider":"dodo"}]',
				products: remoteProducts
			},
			whenDetail: {
				country: null
			},
			thenExpected: {
				errorCode: 'PAYMENT_PROVIDER_COUNTRY_OVERRIDES_INVALID',
				paymentEnabled: false,
				selectedProvider: '',
				providerCount: 0,
				firstCreditsAmount: 0,
				firstDodoKind: ''
			}
		},
		{
			scenario: 'reject unknown product provider',
			given: 'PAYMENT_PRODUCTS contains unknown provider',
			when: 'config is parsed',
			then: 'returns provider invalid error',
			givenDetail: {
				paymentEnabled: 'true',
				provider: 'creem',
				overrides: '[]',
				products:
					'[{"product_id":"p1","type":"one_time","providers":{"bad":{"kind":"remote_product","product_id":"prod_1"}}}]'
			},
			whenDetail: {
				country: null
			},
			thenExpected: {
				errorCode: 'PAYMENT_PROVIDER_INVALID',
				paymentEnabled: false,
				selectedProvider: '',
				providerCount: 0,
				firstCreditsAmount: 0,
				firstDodoKind: ''
			}
		}
	]

	runCases(cases, async (given, when) => {
		try {
			const config = parsePaymentConfig({
				PAYMENT_ENABLED: given.paymentEnabled,
				PAYMENT_PROVIDER: given.provider,
				PAYMENT_PROVIDER_COUNTRY_OVERRIDES: given.overrides,
				PAYMENT_PRODUCTS: given.products
			} as unknown as Env)
			const router = new PaymentProviderRouter({
				defaultProvider: config.defaultProvider,
				providerCountryOverrides: config.providerCountryOverrides
			})
			return {
				errorCode: '',
				paymentEnabled: config.enabled,
				selectedProvider: router.select({
					country: when.country
				}),
				providerCount: config.providers.length,
				firstCreditsAmount: config.products[0]?.creditsAmount ?? 0,
				firstDodoKind: config.products[0]?.providers.dodo?.kind ?? ''
			}
		} catch (error) {
			return {
				errorCode: error instanceof PaymentConfigError ? error.code : 'UNKNOWN',
				paymentEnabled: false,
				selectedProvider: '',
				providerCount: 0,
				firstCreditsAmount: 0,
				firstDodoKind: ''
			}
		}
	})
})
