import { describe, expect, test, vi } from 'vitest'
import type { Context } from 'hono'
import { handleApiError, type ApiEnv } from '.'
import { logError } from '../lib/log'

vi.mock('../lib/log', () => {
	return {
		logError: vi.fn()
	}
})

describe('handleApiError', () => {
	test('logs original error and returns generic internal error', async () => {
		const error = new Error('DATABASE_PASSWORD_LEAK')
		const response = handleApiError(error, createContext())
		const payload = await response.json() as { code?: string; message?: string }

		expect(response.status).toBe(500)
		expect(payload).toEqual({
			code: 'INTERNAL_ERROR',
			message: 'Internal error'
		})
		expect(logError).toHaveBeenCalledWith(error, {
			method: 'POST',
			path: '/api/fail'
		})
	})
})

function createContext(): Context<ApiEnv> {
	return {
		req: {
			method: 'POST',
			path: '/api/fail'
		},
		json: (payload: unknown, status?: number): Response => {
			return new Response(JSON.stringify(payload), {
				status: status ?? 200,
				headers: {
					'content-type': 'application/json'
				}
			})
		}
	} as unknown as Context<ApiEnv>
}
