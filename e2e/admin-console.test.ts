import { beforeAll, describe, expect, test } from 'vitest'
import { getAdminSessionCookie } from './support/auth'

const appBaseUrl: string = process.env['APP_BASE_URL'] ?? 'http://localhost:5173'
let adminSessionCookie: string

describe('admin console api e2e', () => {
	beforeAll(async () => {
		const response: Response = await fetch(`${appBaseUrl}/api/health`)
		if (response.status !== 200) {
			throw new Error('dev server is not ready for e2e tests')
		}
		adminSessionCookie = await getAdminSessionCookie(appBaseUrl)
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
				cookie: adminSessionCookie,
				'content-type': 'application/json'
			},
			body: JSON.stringify({ page: 1, page_size: 20 })
		})
		const payload: { items?: Array<{ id: string }>; total?: number } = await response.json()

		expect(response.status).toBe(200)
		expect(payload.total).toBeGreaterThan(0)
		expect(payload.items?.[0]?.id).toBeTypeOf('string')
	})

	test('notification history requires admin authorization', async () => {
		const response: Response = await fetch(`${appBaseUrl}/api/admin/list_notifications`, {
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

	test('notification history returns a paginated response', async () => {
		const response: Response = await fetch(`${appBaseUrl}/api/admin/list_notifications`, {
			method: 'POST',
			headers: {
				cookie: adminSessionCookie,
				'content-type': 'application/json'
			},
			body: JSON.stringify({ page: 1, page_size: 20 })
		})
		const payload: { items?: unknown[]; total?: number } = await response.json()

		expect(response.status).toBe(200)
		expect(payload.items).toBeInstanceOf(Array)
		expect(payload.total).toBeTypeOf('number')
	})

	test('AI task directory requires admin authorization', async () => {
		const response: Response = await fetch(`${appBaseUrl}/api/admin/list_ai_tasks`, {
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

	test('AI task directory returns a paginated response', async () => {
		const response: Response = await fetch(`${appBaseUrl}/api/admin/list_ai_tasks`, {
			method: 'POST',
			headers: {
				cookie: adminSessionCookie,
				'content-type': 'application/json'
			},
			body: JSON.stringify({ page: 1, page_size: 20 })
		})
		const payload: { items?: unknown[]; total?: number } = await response.json()

		expect(response.status).toBe(200)
		expect(payload.items).toBeInstanceOf(Array)
		expect(payload.total).toBeTypeOf('number')
	})

	test('overview requires admin authorization', async () => {
		const response: Response = await fetch(`${appBaseUrl}/api/admin/get_overview`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({})
		})
		const payload: { code?: string } = await response.json()

		expect({ status: response.status, code: payload.code }).toEqual({
			status: 401,
			code: 'UNAUTHORIZED'
		})
	})

	test('overview returns explicit metric values', async () => {
		const response: Response = await fetch(`${appBaseUrl}/api/admin/get_overview`, {
			method: 'POST',
			headers: {
				cookie: adminSessionCookie,
				'content-type': 'application/json'
			},
			body: JSON.stringify({})
		})
		const payload: {
			generated_at?: number
			users?: { total?: number }
			ai_tasks?: { terminal_completion_rate?: number }
		} = await response.json()

		expect(response.status).toBe(200)
		expect(payload.generated_at).toBeTypeOf('number')
		expect(payload.users?.total).toBeTypeOf('number')
		expect(payload.ai_tasks?.terminal_completion_rate).toBeTypeOf('number')
	})
})
