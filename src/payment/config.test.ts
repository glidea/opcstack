import { describe, expect } from 'vitest'
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
		providers: string
		defaultProvider: string
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
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'select default provider when country is missing',
			given: 'default provider is creem and no country exists',
			when: 'router selects provider',
			then: 'returns default provider',
			givenDetail: {
				paymentEnabled: 'true',
				providers: 'dodo;creem',
				defaultProvider: 'creem',
				overrides: '[{"country":"CN","provider":"dodo"}]',
				products: '[]'
			},
			whenDetail: {
				country: null
			},
			thenExpected: {
				errorCode: '',
				paymentEnabled: true,
				selectedProvider: 'creem'
			}
		},
		{
			scenario: 'select country override provider',
			given: 'CN override is dodo',
			when: 'router selects with country CN',
			then: 'returns dodo',
			givenDetail: {
				paymentEnabled: 'true',
				providers: 'dodo;creem',
				defaultProvider: 'creem',
				overrides: '[{"country":"CN","provider":"dodo"}]',
				products: '[]'
			},
			whenDetail: {
				country: 'CN'
			},
			thenExpected: {
				errorCode: '',
				paymentEnabled: true,
				selectedProvider: 'dodo'
			}
		},
		{
			scenario: 'parse payment enabled false',
			given: 'PAYMENT_ENABLED is false',
			when: 'config is parsed',
			then: 'payment enabled becomes false',
			givenDetail: {
				paymentEnabled: 'false',
				providers: 'dodo;creem',
				defaultProvider: 'creem',
				overrides: '[]',
				products: '[]'
			},
			whenDetail: {
				country: null
			},
			thenExpected: {
				errorCode: '',
				paymentEnabled: false,
				selectedProvider: 'creem'
			}
		}
	]

	runCases(cases, async (given, when) => {
		try {
			const config = parsePaymentConfig({
				PAYMENT_ENABLED: given.paymentEnabled,
				PAYMENT_PROVIDERS: given.providers,
				PAYMENT_DEFAULT_PROVIDER: given.defaultProvider,
				PAYMENT_PROVIDER_COUNTRY_OVERRIDES: given.overrides,
				PAYMENT_PRODUCTS: given.products
			})
			const router = new PaymentProviderRouter({
				defaultProvider: config.defaultProvider,
				providerCountryOverrides: config.providerCountryOverrides
			})
			return {
				errorCode: '',
				paymentEnabled: config.enabled,
				selectedProvider: router.select({
					country: when.country
				})
			}
		} catch (error) {
			return {
				errorCode: error instanceof PaymentConfigError ? error.code : 'UNKNOWN',
				paymentEnabled: false,
				selectedProvider: ''
			}
		}
	})
})
