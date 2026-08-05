import { describe, expect, it } from 'vitest'
import {
	AgentAuthError,
	POLL_INTERVAL_SECONDS,
	canonicalizeScopes,
	createProtocolSecret,
	getRelayStatus
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
})
