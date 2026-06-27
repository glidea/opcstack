import { describe } from 'vitest'
import { runCases, type TestCase } from '../../../backend/testing/bdd'
import { createApiClient } from './index'

describe('api client', () => {
	type GivenDetail = {
		token: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		url: string
		authorization: string
		body: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'send json request with bearer token',
			given: 'an api client with token',
			when: 'requesting json',
			then: 'sends request to base url with authorization',
			givenDetail: {
				token: 'session-token'
			},
			whenDetail: {},
			thenExpected: {
				url: 'https://app.example.com/api/test',
				authorization: 'Bearer session-token',
				body: '{"ok":true}'
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		let request: Request | undefined
		const fetchApi = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			request = new Request(input, init)
			return Response.json({ ok: true })
		}
		const client = createApiClient({
			baseUrl: 'https://app.example.com',
			fetchApi,
			getToken: () => given.token
		})

		await client.requestJson<{ ok: boolean }>({
			path: '/api/test',
			body: { ok: true }
		})

		if (request === undefined) {
			throw new Error('REQUEST_MISSING')
		}

		return {
			url: request.url,
			authorization: request.headers.get('authorization') ?? '',
			body: await request.text()
		}
	})
})
