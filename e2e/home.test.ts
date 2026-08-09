import { describe } from 'vitest'
import { runCases, type TestCase } from '../src/backend/testing/bdd'

type E2EEnv = {
	APP_BASE_URL?: string
}

type Given = {
	locale: 'en' | 'zh'
}

type When = Record<string, never>

type Then = {
	status: number
	hasProductName: boolean
	hasPositioning: boolean
	hasArchitectureProof: boolean
	hasDeploymentObject: boolean
	hasRejectedTables: boolean
	hasPricingSource: boolean
	hasQuickStart: boolean
}

const e2eEnv =
	(globalThis as unknown as { process?: { env?: E2EEnv } }).process?.env ?? {}
const appBaseUrl: string = e2eEnv.APP_BASE_URL ?? 'http://localhost:5173'

describe('landing page e2e', () => {
	const cases: TestCase<Given, When, Then>[] = [
		{
			scenario: 'show production foundation positioning in Chinese',
			given: 'a Chinese visitor opens the landing page',
			when: 'the page renders',
			then: 'the product, architecture proof, pricing source and quick start are visible',
			givenDetail: {
				locale: 'zh'
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				hasProductName: true,
				hasPositioning: true,
				hasArchitectureProof: true,
				hasDeploymentObject: true,
				hasRejectedTables: false,
				hasPricingSource: true,
				hasQuickStart: true
			}
		},
		{
			scenario: 'show production foundation positioning in English',
			given: 'an English visitor opens the landing page',
			when: 'the page renders',
			then: 'the product, architecture proof, pricing source and quick start are visible',
			givenDetail: {
				locale: 'en'
			},
			whenDetail: {},
			thenExpected: {
				status: 200,
				hasProductName: true,
				hasPositioning: true,
				hasArchitectureProof: true,
				hasDeploymentObject: true,
				hasRejectedTables: false,
				hasPricingSource: true,
				hasQuickStart: true
			}
		}
	]

	runCases(cases, async (given): Promise<Then> => {
		const response: Response = await fetch(`${appBaseUrl}/${given.locale}`)
		const html: string = await response.text()
		const positioning: string =
			given.locale === 'zh'
				? '让 OPC 的产品开发更快，部署运维成本更低'
				: 'Build OPC products faster, at lower cost, and ready for production'

		return {
			status: response.status,
			hasProductName: html.includes('OPCStack'),
			hasPositioning: html.includes(positioning),
			hasArchitectureProof:
				html.includes('META_DB') && html.includes('D1 Shards'),
			hasDeploymentObject: html.includes('deployment-scene'),
			hasRejectedTables:
				html.includes('pricing-table') || html.includes('comparison-table'),
			hasPricingSource: html.includes(
				'https://developers.cloudflare.com/workers/platform/pricing/'
			),
			hasQuickStart: html.includes('QUICK_START.md')
		}
	})
})
