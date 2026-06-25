import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { parseRequest, parseRequestResult } from './request'

interface MockContext {
	req: {
		json: () => Promise<unknown>
	}
}

const TestSchema = z.object({
	name: z.string().min(1)
})

describe('parseRequest', () => {
	test('returns null when json body is invalid', async () => {
		const ctx: MockContext = {
			req: {
				json: async (): Promise<unknown> => {
					throw new Error('INVALID_JSON')
				}
			}
		}

		const result = await parseRequest(ctx, TestSchema)

		expect(result).toBeNull()
	})

	test('returns schema error details without losing path', async () => {
		const ctx: MockContext = {
			req: {
				json: async (): Promise<unknown> => {
					return {
						name: ''
					}
				}
			}
		}

		const result = await parseRequestResult(ctx, TestSchema)

		expect(result).toEqual({
			success: false,
			error: {
				type: 'schema',
				issues: [
					{
						path: 'name',
						message: 'Too small: expected string to have >=1 characters'
					}
				]
			}
		})
	})
})
