import { beforeAll, describe, expect, test } from 'vitest'
import { getAdminSessionCookie } from './support/auth'

type ErrorResponse = {
	code?: string
}

type PaymentConfig = {
	enabled: boolean
	default_provider: 'dodo' | 'creem' | null
	products: Array<{ product_id: string; version: number }>
	version: number
}

type PaymentProductList = {
	items: unknown[]
	total: number
}

const appBaseUrl: string = process.env['APP_BASE_URL'] ?? 'http://localhost:5173'
const remote: boolean = process.env['E2E_REMOTE'] === '1'
let adminSessionCookie: string

describe('payment api e2e', (): void => {
	beforeAll(async (): Promise<void> => {
		const response: Response = await fetch(`${appBaseUrl}/api/health`)
		if (!response.ok) {
			throw new Error('dev server is not ready for e2e tests')
		}
		if (!remote) {
			adminSessionCookie = await getAdminSessionCookie(appBaseUrl)
		}
	})

	for (const testCase of [
		{ path: '/api/create_payment_checkout', body: { product_id: 'pro', return_path: '/' } },
		{ path: '/api/get_subscription', body: {} },
		{ path: '/api/cancel_subscription', body: {} },
		{ path: '/api/upgrade_subscription', body: { product_id: 'pro' } },
		{ path: '/api/list_payment_transactions', body: { page: 1, page_size: 20 } }
	]) {
		test(`${testCase.path} requires authentication`, async (): Promise<void> => {
			const response: Response = await postJson(testCase.path, testCase.body)
			const payload: ErrorResponse = await response.json()
			expect({ status: response.status, code: payload.code }).toEqual({
				status: 401,
				code: 'UNAUTHORIZED'
			})
		})
	}

	test.skipIf(remote)('reads payment state from the administrator configuration API', async (): Promise<void> => {
		const configResponse: Response = await postJson(
			'/api/admin/get_payment_config',
			{},
			{ cookie: adminSessionCookie }
		)
		const config: PaymentConfig = await configResponse.json()
		expect(configResponse.status).toBe(200)
		expect(config.version).toBeGreaterThan(0)
		expect(Array.isArray(config.products)).toBe(true)

		const productsResponse: Response = await postJson('/api/list_payment_products', {})
		const products: PaymentProductList = await productsResponse.json()
		expect(productsResponse.status).toBe(200)
		if (!config.enabled) {
			expect(products).toEqual({ items: [], total: 0 })
		}
	})
})

function postJson(
	path: string,
	body: unknown,
	extraHeaders: Record<string, string> = {}
): Promise<Response> {
	return fetch(`${appBaseUrl}${path}`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			...extraHeaders
		},
		body: JSON.stringify(body)
	})
}
