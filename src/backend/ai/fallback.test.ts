import { describe } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import { resolveAIEndpoints, runWithAIFallback, type AIEndpoint } from './fallback'

describe('resolveAIEndpoints', () => {
	type GivenDetail = {
		fallbackBaseURL: string
		fallbackApiKey: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		endpointCount: number
		secondBaseURL: string
		errorMessage: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'fallback is disabled',
			given: 'empty fallback base url and api key',
			when: 'resolving endpoints',
			then: 'returns primary endpoint only',
			givenDetail: {
				fallbackBaseURL: '',
				fallbackApiKey: ''
			},
			whenDetail: {},
			thenExpected: {
				endpointCount: 1,
				secondBaseURL: '',
				errorMessage: ''
			}
		},
		{
			scenario: 'fallback is enabled',
			given: 'fallback base url and api key',
			when: 'resolving endpoints',
			then: 'returns primary and fallback endpoints',
			givenDetail: {
				fallbackBaseURL: 'https://fallback',
				fallbackApiKey: 'fallback-key'
			},
			whenDetail: {},
			thenExpected: {
				endpointCount: 2,
				secondBaseURL: 'https://fallback',
				errorMessage: ''
			}
		},
		{
			scenario: 'fallback config is incomplete',
			given: 'fallback base url without api key',
			when: 'resolving endpoints',
			then: 'throws incomplete config error',
			givenDetail: {
				fallbackBaseURL: 'https://fallback',
				fallbackApiKey: ''
			},
			whenDetail: {},
			thenExpected: {
				endpointCount: 0,
				secondBaseURL: '',
				errorMessage: 'AI fallback config is incomplete'
			}
		}
	]

	runCases(cases, (given: GivenDetail): ThenExpected => {
		try {
			const endpoints: AIEndpoint[] = resolveAIEndpoints('https://primary', 'primary-key', given.fallbackBaseURL, given.fallbackApiKey)
			return {
				endpointCount: endpoints.length,
				secondBaseURL: endpoints[1]?.baseURL ?? '',
				errorMessage: ''
			}
		} catch (error) {
			return {
				endpointCount: 0,
				secondBaseURL: '',
				errorMessage: error instanceof Error ? error.message : ''
			}
		}
	})
})

describe('runWithAIFallback', () => {
	type GivenDetail = Record<string, never>
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		result: string
		firstBaseURL: string
		secondBaseURL: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'primary failure uses fallback',
			given: 'two endpoints',
			when: 'primary request fails',
			then: 'returns fallback result',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				result: 'fallback-ok',
				firstBaseURL: 'https://primary',
				secondBaseURL: 'https://fallback'
			}
		}
	]

	runCases(cases, async (): Promise<ThenExpected> => {
		const calls: string[] = []
		const result: string = await runWithAIFallback(
			[
				{ baseURL: 'https://primary', apiKey: 'primary-key' },
				{ baseURL: 'https://fallback', apiKey: 'fallback-key' }
			],
			async (endpoint: AIEndpoint): Promise<string> => {
				calls.push(endpoint.baseURL)
				if (endpoint.baseURL === 'https://primary') {
					throw new Error('PRIMARY_FAILED')
				}
				return 'fallback-ok'
			}
		)
		return {
			result,
			firstBaseURL: calls[0] ?? '',
			secondBaseURL: calls[1] ?? ''
		}
	})
})
