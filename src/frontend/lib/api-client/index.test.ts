import { afterEach, beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../../backend/testing/bdd'
import { AUTH_TOKEN_STORAGE_KEY, client, createClient } from './index'

class MemoryStorage implements Storage {
	private readonly values: Map<string, string> = new Map<string, string>()

	get length(): number {
		return this.values.size
	}

	clear(): void {
		this.values.clear()
	}

	getItem(key: string): string | null {
		return this.values.get(key) ?? null
	}

	key(index: number): string | null {
		return Array.from(this.values.keys())[index] ?? null
	}

	removeItem(key: string): void {
		this.values.delete(key)
	}

	setItem(key: string, value: string): void {
		this.values.set(key, value)
	}
}

describe('api client', () => {
	type RequestGivenDetail = {
		token: string
	}
	type RequestWhenDetail = Record<string, never>
	type RequestThenExpected = {
		url: string
		authorization: string
		body: string
	}

	const requestCases: TestCase<RequestGivenDetail, RequestWhenDetail, RequestThenExpected>[] = [
		{
			scenario: 'send json request with bearer token',
			given: 'a client with token',
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

	type PublicGivenDetail = Record<string, never>
	type PublicWhenDetail = Record<string, never>
	type PublicThenExpected = {
		authorization: string
	}

	const publicCases: TestCase<PublicGivenDetail, PublicWhenDetail, PublicThenExpected>[] = [
		{
			scenario: 'send public json request',
			given: 'a client without token reader',
			when: 'requesting public api',
			then: 'does not send authorization',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				authorization: ''
			}
		}
	]

	type DefaultClientGivenDetail = Record<string, never>
	type DefaultClientWhenDetail = Record<string, never>
	type DefaultClientThenExpected = {
		hasAuth: boolean
		hasApi: boolean
	}

	const defaultClientCases: TestCase<
		DefaultClientGivenDetail,
		DefaultClientWhenDetail,
		DefaultClientThenExpected
	>[] = [
		{
			scenario: 'use default client',
			given: 'browser runtime',
			when: 'importing client',
			then: 'returns auth and api clients',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				hasAuth: true,
				hasApi: true
			}
		}
	]

	type ExportGivenDetail = Record<string, never>
	type ExportWhenDetail = Record<string, never>
	type ExportThenExpected = {
		exports: string[]
	}

	const exportCases: TestCase<ExportGivenDetail, ExportWhenDetail, ExportThenExpected>[] = [
		{
			scenario: 'hide internal factories',
			given: 'api client module',
			when: 'reading exports',
			then: 'only exposes public client api',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				exports: ['AUTH_TOKEN_STORAGE_KEY', 'client', 'createClient']
			}
		}
	]

	beforeEach(() => {
		vi.stubGlobal('localStorage', new MemoryStorage())
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	runCases(requestCases, async (given: RequestGivenDetail): Promise<RequestThenExpected> => {
		let request: Request | undefined
		const fetchApi = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			request = new Request(input, init)
			return Response.json({ ok: true })
		}
		const testClient = createClient({
			baseUrl: 'https://app.example.com',
			fetchApi,
			getToken: (): string => given.token
		})

		await testClient.api.json<{ ok: boolean }>({
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

	runCases(publicCases, async (): Promise<PublicThenExpected> => {
		let request: Request | undefined
		const fetchApi = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			request = new Request(input, init)
			return Response.json({ ok: true })
		}
		const testClient = createClient({
			baseUrl: 'https://app.example.com',
			fetchApi
		})

		await testClient.api.json<{ ok: boolean }>({
			path: '/api/health',
			method: 'GET'
		})

		if (request === undefined) {
			throw new Error('REQUEST_MISSING')
		}

		return {
			authorization: request.headers.get('authorization') ?? ''
		}
	})

	runCases(defaultClientCases, (): DefaultClientThenExpected => {
		return {
			hasAuth: client.auth !== undefined,
			hasApi: client.api !== undefined
		}
	})

	runCases(exportCases, async (): Promise<ExportThenExpected> => {
		const apiClientModule = await import('./index')
		return {
			exports: Object.keys(apiClientModule).sort()
		}
	})
})
