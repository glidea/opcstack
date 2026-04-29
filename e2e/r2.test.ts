import { beforeAll, describe } from 'vitest'
import { runCases, type TestCase } from '../src/testing/bdd'

type E2EEnv = {
	APP_BASE_URL?: string
	E2E_R2_ENABLED?: string
}

const e2eEnv =
	(globalThis as unknown as { process?: { env?: E2EEnv } }).process?.env ?? {}
const appBaseUrl: string = e2eEnv.APP_BASE_URL ?? 'http://localhost:5173'
const r2Enabled: boolean = e2eEnv.E2E_R2_ENABLED === 'true'

describe('r2 api e2e', () => {
	beforeAll(async () => {
		const res = await fetch(`${appBaseUrl}/api/health`)
		if (res.status !== 200) {
			throw new Error('dev server is not ready for e2e tests')
		}
	})

	type GivenDetail = Record<string, never>
	type WhenDetail = {
		action:
			| 'read_public_missing'
			| 'read_public_missing_with_basic_auth'
			| 'read_private_without_auth'
			| 'read_private_with_non_bearer_auth'
			| 'read_invalid_prefix'
			| 'post_public_path_not_allowed'
	}
	type ThenExpected = {
		status: number
		code: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'reads public path without authentication',
			given: 'a public r2 path',
			when: 'requesting a missing key',
			then: 'returns not found when r2 enabled otherwise internal error',
			givenDetail: {},
			whenDetail: {
				action: 'read_public_missing'
			},
			thenExpected: {
				status: r2Enabled ? 404 : 500,
				code: ''
			}
		},
		{
			scenario: 'keeps public path as public even when auth header is non bearer',
			given: 'a public r2 path and a basic auth header',
			when: 'requesting a missing key',
			then: 'returns same public status without unauthorized error',
			givenDetail: {},
			whenDetail: {
				action: 'read_public_missing_with_basic_auth'
			},
			thenExpected: {
				status: r2Enabled ? 404 : 500,
				code: ''
			}
		},
		{
			scenario: 'rejects private path without authentication',
			given: 'a private r2 path and no bearer token',
			when: 'requesting any private key',
			then: 'returns unauthorized from auth middleware',
			givenDetail: {},
			whenDetail: {
				action: 'read_private_without_auth'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED'
			}
		},
		{
			scenario: 'rejects private path with non bearer authorization',
			given: 'a private r2 path and a basic auth header',
			when: 'requesting any private key',
			then: 'returns unauthorized from auth middleware',
			givenDetail: {},
			whenDetail: {
				action: 'read_private_with_non_bearer_auth'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED'
			}
		},
		{
			scenario: 'rejects invalid r2 key prefix without bearer token',
			given: 'an r2 route path without public or private prefix',
			when: 'requesting the path',
			then: 'returns not found because only public and private prefixes exist',
			givenDetail: {},
			whenDetail: {
				action: 'read_invalid_prefix'
			},
			thenExpected: {
				status: 404,
				code: ''
			}
		},
		{
			scenario: 'rejects post method on public read route',
			given: 'a public r2 read path',
			when: 'posting to the read endpoint',
			then: 'returns not found because only get route exists',
			givenDetail: {},
			whenDetail: {
				action: 'post_public_path_not_allowed'
			},
			thenExpected: {
				status: 404,
				code: ''
			}
		}
	]

	runCases(cases, async (_given, when) => {
		if (when.action === 'read_public_missing') {
			const res = await fetch(`${appBaseUrl}/api/r2/public/e2e/missing.txt`)
			return {
				status: res.status,
				code: ''
			}
		}

		if (when.action === 'read_public_missing_with_basic_auth') {
			const res = await fetch(`${appBaseUrl}/api/r2/public/e2e/missing.txt`, {
				method: 'GET',
				headers: {
					authorization: 'Basic test'
				}
			})
			return {
				status: res.status,
				code: ''
			}
		}

		if (when.action === 'read_private_without_auth') {
			const res = await fetch(`${appBaseUrl}/api/r2/private/u1/e2e.txt`)
			const payload = (await res.json()) as { code: string }
			return {
				status: res.status,
				code: payload.code
			}
		}

		if (when.action === 'read_private_with_non_bearer_auth') {
			const privateRes = await fetch(`${appBaseUrl}/api/r2/private/u1/e2e.txt`, {
				method: 'GET',
				headers: {
					authorization: 'Basic test'
				}
			})
			const payload = (await privateRes.json()) as { code: string }
			return {
				status: privateRes.status,
				code: payload.code
			}
		}

		if (when.action === 'read_invalid_prefix') {
			const invalidRes = await fetch(`${appBaseUrl}/api/r2/e2e/missing.txt`)
			return {
				status: invalidRes.status,
				code: ''
			}
		}

		const postRes = await fetch(`${appBaseUrl}/api/r2/public/e2e/missing.txt`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({})
		})
		return {
			status: postRes.status,
			code: ''
		}
	})
})
