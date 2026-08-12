import { createHmac } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { beforeAll, describe } from 'vitest'
import { runCases, type TestCase } from '../src/backend/testing/bdd'
import { getAdminSessionCookie } from './support/auth'

interface JsonErrorResponse {
	code?: string
}

interface ListResponse {
	items: unknown[]
	total: number
}

interface CreditSummaryResponse {
	balance: string
}

interface PaymentTransactionListResponse {
	items: Array<{
		product_id: string
		status: string
		credits_granted: string
	}>
	total: number
}

interface LocalCreditsProduct {
	productId: string
	creditsAmount: string
	providerProductId: string
}

interface LocalPaymentProductConfig {
	product_id?: string
	credits_amount?: string
	providers?: {
		creem?: LocalPaymentProviderProductConfig
	}
}

interface LocalPaymentProviderProductConfig {
	kind?: string
	product_id?: string
}

interface LocalPaymentFixture {
	token: string
	userId: string
	checkoutOrderId: string
	webhookId: string
	providerPaymentId: string
	product: LocalCreditsProduct
}

type E2EEnv = {
	APP_BASE_URL?: string
	E2E_REMOTE?: string
	E2E_PAYMENT_ENABLED?: string
	E2E_PAYMENT_PROVIDER?: string
	E2E_PAYMENT_PRODUCTS?: string
	E2E_PAYMENT_CREEM_WEBHOOK_SECRET?: string
}

const e2eEnv =
	(globalThis as unknown as { process?: { env?: E2EEnv } }).process?.env ?? {}
const appBaseUrl: string = e2eEnv.APP_BASE_URL ?? 'http://localhost:5173'
const isRemote: boolean = e2eEnv.E2E_REMOTE === '1'
const paymentEnabled: boolean = e2eEnv.E2E_PAYMENT_ENABLED === 'true'
const paymentProvider: string = e2eEnv.E2E_PAYMENT_PROVIDER ?? ''
const paymentProducts: string = e2eEnv.E2E_PAYMENT_PRODUCTS ?? ''
const paymentCreemWebhookSecret: string = e2eEnv.E2E_PAYMENT_CREEM_WEBHOOK_SECRET ?? ''
const hasPaymentConfig: boolean =
	paymentProvider.trim() !== '' &&
	paymentProducts.trim() !== ''
const hasCreemWebhookConfig: boolean =
	paymentProvider === 'creem' &&
	paymentCreemWebhookSecret.trim() !== ''
const localCreditsProduct: LocalCreditsProduct | null = readLocalCreditsProduct(paymentProducts)
const canRunLocalPaymentWebhookFlow: boolean =
	!isRemote && paymentEnabled && hasCreemWebhookConfig && localCreditsProduct !== null
const expectedLocalCreditsAmount: string = normalizeCreditText(
	localCreditsProduct?.creditsAmount ?? '0'
)
let adminSessionCookie: string

describe('payment api e2e', () => {
	beforeAll(async () => {
		const res = await fetch(`${appBaseUrl}/api/health`)
		if (res.status !== 200) {
			throw new Error('dev server is not ready for e2e tests')
		}
		if (!isRemote) {
			adminSessionCookie = await getAdminSessionCookie(appBaseUrl)
		}
	})

	type AuthGiven = Record<string, never>
	type AuthWhen = {
		action:
			| 'create_payment_checkout'
			| 'get_subscription'
			| 'cancel_subscription'
			| 'upgrade_subscription'
			| 'list_payment_transactions'
	}
	type AuthThen = {
		status: number
		code: string
	}

	const authCases: TestCase<AuthGiven, AuthWhen, AuthThen>[] = [
		{
			scenario: 'create payment checkout requires auth',
			given: 'no bearer token',
			when: 'calling /api/create_payment_checkout',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'create_payment_checkout'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED'
			}
		},
		{
			scenario: 'get subscription requires auth',
			given: 'no bearer token',
			when: 'calling /api/get_subscription',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'get_subscription'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED'
			}
		},
		{
			scenario: 'cancel subscription requires auth',
			given: 'no bearer token',
			when: 'calling /api/cancel_subscription',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'cancel_subscription'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED'
			}
		},
		{
			scenario: 'upgrade subscription requires auth',
			given: 'no bearer token',
			when: 'calling /api/upgrade_subscription',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'upgrade_subscription'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED'
			}
		},
		{
			scenario: 'list payment transactions requires auth',
			given: 'no bearer token',
			when: 'calling /api/list_payment_transactions',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'list_payment_transactions'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED'
			}
		}
	]

	runCases(authCases, async (_given, when) => {
		if (when.action === 'create_payment_checkout') {
			const res = await postJson('/api/create_payment_checkout', {
				product_id: 'pro_monthly',
				return_path: '/billing'
			})
			const payload = (await res.json()) as JsonErrorResponse
			return {
				status: res.status,
				code: payload.code ?? ''
			}
		}

		if (when.action === 'get_subscription') {
			const res = await postJson('/api/get_subscription', {})
			const payload = (await res.json()) as JsonErrorResponse
			return {
				status: res.status,
				code: payload.code ?? ''
			}
		}

		if (when.action === 'cancel_subscription') {
			const res = await postJson('/api/cancel_subscription', {})
			const payload = (await res.json()) as JsonErrorResponse
			return {
				status: res.status,
				code: payload.code ?? ''
			}
		}

		if (when.action === 'upgrade_subscription') {
			const res = await postJson('/api/upgrade_subscription', {
				product_id: 'pro_monthly'
			})
			const payload = (await res.json()) as JsonErrorResponse
			return {
				status: res.status,
				code: payload.code ?? ''
			}
		}

		const res = await postJson('/api/list_payment_transactions', {
			page: 1,
			page_size: 20
		})
		const payload = (await res.json()) as JsonErrorResponse
		return {
			status: res.status,
			code: payload.code ?? ''
		}
	})

	describe.skipIf(!(paymentEnabled === false && hasPaymentConfig))(
		'payment disabled behavior',
		() => {
			type DisabledGiven = Record<string, never>
			type DisabledWhen = {
				action: 'list_payment_products'
			}
			type DisabledThen = {
				status: number
				itemCount: number
			}

			const disabledCases: TestCase<DisabledGiven, DisabledWhen, DisabledThen>[] = [
				{
					scenario: 'payment disabled makes product list empty',
					given: 'PAYMENT_ENABLED=false',
					when: 'calling /api/list_payment_products',
					then: 'returns empty items',
					givenDetail: {},
					whenDetail: {
						action: 'list_payment_products'
					},
					thenExpected: {
						status: 200,
						itemCount: 0
					}
				}
			]

			runCases(disabledCases, async () => {
				const res = await postJson('/api/list_payment_products', {})
				const payload = (await res.json()) as { items?: unknown[] }
				return {
					status: res.status,
					itemCount: payload.items?.length ?? -1
				}
			})
		}
	)

	describe.skipIf(isRemote || !hasPaymentConfig)('return url behavior', () => {
		type ReturnGiven = Record<string, never>
		type ReturnWhen = {
			action: 'visit_return_url'
		}
		type ReturnThen = {
			beforeStatus: number
			pageStatus: number
			afterStatus: number
			transactionDelta: number
		}

		const returnCases: TestCase<ReturnGiven, ReturnWhen, ReturnThen>[] = [
			{
				scenario: 'return url does not create payment transactions',
				given: 'admin can query payment transaction total',
				when: 'visiting localized return page with checkout_order_id',
				then: 'transaction total does not change',
				givenDetail: {},
				whenDetail: {
					action: 'visit_return_url'
				},
				thenExpected: {
					beforeStatus: 200,
					pageStatus: 200,
					afterStatus: 200,
					transactionDelta: 0
				}
			}
		]

		runCases(returnCases, async () => {
			const before = await listAdminPaymentTransactions()
			const page = await fetch(
				`${appBaseUrl}/en?checkout_order_id=e2e-fake-${Date.now()}`
			)
			const after = await listAdminPaymentTransactions()
			return {
				beforeStatus: before.status,
				pageStatus: page.status,
				afterStatus: after.status,
				transactionDelta: after.total - before.total
			}
		})
	})

	describe.skipIf(!hasCreemWebhookConfig)('webhook retry boundary', () => {
		type WebhookGiven = Record<string, never>
		type WebhookWhen = {
			action: 'post_same_creem_webhook_twice'
		}
		type WebhookThen = {
			beforeStatus: number
			firstWebhookStatus: number
			secondWebhookStatus: number
			afterStatus: number
			transactionDelta: number
		}

		const webhookCases: TestCase<WebhookGiven, WebhookWhen, WebhookThen>[] = [
			{
				scenario: 'missing checkout webhook retry does not create payment transaction',
				given: 'signed creem checkout.completed webhook has no local checkout order',
				when: 'posting same webhook twice',
				then: 'payment transaction total stays unchanged',
				givenDetail: {},
				whenDetail: {
					action: 'post_same_creem_webhook_twice'
				},
				thenExpected: {
					beforeStatus: 200,
					firstWebhookStatus: 200,
					secondWebhookStatus: 200,
					afterStatus: 200,
					transactionDelta: 0
				}
			}
		]

		runCases(webhookCases, async () => {
			const rawBody = JSON.stringify({
				id: `evt_e2e_missing_checkout_${Date.now()}`,
				eventType: 'checkout.completed',
				created_at: Date.now(),
				object: {
					request_id: `co_e2e_missing_${Date.now()}`,
					metadata: {
						checkout_order_id: `co_e2e_missing_${Date.now()}`
					},
					order: {
						transaction: `txn_e2e_missing_${Date.now()}`,
						amount: 1000,
						currency: 'USD'
					}
				}
			})
			const before = await listAdminPaymentTransactions()
			const firstWebhook = await postCreemWebhook(rawBody)
			const secondWebhook = await postCreemWebhook(rawBody)
			const after = await listAdminPaymentTransactions()
			return {
				beforeStatus: before.status,
				firstWebhookStatus: firstWebhook.status,
				secondWebhookStatus: secondWebhook.status,
				afterStatus: after.status,
				transactionDelta: after.total - before.total
			}
		})
	})

	describe.skipIf(!canRunLocalPaymentWebhookFlow)('local webhook payment grant flow', () => {
		type LocalWebhookGiven = Record<string, never>
		type LocalWebhookWhen = {
			action: 'post_creem_checkout_completed_twice'
		}
		type LocalWebhookThen = {
			beforeTransactionStatus: number
			beforeTransactionTotal: number
			firstWebhookStatus: number
			secondWebhookStatus: number
			afterStatus: number
			afterBalance: string
			transactionStatus: number
			transactionTotal: number
			transactionProductMatched: boolean
			transactionPaid: boolean
			transactionCreditsGranted: string
		}

		const localWebhookCases: TestCase<LocalWebhookGiven, LocalWebhookWhen, LocalWebhookThen>[] = [
			{
				scenario: 'creem checkout webhook grants credits once',
				given: 'local user and pending checkout order',
				when: 'posting the same checkout.completed webhook twice',
				then: 'credits and payment transaction are created once',
				givenDetail: {},
				whenDetail: {
					action: 'post_creem_checkout_completed_twice'
				},
				thenExpected: {
					beforeTransactionStatus: 200,
					beforeTransactionTotal: 0,
					firstWebhookStatus: 200,
					secondWebhookStatus: 200,
					afterStatus: 200,
					afterBalance: expectedLocalCreditsAmount,
					transactionStatus: 200,
					transactionTotal: 1,
					transactionProductMatched: true,
					transactionPaid: true,
					transactionCreditsGranted: expectedLocalCreditsAmount
				},
				timeoutMs: 45_000
			}
		]

		runCases(localWebhookCases, async (): Promise<LocalWebhookThen> => {
			if (localCreditsProduct === null) {
				throw new Error('LOCAL_PAYMENT_PRODUCT_NOT_FOUND')
			}
			const fixture: LocalPaymentFixture = createLocalPaymentFixture(
				String(Date.now()),
				localCreditsProduct
			)
			const beforeTransactionsRes: Response = await listPaymentTransactions(fixture.token)
			const beforeTransactionsPayload =
				(await beforeTransactionsRes.json()) as PaymentTransactionListResponse
			const rawBody: string = buildCreemCheckoutCompletedWebhook(fixture)
			const firstWebhook: Response = await postCreemWebhook(rawBody)
			const secondWebhook: Response = await postCreemWebhook(rawBody)
			const afterRes: Response = await postJson(
				'/api/get_credit_summary',
				{},
				{
					authorization: `Bearer ${fixture.token}`
				}
			)
			const afterPayload = (await afterRes.json()) as CreditSummaryResponse
			const transactionsRes: Response = await listPaymentTransactions(fixture.token)
			const transactionsPayload =
				(await transactionsRes.json()) as PaymentTransactionListResponse
			const transaction = transactionsPayload.items[0]

			return {
				beforeTransactionStatus: beforeTransactionsRes.status,
				beforeTransactionTotal: beforeTransactionsPayload.total,
				firstWebhookStatus: firstWebhook.status,
				secondWebhookStatus: secondWebhook.status,
				afterStatus: afterRes.status,
				afterBalance: afterPayload.balance,
				transactionStatus: transactionsRes.status,
				transactionTotal: transactionsPayload.total,
				transactionProductMatched: transaction?.product_id === fixture.product.productId,
				transactionPaid: transaction?.status === 'paid',
				transactionCreditsGranted: transaction?.credits_granted ?? ''
			}
		})
	})
})

function listPaymentTransactions(token: string): Promise<Response> {
	return postJson(
		'/api/list_payment_transactions',
		{
			page: 1,
			page_size: 20
		},
		{
			authorization: `Bearer ${token}`
		}
	)
}

function postJson(
	path: string,
	body: unknown,
	extraHeaders?: Record<string, string>
): Promise<Response> {
	const headers: Headers = new Headers({
		'content-type': 'application/json'
	})
	if (extraHeaders) {
		for (const [key, value] of Object.entries(extraHeaders)) {
			headers.set(key, value)
		}
	}
	return fetch(`${appBaseUrl}${path}`, {
		method: 'POST',
		headers,
		body: JSON.stringify(body)
	})
}

async function listAdminPaymentTransactions(): Promise<{ status: number; total: number }> {
	const res = await fetch(`${appBaseUrl}/api/admin/list_payment_transactions`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			cookie: adminSessionCookie
		},
		body: JSON.stringify({
			page: 1,
			page_size: 20
		})
	})
	const payload = (await res.json()) as Partial<ListResponse>
	return {
		status: res.status,
		total: typeof payload.total === 'number' ? payload.total : -1
	}
}

function postCreemWebhook(rawBody: string): Promise<Response> {
	return fetch(`${appBaseUrl}/api/webhook/creem`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'creem-signature': signCreemBody(rawBody)
		},
		body: rawBody
	})
}

function signCreemBody(rawBody: string): string {
	return createHmac('sha256', paymentCreemWebhookSecret).update(rawBody).digest('hex')
}

function readLocalCreditsProduct(raw: string): LocalCreditsProduct | null {
	if (raw.trim() === '') {
		return null
	}
	const products = JSON.parse(raw) as LocalPaymentProductConfig[]
	for (const product of products) {
		const productId: string = product.product_id ?? ''
		const creditsAmount: string = product.credits_amount ?? ''
		const creemProvider: LocalPaymentProviderProductConfig | undefined =
			product.providers?.creem
		const providerProductId: string =
			creemProvider?.kind === 'remote_product' ? (creemProvider.product_id ?? '') : ''
		if (productId !== '' && creditsAmount !== '' && providerProductId !== '') {
			return {
				productId,
				creditsAmount,
				providerProductId
			}
		}
	}
	return null
}

function createLocalPaymentFixture(tag: string, product: LocalCreditsProduct): LocalPaymentFixture {
	const now: number = Date.now()
	const cleanTag: string = tag.replace(/[^a-zA-Z0-9_]/g, '_')
	const userId: string = `u_payment_${cleanTag}`
	const sessionId: string = `s_payment_${cleanTag}`
	const token: string = `t_payment_${cleanTag}`
	const checkoutOrderId: string = `co_payment_${cleanTag}`
	const webhookId: string = `evt_payment_${cleanTag}`
	const providerPaymentId: string = `txn_payment_${cleanTag}`
	const email: string = `${userId}@example.com`
	const expiresAt: number = now + 30 * 24 * 60 * 60 * 1000
	const sql: string = [
		'PRAGMA busy_timeout=5000;',
		`INSERT INTO user (id, name, email, aff_code, email_verified, image, created_at, updated_at) VALUES (${sqlText(userId)}, 'e2e-user', ${sqlText(email)}, NULL, 1, NULL, ${now}, ${now});`,
		`INSERT INTO session (id, expires_at, token, created_at, updated_at, ip_address, user_agent, user_id) VALUES (${sqlText(sessionId)}, ${expiresAt}, ${sqlText(token)}, ${now}, ${now}, NULL, 'e2e', ${sqlText(userId)});`,
		`INSERT INTO checkout_orders (id, user_id, type, status, product_id, product_name, product_description, amount, currency, credits_amount, provider, provider_product_id, provider_checkout_session_id, provider_payment_id, checkout_url, created_at, updated_at) VALUES (${sqlText(checkoutOrderId)}, ${sqlText(userId)}, 'credits_purchase', 'pending', ${sqlText(product.productId)}, ${sqlText(product.productId)}, NULL, 1000, 'USD', ${creditsToUnits(product.creditsAmount)}, 'creem', ${sqlText(product.providerProductId)}, ${sqlText(`cs_${cleanTag}`)}, NULL, ${sqlText('https://example.com/checkout')}, ${now}, ${now});`
	].join(' ')
	execFileSync('sqlite3', [readLocalD1SqlitePath(), sql], {
		stdio: 'ignore'
	})

	return {
		token,
		userId,
		checkoutOrderId,
		webhookId,
		providerPaymentId,
		product
	}
}

function buildCreemCheckoutCompletedWebhook(fixture: LocalPaymentFixture): string {
	return JSON.stringify({
		id: fixture.webhookId,
		eventType: 'checkout.completed',
		created_at: Date.now(),
		object: {
			request_id: fixture.checkoutOrderId,
			metadata: {
				checkout_order_id: fixture.checkoutOrderId
			},
			order: {
				transaction: fixture.providerPaymentId,
				amount: 1000,
				currency: 'USD'
			}
		}
	})
}

function normalizeCreditText(value: string): string {
	const parts: string[] = value.split('.')
	const whole: string = parts[0]
	const fraction: string = parts[1] ?? ''
	return `${whole}.${fraction.padEnd(6, '0').slice(0, 6)}`
}

function creditsToUnits(value: string): number {
	const normalized: string = normalizeCreditText(value)
	const parts: string[] = normalized.split('.')
	const whole: string = parts[0]
	const fraction: string = parts[1] ?? '000000'
	return Number(whole) * 1_000_000 + Number(fraction)
}

function readLocalD1SqlitePath(): string {
	const dir: string = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'
	const files: string[] = readdirSync(dir).filter((file: string): boolean => {
		return file.endsWith('.sqlite') && file !== 'metadata.sqlite'
	})
	if (files.length !== 1) {
		throw new Error('LOCAL_D1_SQLITE_NOT_FOUND')
	}
	return `${dir}/${files[0]}`
}

function sqlText(value: string): string {
	return `'${value.replaceAll("'", "''")}'`
}
