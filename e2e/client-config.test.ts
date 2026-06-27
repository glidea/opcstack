import { beforeAll, describe } from 'vitest'
import { runCases, type TestCase } from '../src/backend/testing/bdd'

type E2EEnv = {
	APP_BASE_URL?: string
}

const e2eEnv =
	(globalThis as unknown as { process?: { env?: E2EEnv } }).process?.env ?? {}
const appBaseUrl: string = e2eEnv.APP_BASE_URL ?? 'http://localhost:5173'

describe('client config e2e', () => {
	beforeAll(async () => {
		const res: Response = await fetch(`${appBaseUrl}/api/health`)
		if (res.status !== 200) {
			throw new Error('dev server is not ready for e2e tests')
		}
	})

	type Given = Record<string, never>
	type When = Record<string, never>
	type Then = {
		status: number
	}

	const cases: TestCase<Given, When, Then>[] = [
		{
			scenario: 'public config api is not public',
			given: 'client config is generated at build time',
			when: 'calling /api/get_public_config',
			then: 'does not return runtime public config',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				status: 401
			}
		}
	]

	runCases(cases, async () => {
		const res: Response = await fetch(`${appBaseUrl}/api/get_public_config`, {
			method: 'POST'
		})
		return {
			status: res.status
		}
	})
})
