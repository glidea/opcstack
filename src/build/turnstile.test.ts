import { describe } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import {
	resolveTurnstileConfig,
	selectTurnstileWidget,
	TURNSTILE_TEST_SECRET_KEY,
	TURNSTILE_TEST_SITE_KEY,
	type TurnstileWidget
} from './turnstile.mjs'

describe('resolveTurnstileConfig', () => {
	type GivenDetail = {
		enabled: string
		isRemote: boolean
		widget?: TurnstileWidget
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		enabled: string
		siteKey: string
		secretKey: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'disable turnstile when switch is off',
			given: 'local mode and disabled switch',
			when: 'resolving turnstile config',
			then: 'returns disabled empty keys',
			givenDetail: {
				enabled: 'false',
				isRemote: false
			},
			whenDetail: {},
			thenExpected: {
				enabled: 'false',
				siteKey: '',
				secretKey: ''
			}
		},
		{
			scenario: 'use official test keys locally',
			given: 'local mode and enabled switch',
			when: 'resolving turnstile config',
			then: 'returns official test keys',
			givenDetail: {
				enabled: 'true',
				isRemote: false
			},
			whenDetail: {},
			thenExpected: {
				enabled: 'true',
				siteKey: TURNSTILE_TEST_SITE_KEY,
				secretKey: TURNSTILE_TEST_SECRET_KEY
			}
		},
		{
			scenario: 'use remote widget keys',
			given: 'remote mode and created widget',
			when: 'resolving turnstile config',
			then: 'returns remote keys',
			givenDetail: {
				enabled: 'true',
				isRemote: true,
				widget: {
					name: 'opcstack',
					sitekey: 'site-key',
					secret: 'secret-key'
				}
			},
			whenDetail: {},
			thenExpected: {
				enabled: 'true',
				siteKey: 'site-key',
				secretKey: 'secret-key'
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		const result = resolveTurnstileConfig({
			enabled: given.enabled,
			isRemote: given.isRemote,
			widget: given.widget
		})

		return {
			enabled: result.enabled,
			siteKey: result.siteKey,
			secretKey: result.secretKey
		}
	})
})

describe('selectTurnstileWidget', () => {
	type GivenDetail = {
		appName: string
		widgets: TurnstileWidget[]
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		error: string
		siteKey: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'select matching widget',
			given: 'one widget uses app name',
			when: 'selecting widget',
			then: 'returns that widget',
			givenDetail: {
				appName: 'opcstack',
				widgets: [
					{ name: 'other', sitekey: 'other-key', secret: 'other-secret' },
					{ name: 'opcstack', sitekey: 'site-key', secret: 'secret-key' }
				]
			},
			whenDetail: {},
			thenExpected: {
				error: '',
				siteKey: 'site-key'
			}
		},
		{
			scenario: 'return empty when widget does not exist',
			given: 'no widget uses app name',
			when: 'selecting widget',
			then: 'returns empty widget',
			givenDetail: {
				appName: 'opcstack',
				widgets: [{ name: 'other', sitekey: 'other-key', secret: 'other-secret' }]
			},
			whenDetail: {},
			thenExpected: {
				error: '',
				siteKey: ''
			}
		},
		{
			scenario: 'reject duplicate widgets',
			given: 'two widgets use app name',
			when: 'selecting widget',
			then: 'returns duplicate error',
			givenDetail: {
				appName: 'opcstack',
				widgets: [
					{ name: 'opcstack', sitekey: 'site-key-1', secret: 'secret-key-1' },
					{ name: 'opcstack', sitekey: 'site-key-2', secret: 'secret-key-2' }
				]
			},
			whenDetail: {},
			thenExpected: {
				error: 'TURNSTILE_WIDGET_DUPLICATED',
				siteKey: ''
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		try {
			const widget = selectTurnstileWidget(given.widgets, given.appName)
			return {
				error: '',
				siteKey: widget?.sitekey ?? ''
			}
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : '',
				siteKey: ''
			}
		}
	})
})
