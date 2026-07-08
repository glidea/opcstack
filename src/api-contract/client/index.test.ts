import { describe } from 'vitest'
import { runCases, type TestCase } from '../../backend/testing/bdd'
import {
	client,
	createClient,
	createMemoryBookmarkStorage,
	createMemoryTokenStorage,
	type BookmarkStorage,
	type Bookmarks,
	type TokenStorage
} from './index'

describe('api contract client', () => {
	type ApiGivenDetail = Record<string, never>
	type ApiWhenDetail = Record<string, never>
	type ApiThenExpected = {
		url: string
		method: string
		authorization: string
		metaBookmark: string
		tenantBookmark: string
		body: string
		resultBalance: string
		storedMetaBookmark: string
		storedTenantBookmark: string
	}

	const apiCases: TestCase<ApiGivenDetail, ApiWhenDetail, ApiThenExpected>[] = [
		{
			scenario: 'call typed api with token and bookmarks',
			given: 'token and bookmarks are stored',
			when: 'requesting credit summary',
			then: 'sends system headers and stores response bookmarks',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				url: 'https://app.example.com/api/get_credit_summary',
				method: 'POST',
				authorization: 'Bearer session-token',
				metaBookmark: 'meta-1',
				tenantBookmark: 'tenant-1',
				body: '{}',
				resultBalance: '1.000000',
				storedMetaBookmark: 'meta-2',
				storedTenantBookmark: 'tenant-2'
			}
		}
	]

	type UploadGivenDetail = Record<string, never>
	type UploadWhenDetail = Record<string, never>
	type UploadThenExpected = {
		url: string
		method: string
		contentType: string
		body: string
		key: string
		readUrl: string
	}

	const uploadCases: TestCase<UploadGivenDetail, UploadWhenDetail, UploadThenExpected>[] = [
		{
			scenario: 'upload private r2 object',
			given: 'client has token auth',
			when: 'uploading a private object',
			then: 'sends a put request to the r2 object route',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				url: 'https://app.example.com/api/r2/private/u1/images/a.png',
				method: 'PUT',
				contentType: 'image/png',
				body: 'image',
				key: 'private/u1/images/a.png',
				readUrl: 'https://app.example.com/api/r2/private/u1/images/a.png'
			}
		}
	]

	type FetchGivenDetail = Record<string, never>
	type FetchWhenDetail = Record<string, never>
	type FetchThenExpected = {
		status: number
		body: string
		responseBookmark: string
		storedBookmark: string
	}

	const fetchCases: TestCase<FetchGivenDetail, FetchWhenDetail, FetchThenExpected>[] = [
		{
			scenario: 'return raw fetch response',
			given: 'backend returns status headers and body',
			when: 'requesting raw fetch',
			then: 'returns response without consuming it',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				status: 201,
				body: 'created',
				responseBookmark: 'meta-raw',
				storedBookmark: 'meta-raw'
			}
		}
	]

	type CookieGivenDetail = Record<string, never>
	type CookieWhenDetail = Record<string, never>
	type CookieThenExpected = {
		authorization: string
		metaBookmark: string
		tenantBookmark: string
	}

	const cookieCases: TestCase<CookieGivenDetail, CookieWhenDetail, CookieThenExpected>[] = [
		{
			scenario: 'use cookie modes',
			given: 'client uses cookie auth and cookie bookmarks',
			when: 'requesting raw fetch',
			then: 'does not add token or bookmark headers',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				authorization: '',
				metaBookmark: '',
				tenantBookmark: ''
			}
		}
	]

	type AuthStorageGivenDetail = Record<string, never>
	type AuthStorageWhenDetail = Record<string, never>
	type AuthStorageThenExpected = {
		tokenAfterSignIn: string
		tokenAfterSocialSignIn: string
		tokenAfterSignOut: string
	}

	const authStorageCases: TestCase<
		AuthStorageGivenDetail,
		AuthStorageWhenDetail,
		AuthStorageThenExpected
	>[] = [
		{
			scenario: 'sync token auth storage',
			given: 'auth uses token storage',
			when: 'signing in and signing out',
			then: 'stores token and clears it',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				tokenAfterSignIn: 'new-token',
				tokenAfterSocialSignIn: 'social-token',
				tokenAfterSignOut: ''
			}
		}
	]

	type AuthFetchGivenDetail = Record<string, never>
	type AuthFetchWhenDetail = Record<string, never>
	type AuthFetchThenExpected = {
		metaBookmark: string
		storedMetaBookmark: string
	}

	const authFetchCases: TestCase<AuthFetchGivenDetail, AuthFetchWhenDetail, AuthFetchThenExpected>[] = [
		{
			scenario: 'call auth with bookmark storage',
			given: 'auth and api use the same client state',
			when: 'signing in',
			then: 'sends stored bookmarks and stores response bookmarks',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				metaBookmark: 'auth-meta-1',
				storedMetaBookmark: 'auth-meta-2'
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
			scenario: 'hide internal helpers',
			given: 'client module',
			when: 'reading exports',
			then: 'only exposes public client api',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				exports: [
					'ApiClientError',
					'client',
					'createClient',
					'createMemoryBookmarkStorage',
					'createMemoryTokenStorage'
				]
			}
		}
	]

	runCases(apiCases, async (): Promise<ApiThenExpected> => {
		let request: Request | undefined
		const tokenStorage: TokenStorage = createMemoryTokenStorage('session-token')
		const bookmarkStorage: BookmarkStorage = createMemoryBookmarkStorage({
			meta: 'meta-1',
			tenant: 'tenant-1'
		})
		const fetchApi = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			request = new Request(input, init)
			return Response.json(
				{
					balance: '1.000000',
					daily_checked_in: false,
					daily_checkin_amount: '0.100000'
				},
				{
					headers: {
						'x-d1-meta-bookmark': 'meta-2',
						'x-d1-tenant-bookmark': 'tenant-2'
					}
				}
			)
		}
		const testClient = createClient({
			baseUrl: 'https://app.example.com',
			fetchApi,
			auth: { type: 'token', storage: tokenStorage },
			bookmarks: { type: 'storage', storage: bookmarkStorage }
		})

		const result = await testClient.api.getCreditSummary()
		const bookmarks: Bookmarks = await bookmarkStorage.get()

		if (request === undefined) {
			throw new Error('REQUEST_MISSING')
		}

		return {
			url: request.url,
			method: request.method,
			authorization: request.headers.get('authorization') ?? '',
			metaBookmark: request.headers.get('x-d1-meta-bookmark') ?? '',
			tenantBookmark: request.headers.get('x-d1-tenant-bookmark') ?? '',
			body: await request.text(),
			resultBalance: result.balance,
			storedMetaBookmark: bookmarks.meta ?? '',
			storedTenantBookmark: bookmarks.tenant ?? ''
		}
	})

	runCases(uploadCases, async (): Promise<UploadThenExpected> => {
		let request: Request | undefined
		const fetchApi = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			request = new Request(input, init)
			return Response.json({
				key: 'private/u1/images/a.png',
				read_url: 'https://app.example.com/api/r2/private/u1/images/a.png'
			})
		}
		const testClient = createClient({
			baseUrl: 'https://app.example.com',
			fetchApi,
			auth: { type: 'cookie' },
			bookmarks: { type: 'cookie' }
		})

		const result = await testClient.api.uploadR2Object({
			key: 'private/u1/images/a.png',
			body: 'image',
			content_type: 'image/png'
		})

		if (request === undefined) {
			throw new Error('REQUEST_MISSING')
		}

		return {
			url: request.url,
			method: request.method,
			contentType: request.headers.get('content-type') ?? '',
			body: await request.text(),
			key: result.key,
			readUrl: result.read_url
		}
	})

	runCases(fetchCases, async (): Promise<FetchThenExpected> => {
		const bookmarkStorage: BookmarkStorage = createMemoryBookmarkStorage()
		const fetchApi = async (): Promise<Response> => {
			return new Response('created', {
				status: 201,
				headers: {
					'x-d1-meta-bookmark': 'meta-raw'
				}
			})
		}
		const testClient = createClient({
			baseUrl: 'https://app.example.com',
			fetchApi,
			auth: { type: 'cookie' },
			bookmarks: { type: 'storage', storage: bookmarkStorage }
		})

		const response = await testClient.api.fetch('/api/custom', { method: 'POST', body: 'payload' })
		const bookmarks: Bookmarks = await bookmarkStorage.get()

		return {
			status: response.status,
			body: await response.text(),
			responseBookmark: response.headers.get('x-d1-meta-bookmark') ?? '',
			storedBookmark: bookmarks.meta ?? ''
		}
	})

	runCases(cookieCases, async (): Promise<CookieThenExpected> => {
		let request: Request | undefined
		const fetchApi = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			request = new Request(input, init)
			return Response.json({})
		}
		const testClient = createClient({
			baseUrl: 'https://app.example.com',
			fetchApi,
			auth: { type: 'cookie' },
			bookmarks: { type: 'cookie' }
		})

		await testClient.api.fetch('/api/health')

		if (request === undefined) {
			throw new Error('REQUEST_MISSING')
		}

		return {
			authorization: request.headers.get('authorization') ?? '',
			metaBookmark: request.headers.get('x-d1-meta-bookmark') ?? '',
			tenantBookmark: request.headers.get('x-d1-tenant-bookmark') ?? ''
		}
	})

	runCases(authStorageCases, async (): Promise<AuthStorageThenExpected> => {
		const tokenStorage: TokenStorage = createMemoryTokenStorage()
		const responses: Response[] = [
			Response.json({ token: 'new-token' }),
			Response.json({ token: 'social-token' }),
			Response.json({ success: true })
		]
		const fetchApi = async (): Promise<Response> => {
			const response: Response | undefined = responses.shift()
			if (response === undefined) {
				throw new Error('RESPONSE_MISSING')
			}
			return response
		}
		const testClient = createClient({
			baseUrl: 'https://app.example.com',
			fetchApi,
			auth: { type: 'token', storage: tokenStorage },
			bookmarks: { type: 'cookie' }
		})

		await testClient.auth.signIn.email({ email: 'a@example.com', password: 'password' })
		const tokenAfterSignIn = await tokenStorage.get()
		await testClient.auth.signIn.social({
			provider: 'google',
			idToken: {
				token: 'google-id-token'
			}
		})
		const tokenAfterSocialSignIn = await tokenStorage.get()
		await testClient.auth.signOut()
		const tokenAfterSignOut = await tokenStorage.get()

		return {
			tokenAfterSignIn: tokenAfterSignIn ?? '',
			tokenAfterSocialSignIn: tokenAfterSocialSignIn ?? '',
			tokenAfterSignOut: tokenAfterSignOut ?? ''
		}
	})

	runCases(authFetchCases, async (): Promise<AuthFetchThenExpected> => {
		let request: Request | undefined
		const bookmarkStorage: BookmarkStorage = createMemoryBookmarkStorage({ meta: 'auth-meta-1' })
		const fetchApi = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			request = new Request(input, init)
			return Response.json(
				{ token: 'auth-token' },
				{
					headers: {
						'x-d1-meta-bookmark': 'auth-meta-2'
					}
				}
			)
		}
		const testClient = createClient({
			baseUrl: 'https://app.example.com',
			fetchApi,
			auth: { type: 'token', storage: createMemoryTokenStorage() },
			bookmarks: { type: 'storage', storage: bookmarkStorage }
		})

		await testClient.auth.signIn.email({ email: 'a@example.com', password: 'password' })
		const bookmarks: Bookmarks = await bookmarkStorage.get()

		if (request === undefined) {
			throw new Error('REQUEST_MISSING')
		}

		return {
			metaBookmark: request.headers.get('x-d1-meta-bookmark') ?? '',
			storedMetaBookmark: bookmarks.meta ?? ''
		}
	})

	runCases(defaultClientCases, (): DefaultClientThenExpected => {
		return {
			hasAuth: client.auth !== undefined,
			hasApi: client.api !== undefined
		}
	})

	runCases(exportCases, async (): Promise<ExportThenExpected> => {
		const clientModule = await import('./index')
		return {
			exports: Object.keys(clientModule).sort()
		}
	})
})
