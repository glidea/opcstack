import { createAuthClient } from 'better-auth/svelte'
import { emailOTPClient, genericOAuthClient } from 'better-auth/client/plugins'
import type { GetAffSummaryResponse, BindAffRequest } from '../aff'
import type {
	GetAdminAiTaskRequest,
	GetAdminAiTaskResponse,
	ListAdminAiTasksRequest,
	ListAdminAiTasksResponse
} from '../admin-ai-tasks'
import type { GetAdminOverviewResponse } from '../admin-overview'
import type {
	ListAdminUsersRequest,
	ListAdminUsersResponse
} from '../admin-users'
import type {
	BindBetaCodeRequest,
	GenerateBetaCodesRequest,
	GenerateBetaCodesResponse,
	ListBetaCodesRequest,
	ListBetaCodesResponse
} from '../beta'
import type {
	AdminGrantCreditsRequest,
	AdminGrantCreditsResponse,
	DailyCheckinResponse,
	GenerateCreditCodesRequest,
	GenerateCreditCodesResponse,
	GetCreditSummaryResponse,
	ListCreditCodesRequest,
	ListCreditCodesResponse,
	ListCreditTransactionsRequest,
	ListCreditTransactionsResponse,
	RedeemCreditCodeRequest,
	RedeemCreditCodeResponse
} from '../credits'
import type {
	ListFeedbacksRequest,
	ListFeedbacksResponse,
	SubmitFeedbackRequest,
	SubmitFeedbackResponse
} from '../feedback'
import type {
	CreateNotificationRequest,
	CreateNotificationResponse,
	ListAdminNotificationsRequest,
	ListAdminNotificationsResponse,
	ListNotificationsRequest,
	ListNotificationsResponse,
	ReadNotificationRequest
} from '../notifications'
import type {
	CancelSubscriptionResponse,
	CreatePaymentCheckoutRequest,
	CreatePaymentCheckoutResponse,
	GetSubscriptionResponse,
	ListAdminPaymentTransactionsRequest,
	ListAdminPaymentTransactionsResponse,
	ListPaymentProductsResponse,
	ListPaymentTransactionsRequest,
	ListPaymentTransactionsResponse,
	UpgradeSubscriptionRequest,
	UpgradeSubscriptionResponse
} from '../payment'
import type {
	UploadR2ObjectRequest,
	UploadR2ObjectResponse,
	UploadR2PublicObjectRequest,
	UploadR2PublicObjectResponse
} from '../r2'
import type { ApiErrorResponse } from '../common'

const META_BOOKMARK_HEADER = 'x-d1-meta-bookmark'
const TENANT_BOOKMARK_HEADER = 'x-d1-tenant-bookmark'

type AuthPlugins = [ReturnType<typeof emailOTPClient>, ReturnType<typeof genericOAuthClient>]
type AuthClientOptions = {
	baseURL: string
	fetchOptions: {
		customFetchImpl: typeof fetch
		auth?: { type: 'Bearer'; token: () => Promise<string | undefined> }
		onSuccess: (context: AuthSuccessContext) => Promise<void>
	}
	plugins: AuthPlugins
}
type ConfiguredAuthClient = ReturnType<typeof createAuthClient<AuthClientOptions>>

export type Bookmarks = {
	meta?: string
	tenant?: string
}

export type TokenStorage = {
	get(): Promise<string | undefined>
	set(token: string): Promise<void>
	clear(): Promise<void>
}

export type BookmarkStorage = {
	get(): Promise<Bookmarks>
	set(bookmarks: Bookmarks): Promise<void>
}

export type AuthMode =
	| { type: 'cookie' }
	| { type: 'token'; storage: TokenStorage }

export type BookmarkMode =
	| { type: 'cookie' }
	| { type: 'storage'; storage: BookmarkStorage }

export type ClientOptions = {
	baseUrl: string
	fetchApi?: typeof fetch
	auth: AuthMode
	bookmarks: BookmarkMode
}

export type Client = {
	auth: ConfiguredAuthClient
	api: ApiClient
}

export type ApiClient = ApiMethods & {
	fetch(input: string | Request, init?: RequestInit): Promise<Response>
}

type ApiMethods = {
	bindAff(input: BindAffRequest): Promise<Record<string, never>>
	bindBetaCode(input: BindBetaCodeRequest): Promise<Record<string, never>>
	cancelSubscription(): Promise<CancelSubscriptionResponse>
	createNotification(input: CreateNotificationRequest): Promise<CreateNotificationResponse>
	createPaymentCheckout(input: CreatePaymentCheckoutRequest): Promise<CreatePaymentCheckoutResponse>
	dailyCheckin(): Promise<DailyCheckinResponse>
	generateBetaCodes(input: GenerateBetaCodesRequest): Promise<GenerateBetaCodesResponse>
	generateCreditCodes(input: GenerateCreditCodesRequest): Promise<GenerateCreditCodesResponse>
	getAffSummary(): Promise<GetAffSummaryResponse>
	getAdminAiTask(input: GetAdminAiTaskRequest): Promise<GetAdminAiTaskResponse>
	getAdminOverview(): Promise<GetAdminOverviewResponse>
	getCreditSummary(): Promise<GetCreditSummaryResponse>
	getSubscription(): Promise<GetSubscriptionResponse>
	grantCredits(input: AdminGrantCreditsRequest): Promise<AdminGrantCreditsResponse>
	listAdminPaymentTransactions(
		input: ListAdminPaymentTransactionsRequest
	): Promise<ListAdminPaymentTransactionsResponse>
	listAdminAiTasks(input: ListAdminAiTasksRequest): Promise<ListAdminAiTasksResponse>
	listAdminNotifications(
		input: ListAdminNotificationsRequest
	): Promise<ListAdminNotificationsResponse>
	listAdminUsers(input: ListAdminUsersRequest): Promise<ListAdminUsersResponse>
	listBetaCodes(input: ListBetaCodesRequest): Promise<ListBetaCodesResponse>
	listCreditCodes(input: ListCreditCodesRequest): Promise<ListCreditCodesResponse>
	listCreditTransactions(
		input: ListCreditTransactionsRequest
	): Promise<ListCreditTransactionsResponse>
	listFeedbacks(input: ListFeedbacksRequest): Promise<ListFeedbacksResponse>
	listNotifications(input: ListNotificationsRequest): Promise<ListNotificationsResponse>
	listPaymentProducts(): Promise<ListPaymentProductsResponse>
	listPaymentTransactions(
		input: ListPaymentTransactionsRequest
	): Promise<ListPaymentTransactionsResponse>
	readNotification(input: ReadNotificationRequest): Promise<Record<string, never>>
	redeemCreditCode(input: RedeemCreditCodeRequest): Promise<RedeemCreditCodeResponse>
	submitFeedback(input: SubmitFeedbackRequest): Promise<SubmitFeedbackResponse>
	uploadR2Object(input: UploadR2ObjectRequest): Promise<UploadR2ObjectResponse>
	uploadR2PublicObject(input: UploadR2PublicObjectRequest): Promise<UploadR2PublicObjectResponse>
	upgradeSubscription(input: UpgradeSubscriptionRequest): Promise<UpgradeSubscriptionResponse>
}

type ApiJsonRequest = {
	path: string
	body: unknown
}

type AuthSuccessContext = {
	data: unknown
	request: {
		url: string | URL
	}
}

export class ApiClientError extends Error {
	readonly status: number
	readonly body: ApiErrorResponse

	constructor(status: number, body: ApiErrorResponse) {
		super(body.message)
		this.name = 'ApiClientError'
		this.status = status
		this.body = body
	}
}

export function createMemoryTokenStorage(initialToken?: string): TokenStorage {
	let token: string | undefined = initialToken

	return {
		async get(): Promise<string | undefined> {
			return token
		},
		async set(nextToken: string): Promise<void> {
			token = nextToken
		},
		async clear(): Promise<void> {
			token = undefined
		}
	}
}

export function createMemoryBookmarkStorage(initialBookmarks?: Bookmarks): BookmarkStorage {
	let bookmarks: Bookmarks = initialBookmarks ?? {}

	return {
		async get(): Promise<Bookmarks> {
			return bookmarks
		},
		async set(nextBookmarks: Bookmarks): Promise<void> {
			bookmarks = {
				...bookmarks,
				...nextBookmarks
			}
		}
	}
}

export function createClient(options: ClientOptions): Client {
	const api: ApiClient = createApiClient(options)
	const auth: ConfiguredAuthClient = createAuth(options)

	return {
		auth,
		api
	}
}

export const client: Client = createClient({
	baseUrl: typeof window === 'undefined' ? '' : window.location.origin,
	auth: { type: 'cookie' },
	bookmarks: { type: 'cookie' }
})

function createAuth(options: ClientOptions): ConfiguredAuthClient {
	return createAuthClient({
		baseURL: options.baseUrl,
		fetchOptions: {
			customFetchImpl: async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
				return fetchWithClientState(options, input, init)
			},
			auth: buildBetterAuthToken(options.auth),
			onSuccess: async (context: AuthSuccessContext): Promise<void> => {
				await syncAuthToken(options.auth, context)
			}
		},
		plugins: createAuthPlugins()
	})
}

function createAuthPlugins(): AuthPlugins {
	return [emailOTPClient(), genericOAuthClient()]
}

function buildBetterAuthToken(auth: AuthMode): { type: 'Bearer'; token: () => Promise<string | undefined> } | undefined {
	if (auth.type === 'cookie') {
		return undefined
	}

	return {
		type: 'Bearer',
		token: async (): Promise<string | undefined> => {
			return auth.storage.get()
		}
	}
}

async function syncAuthToken(auth: AuthMode, context: AuthSuccessContext): Promise<void> {
	if (auth.type === 'cookie') {
		return
	}

	const pathname: string = new URL(context.request.url, 'https://client.local').pathname
	if (pathname.endsWith('/sign-out')) {
		await auth.storage.clear()
		return
	}

	const token: string | undefined = readToken(context.data)
	if (token === undefined) {
		return
	}

	await auth.storage.set(token)
}

function createApiClient(options: ClientOptions): ApiClient {
	const apiFetch: (input: string | Request, init?: RequestInit) => Promise<Response> = async (
		input: string | Request,
		init?: RequestInit
	): Promise<Response> => {
		return fetchWithClientState(options, input, init)
	}
	const call: <TResponse>(request: ApiJsonRequest) => Promise<TResponse> = async <TResponse>(
		request: ApiJsonRequest
	): Promise<TResponse> => {
		return callApiJson<TResponse>(apiFetch, request)
	}
	const upload: <TResponse>(path: string, input: UploadR2ObjectRequest) => Promise<TResponse> = async <TResponse>(
		path: string,
		input: UploadR2ObjectRequest
	): Promise<TResponse> => {
		return callApiUpload<TResponse>(apiFetch, path, input)
	}

	return {
		...createApiMethods(call, upload),
		fetch: apiFetch
	}
}

async function fetchWithClientState(
	options: ClientOptions,
	input: RequestInfo | URL,
	init?: RequestInit
): Promise<Response> {
	const fetchApi: typeof fetch = options.fetchApi ?? fetch
	const request: Request = await buildRequest(options, input, init)
	const response: Response = await fetchApi(request)
	await syncBookmarks(options.bookmarks, response.headers)
	return response
}

function createApiMethods(
	call: <TResponse>(request: ApiJsonRequest) => Promise<TResponse>,
	upload: <TResponse>(path: string, input: UploadR2ObjectRequest) => Promise<TResponse>
): ApiMethods {
	return {
		bindAff(input: BindAffRequest): Promise<Record<string, never>> {
			return call({ path: '/api/bind_aff', body: input })
		},
		bindBetaCode(input: BindBetaCodeRequest): Promise<Record<string, never>> {
			return call({ path: '/api/bind_beta_code', body: input })
		},
		cancelSubscription(): Promise<CancelSubscriptionResponse> {
			return call({ path: '/api/cancel_subscription', body: {} })
		},
		createNotification(input: CreateNotificationRequest): Promise<CreateNotificationResponse> {
			return call({ path: '/api/admin/create_notification', body: input })
		},
		createPaymentCheckout(input: CreatePaymentCheckoutRequest): Promise<CreatePaymentCheckoutResponse> {
			return call({ path: '/api/create_payment_checkout', body: input })
		},
		dailyCheckin(): Promise<DailyCheckinResponse> {
			return call({ path: '/api/daily_checkin', body: {} })
		},
		generateBetaCodes(input: GenerateBetaCodesRequest): Promise<GenerateBetaCodesResponse> {
			return call({ path: '/api/admin/generate_beta_codes', body: input })
		},
		generateCreditCodes(input: GenerateCreditCodesRequest): Promise<GenerateCreditCodesResponse> {
			return call({ path: '/api/admin/generate_credit_codes', body: input })
		},
		getAffSummary(): Promise<GetAffSummaryResponse> {
			return call({ path: '/api/get_aff_summary', body: {} })
		},
		getAdminAiTask(input: GetAdminAiTaskRequest): Promise<GetAdminAiTaskResponse> {
			return call({ path: '/api/admin/get_ai_task', body: input })
		},
		getAdminOverview(): Promise<GetAdminOverviewResponse> {
			return call({ path: '/api/admin/get_overview', body: {} })
		},
		getCreditSummary(): Promise<GetCreditSummaryResponse> {
			return call({ path: '/api/get_credit_summary', body: {} })
		},
		getSubscription(): Promise<GetSubscriptionResponse> {
			return call({ path: '/api/get_subscription', body: {} })
		},
		grantCredits(input: AdminGrantCreditsRequest): Promise<AdminGrantCreditsResponse> {
			return call({ path: '/api/admin/grant_credits', body: input })
		},
		listAdminPaymentTransactions(
			input: ListAdminPaymentTransactionsRequest
		): Promise<ListAdminPaymentTransactionsResponse> {
			return call({ path: '/api/admin/list_payment_transactions', body: input })
		},
		listAdminAiTasks(input: ListAdminAiTasksRequest): Promise<ListAdminAiTasksResponse> {
			return call({ path: '/api/admin/list_ai_tasks', body: input })
		},
		listAdminNotifications(
			input: ListAdminNotificationsRequest
		): Promise<ListAdminNotificationsResponse> {
			return call({ path: '/api/admin/list_notifications', body: input })
		},
		listAdminUsers(input: ListAdminUsersRequest): Promise<ListAdminUsersResponse> {
			return call({ path: '/api/admin/list_users', body: input })
		},
		listBetaCodes(input: ListBetaCodesRequest): Promise<ListBetaCodesResponse> {
			return call({ path: '/api/admin/list_beta_codes', body: input })
		},
		listCreditCodes(input: ListCreditCodesRequest): Promise<ListCreditCodesResponse> {
			return call({ path: '/api/admin/list_credit_codes', body: input })
		},
		listCreditTransactions(
			input: ListCreditTransactionsRequest
		): Promise<ListCreditTransactionsResponse> {
			return call({ path: '/api/list_credit_transactions', body: input })
		},
		listFeedbacks(input: ListFeedbacksRequest): Promise<ListFeedbacksResponse> {
			return call({ path: '/api/admin/list_feedbacks', body: input })
		},
		listNotifications(input: ListNotificationsRequest): Promise<ListNotificationsResponse> {
			return call({ path: '/api/list_notifications', body: input })
		},
		listPaymentProducts(): Promise<ListPaymentProductsResponse> {
			return call({ path: '/api/list_payment_products', body: {} })
		},
		listPaymentTransactions(
			input: ListPaymentTransactionsRequest
		): Promise<ListPaymentTransactionsResponse> {
			return call({ path: '/api/list_payment_transactions', body: input })
		},
		readNotification(input: ReadNotificationRequest): Promise<Record<string, never>> {
			return call({ path: '/api/read_notification', body: input })
		},
		redeemCreditCode(input: RedeemCreditCodeRequest): Promise<RedeemCreditCodeResponse> {
			return call({ path: '/api/redeem_credit_code', body: input })
		},
		submitFeedback(input: SubmitFeedbackRequest): Promise<SubmitFeedbackResponse> {
			return call({ path: '/api/submit_feedback', body: input })
		},
		uploadR2Object(input: UploadR2ObjectRequest): Promise<UploadR2ObjectResponse> {
			return upload(`/api/r2/${encodeR2Key(input.key)}`, input)
		},
		uploadR2PublicObject(input: UploadR2PublicObjectRequest): Promise<UploadR2PublicObjectResponse> {
			return upload(`/api/admin/r2/${encodeR2Key(input.key)}`, input)
		},
		upgradeSubscription(input: UpgradeSubscriptionRequest): Promise<UpgradeSubscriptionResponse> {
			return call({ path: '/api/upgrade_subscription', body: input })
		}
	}
}

async function callApiUpload<TResponse>(
	apiFetch: (input: string | Request, init?: RequestInit) => Promise<Response>,
	path: string,
	input: UploadR2ObjectRequest
): Promise<TResponse> {
	const response: Response = await apiFetch(path, {
		method: 'PUT',
		headers: {
			'content-type': input.content_type
		},
		body: input.body
	})

	const body: unknown = await response.json()
	if (!response.ok) {
		throw new ApiClientError(response.status, normalizeApiError(body))
	}

	return body as TResponse
}

async function callApiJson<TResponse>(
	apiFetch: (input: string | Request, init?: RequestInit) => Promise<Response>,
	request: ApiJsonRequest
): Promise<TResponse> {
	const response: Response = await apiFetch(request.path, {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify(request.body)
	})

	const body: unknown = await response.json()
	if (!response.ok) {
		throw new ApiClientError(response.status, normalizeApiError(body))
	}

	return body as TResponse
}

function encodeR2Key(key: string): string {
	return key.split('/').map(encodeURIComponent).join('/')
}

async function buildRequest(
	options: ClientOptions,
	input: RequestInfo | URL,
	init?: RequestInit
): Promise<Request> {
	const url: URL = resolveApiUrl(options.baseUrl, input)
	let request: Request
	if (typeof input === 'string' || input instanceof URL) {
		request = new Request(url, init)
	} else {
		request = new Request(url, input)
		if (init !== undefined) {
			request = new Request(request, init)
		}
	}

	const headers: Headers = new Headers(request.headers)
	await setAuthHeader(options.auth, headers)
	await setBookmarkHeaders(options.bookmarks, headers)

	return new Request(request, { headers })
}

function resolveApiUrl(baseUrl: string, input: RequestInfo | URL): URL {
	if (typeof input === 'string') {
		return new URL(input, baseUrl)
	}

	const sourceUrl: URL = input instanceof URL ? input : new URL(input.url)
	return new URL(`${sourceUrl.pathname}${sourceUrl.search}${sourceUrl.hash}`, baseUrl)
}

async function setAuthHeader(auth: AuthMode, headers: Headers): Promise<void> {
	if (auth.type === 'cookie') {
		return
	}

	const token: string | undefined = await auth.storage.get()
	if (token === undefined || token === '') {
		return
	}

	headers.set('authorization', `Bearer ${token}`)
}

async function setBookmarkHeaders(bookmarks: BookmarkMode, headers: Headers): Promise<void> {
	if (bookmarks.type === 'cookie') {
		return
	}

	const stored: Bookmarks = await bookmarks.storage.get()
	if (stored.meta !== undefined && stored.meta !== '') {
		headers.set(META_BOOKMARK_HEADER, stored.meta)
	}
	if (stored.tenant !== undefined && stored.tenant !== '') {
		headers.set(TENANT_BOOKMARK_HEADER, stored.tenant)
	}
}

async function syncBookmarks(bookmarks: BookmarkMode, headers: Headers): Promise<void> {
	if (bookmarks.type === 'cookie') {
		return
	}

	const nextBookmarks: Bookmarks = {}
	const metaBookmark: string | null = headers.get(META_BOOKMARK_HEADER)
	const tenantBookmark: string | null = headers.get(TENANT_BOOKMARK_HEADER)
	if (metaBookmark !== null && metaBookmark !== '') {
		nextBookmarks.meta = metaBookmark
	}
	if (tenantBookmark !== null && tenantBookmark !== '') {
		nextBookmarks.tenant = tenantBookmark
	}

	await bookmarks.storage.set(nextBookmarks)
}

function normalizeApiError(body: unknown): ApiErrorResponse {
	if (isApiErrorResponse(body)) {
		return body
	}

	return { code: 'API_ERROR', message: 'API error' }
}

function isApiErrorResponse(body: unknown): body is ApiErrorResponse {
	if (typeof body !== 'object' || body === null) {
		return false
	}

	const record: Record<string, unknown> = body as Record<string, unknown>
	return typeof record['code'] === 'string' && typeof record['message'] === 'string'
}

function readToken(data: unknown): string | undefined {
	if (typeof data !== 'object' || data === null) {
		return undefined
	}

	const record: Record<string, unknown> = data as Record<string, unknown>
	const token: unknown = record['token']
	if (typeof token !== 'string' || token === '') {
		return undefined
	}

	return token
}
