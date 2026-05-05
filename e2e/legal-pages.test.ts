import { beforeAll, describe } from 'vitest'
import { runCases, type TestCase } from '../src/testing/bdd'

type E2EEnv = {
	APP_BASE_URL?: string
}

const e2eEnv =
	(globalThis as unknown as { process?: { env?: E2EEnv } }).process?.env ?? {}
const appBaseUrl: string = e2eEnv.APP_BASE_URL ?? 'http://localhost:5173'

describe('legal pages e2e', () => {
	beforeAll(async () => {
		const res = await fetch(`${appBaseUrl}/api/health`)
		if (res.status !== 200) {
			throw new Error('dev server is not ready for e2e tests')
		}
	})

	type GivenDetail = Record<string, never>
	type WhenDetail = {
		action: 'terms' | 'privacy' | 'refund_policy' | 'footer_links'
	}
	type ThenExpected = {
		status: number
		hasExpectedText: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'terms page is accessible',
			given: 'public route exists',
			when: 'requesting /terms',
			then: 'returns terms content',
			givenDetail: {},
			whenDetail: {
				action: 'terms'
			},
			thenExpected: {
				status: 200,
				hasExpectedText: true
			}
		},
		{
			scenario: 'privacy page is accessible',
			given: 'public route exists',
			when: 'requesting /privacy',
			then: 'returns privacy content',
			givenDetail: {},
			whenDetail: {
				action: 'privacy'
			},
			thenExpected: {
				status: 200,
				hasExpectedText: true
			}
		},
		{
			scenario: 'refund policy page is accessible',
			given: 'public route exists',
			when: 'requesting /refund-policy',
			then: 'returns refund policy content',
			givenDetail: {},
			whenDetail: {
				action: 'refund_policy'
			},
			thenExpected: {
				status: 200,
				hasExpectedText: true
			}
		},
		{
			scenario: 'footer contains legal page links',
			given: 'localized home page renders footer',
			when: 'requesting /en',
			then: 'contains links to legal pages',
			givenDetail: {},
			whenDetail: {
				action: 'footer_links'
			},
			thenExpected: {
				status: 200,
				hasExpectedText: true
			}
		}
	]

	runCases(cases, async (_given, when) => {
		if (when.action === 'terms') {
			const res = await fetch(`${appBaseUrl}/terms`)
			const html = await res.text()
			return {
				status: res.status,
				hasExpectedText: html.includes('Terms of Service')
			}
		}

		if (when.action === 'privacy') {
			const res = await fetch(`${appBaseUrl}/privacy`)
			const html = await res.text()
			return {
				status: res.status,
				hasExpectedText: html.includes('Privacy Policy')
			}
		}

		if (when.action === 'refund_policy') {
			const res = await fetch(`${appBaseUrl}/refund-policy`)
			const html = await res.text()
			return {
				status: res.status,
				hasExpectedText: html.includes('Refund Policy')
			}
		}

		const res = await fetch(`${appBaseUrl}/en`)
		const html = await res.text()
		return {
			status: res.status,
			hasExpectedText:
				html.includes('href="/terms"') &&
				html.includes('href="/privacy"') &&
				html.includes('href="/refund-policy"')
		}
	})
})
