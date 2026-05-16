import { describe } from 'vitest'
import type { PublicConfig } from '$web/config/client'
import { runCases, type TestCase } from '../../testing/bdd'
import { load } from './+layout.server'

type GivenDetail = {
	locale?: string
	pathname: string
	publicConfig: PublicConfig
}

type WhenDetail = Record<string, never>

type ThenExpected = {
	locale: string
	canonicalUrl: string
	xDefaultUrl: string
	alternateUrls: Array<{ locale: string; url: string }>
	publicConfig: PublicConfig
	fetchCalls: Array<{ input: string; method: string }>
}

describe('layout server load', () => {
	const publicConfig: PublicConfig = {
		beta_code_enabled: false,
		google_auth_enabled: false,
		email_enabled: true,
		email_signup_enabled: true,
		email_require_verification: true,
		email_user_action_cooldown_seconds: 50,
		credits_signup_enabled: true,
		credits_signup_amount: '100',
		credits_daily_checkin_enabled: true,
		credits_daily_checkin_amount: '10',
		credits_referral_enabled: true,
		payment_enabled: false
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'load public config for localized page',
			given: 'zh locale page',
			when: 'loading layout data',
			then: 'returns public config and localized seo urls',
			givenDetail: {
				locale: 'zh',
				pathname: '/zh/docs',
				publicConfig
			},
			whenDetail: {},
			thenExpected: {
				locale: 'zh',
				canonicalUrl: 'http://localhost:5173/zh/docs',
				xDefaultUrl: 'http://localhost:5173/en/docs',
				alternateUrls: [
					{ locale: 'en', url: 'http://localhost:5173/en/docs' },
					{ locale: 'zh', url: 'http://localhost:5173/zh/docs' }
				],
				publicConfig,
				fetchCalls: [{ input: '/api/get_public_config', method: 'POST' }]
			}
		},
		{
			scenario: 'fallback locale when route locale is missing',
			given: 'page without locale param',
			when: 'loading layout data',
			then: 'uses default locale',
			givenDetail: {
				pathname: '/login',
				publicConfig
			},
			whenDetail: {},
			thenExpected: {
				locale: 'en',
				canonicalUrl: 'http://localhost:5173/login',
				xDefaultUrl: 'http://localhost:5173/en',
				alternateUrls: [
					{ locale: 'en', url: 'http://localhost:5173/en' },
					{ locale: 'zh', url: 'http://localhost:5173/zh' }
				],
				publicConfig,
				fetchCalls: [{ input: '/api/get_public_config', method: 'POST' }]
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		const fetchCalls: Array<{ input: string; method: string }> = []
		const fetchApi = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			fetchCalls.push({
				input: String(input),
				method: init?.method ?? 'GET'
			})
			return Response.json(given.publicConfig)
		}

		const result = await load({
			params: { locale: given.locale },
			url: new URL(given.pathname, 'http://localhost:5173'),
			fetch: fetchApi
		})

		return {
			locale: result.locale,
			canonicalUrl: result.canonicalUrl,
			xDefaultUrl: result.xDefaultUrl,
			alternateUrls: result.alternateUrls,
			publicConfig: result.publicConfig,
			fetchCalls
		}
	})
})
