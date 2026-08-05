import { describe, expect, it } from 'vitest'
import type { Context } from 'hono'
import type { ApiEnv } from '..'
import {
	createAgentAuthorizationHandler,
	pollAgentAuthorizationHandler,
	resolveAgentAuthorizationHandler
} from './agent-auth'

describe('agent authorization handlers', () => {
	it('creates a relay response with browser and fallback verification URLs', async () => {
		const db = createMemoryDb()
		const response = await createAgentAuthorizationHandler(createContext({
			db,
			body: {
				code_challenge: 'A'.repeat(43),
				code_challenge_method: 'S256',
				scopes: ['reports:read']
			}
		}))
		const body = (await response.json()) as {
			device_code: string
			user_code: string
			verification_uri: string
			verification_uri_complete: string
			interval: number
		}

		expect(response.status).toBe(200)
		expect(body.device_code).toBeTruthy()
		expect(body.user_code).toBeTruthy()
		expect(body.verification_uri).toBe(body.verification_uri_complete)
		expect(body.verification_uri).toContain('/agent/authorize?user_code=')
		expect(body.interval).toBe(5)
	})

	it('maps an unknown device code to the protocol error', async () => {
		const response = await pollAgentAuthorizationHandler(createContext({
			db: createMemoryDb(),
			body: { device_code: 'unknown' }
		}))

		expect(response.status).toBe(400)
		expect(await response.json()).toEqual({
			code: 'INVALID_DEVICE_CODE',
			message: 'Invalid device code'
		})
	})

	it('builds the hosted OAuth URL from a valid user code', async () => {
		const db = createMemoryDb()
		const created = await createAgentAuthorizationHandler(createContext({
			db,
			body: {
				code_challenge: 'A'.repeat(43),
				code_challenge_method: 'S256',
				scopes: []
			}
		}))
		const createdBody = (await created.json()) as { user_code: string }
		const response = await resolveAgentAuthorizationHandler(createContext({
			db,
			body: { user_code: createdBody.user_code }
		}))
		const body = (await response.json()) as { authorization_url: string }
		const url = new URL(body.authorization_url)

		expect(response.status).toBe(200)
		expect(url.pathname).toBe('/api/auth/oauth2/authorize')
		expect(url.searchParams.get('client_id')).toBe('opcstack-agent')
		expect(url.searchParams.get('code_challenge')).toBe('A'.repeat(43))
	})
})

type MemoryRow = Record<string, unknown>

function createMemoryDb(): Record<string, unknown> {
	let row: MemoryRow | undefined
	return {
		insert: () => ({
			values: (input: MemoryRow) => ({
				run: async (): Promise<void> => {
					row = {
						...input,
						lastPolledAt: null,
						codeExpiresAt: null,
						authorizationCode: null,
						consumedAt: null
					}
				}
			})
		}),
		query: {
			agentAuthorizationRequest: {
			findFirst: async (): Promise<MemoryRow | undefined> => row
			}
		},
		update: () => ({
			set: () => ({
				where: () => ({
					run: async (): Promise<void> => undefined
				})
			})
		})
	}
}

function createContext(input: {
	db: Record<string, unknown>
	body: unknown
}): Context<ApiEnv> {
	const values: Record<string, unknown> = { metaDb: input.db }
	return {
		env: { APP_BASE_URL: 'https://app.example.com' },
		req: {
			json: async (): Promise<unknown> => input.body,
			query: (): undefined => undefined,
			raw: { headers: new Headers() }
		},
		get: (key: string): unknown => values[key],
		set: (key: string, value: unknown): void => {
			values[key] = value
		},
		json: (body: unknown, status = 200): Response => {
			return new Response(JSON.stringify(body), { status })
		}
	} as unknown as Context<ApiEnv>
}
