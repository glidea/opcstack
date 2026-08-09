import { beforeAll, describe, expect, test } from 'vitest'

const appBaseUrl: string = process.env['APP_BASE_URL'] ?? 'http://localhost:5173'
const adminApiToken: string = process.env['E2E_ADMIN_API_TOKEN'] ?? 'admin-token'

describe('admin console api e2e', () => {
	beforeAll(async () => {
		const response: Response = await fetch(`${appBaseUrl}/api/health`)
		if (response.status !== 200) {
			throw new Error('dev server is not ready for e2e tests')
		}
	})

	test('user directory requires admin authorization', async () => {
		const response: Response = await fetch(`${appBaseUrl}/api/admin/list_users`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ page: 1, page_size: 20 })
		})
		const payload: { code?: string } = await response.json()

		expect({ status: response.status, code: payload.code }).toEqual({
			status: 401,
			code: 'UNAUTHORIZED'
		})
	})

	test('user directory returns the configured admin user', async () => {
		const response: Response = await fetch(`${appBaseUrl}/api/admin/list_users`, {
			method: 'POST',
			headers: {
				'authorization': `Bearer ${adminApiToken}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify({ page: 1, page_size: 20 })
		})
		const payload: { items?: Array<{ id: string }>; total?: number } = await response.json()

		expect(response.status).toBe(200)
		expect(payload.total).toBeGreaterThan(0)
		expect(payload.items?.[0]?.id).toBeTypeOf('string')
	})
})
