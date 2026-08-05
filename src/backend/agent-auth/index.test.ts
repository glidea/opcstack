import { describe, expect, it } from 'vitest'
import type { MetaDb } from '../db'
import {
	AgentAuthError,
	POLL_INTERVAL_SECONDS,
	canonicalizeScopes,
	completeRelay,
	createProtocolSecret,
	createRelayRequest,
	getRelayStatus,
	pollRelay
} from './index'

describe('agent authorization domain', () => {
	it('sorts and removes duplicate scopes', () => {
		expect(canonicalizeScopes(['reports:write', 'profile:read', 'reports:write'])).toBe(
			'profile:read reports:write'
		)
	})

	it('rejects malformed scopes', () => {
		expect(() => canonicalizeScopes(['reports read'])).toThrowError(
			new AgentAuthError('INVALID_SCOPE', 'Invalid scope')
		)
	})

	it('creates a secret with a hash and never returns the hash as the secret', async () => {
		const secret = await createProtocolSecret()

		expect(secret.value).toMatch(/^[A-Za-z0-9_-]{32,}$/)
		expect(secret.hash).not.toBe(secret.value)
		expect(secret.hash).toMatch(/^[A-Za-z0-9_-]{43}$/)
	})

	it('expires pending relay requests after the expiry time', () => {
		expect(getRelayStatus('pending', 1000, 1001)).toBe('expired')
		expect(getRelayStatus('pending', 1000, 1000)).toBe('pending')
	})

	it('publishes the fixed polling interval', () => {
		expect(POLL_INTERVAL_SECONDS).toBe(5)
	})

	it('consumes an authorized relay only once', async () => {
		const db = createRelayDb()
		const relay = await createRelayRequest(db, {
			codeChallenge: 'A'.repeat(43),
			codeChallengeMethod: 'S256',
			scopes: ['reports:write']
		}, 1000)

		await completeRelay(db, { state: relay.state, authorizationCode: 'oauth-code' }, 2000)
		const first = await pollRelay(db, relay.deviceCode, 2001)
		const second = await pollRelay(db, relay.deviceCode, 2002)

		expect(first).toEqual({
			status: 'authorized',
			code: 'oauth-code',
			redirectUri: '/api/agent/authorization_callback'
		})
		expect(second).toEqual({ status: 'consumed' })
	})
})

function createRelayDb(): MetaDb {
	let row: Record<string, unknown> | undefined
	return {
		insert: () => ({
			values: (input: Record<string, unknown>) => ({
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
				findFirst: async (): Promise<Record<string, unknown> | undefined> => row
			}
		},
		update: () => {
			let changes: Record<string, unknown> = {}
			const result = {
				set: (nextChanges: Record<string, unknown>) => {
					changes = nextChanges
					return result
				},
				where: () => result,
				run: async (): Promise<void> => {
					if (row) row = { ...row, ...changes }
				},
				returning: async (): Promise<Array<{ authorizationCode: string | null }>> => {
					if (row) row = { ...row, ...changes }
					return [{ authorizationCode: String(row?.['authorizationCode'] ?? '') || null }]
				}
			}
			return result
		}
	} as unknown as MetaDb
}
