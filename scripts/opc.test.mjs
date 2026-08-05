import { describe, expect, it } from 'vitest'
import { buildApiUrl, createPkcePair, injectAccessToken, parseScopes, resolveSameOriginUrl } from './opc.mjs'

describe('opc cli protocol helpers', () => {
	it('creates a PKCE verifier and matching challenge shape', () => {
		const pair = createPkcePair()
		expect(pair.verifier).toMatch(/^[A-Za-z0-9_-]+$/)
		expect(pair.challenge).toMatch(/^[A-Za-z0-9_-]+$/)
		expect(pair.challenge).not.toBe(pair.verifier)
	})

	it('parses comma separated scopes', () => {
		expect(parseScopes('reports:read, reports:write')).toEqual(['reports:read', 'reports:write'])
	})

	it('resolves API paths against the configured server', () => {
		expect(buildApiUrl('https://app.example.com/', '/api/reports')).toBe(
			'https://app.example.com/api/reports'
		)
	})

	it('rejects cross-origin token requests', () => {
		expect(() => resolveSameOriginUrl('https://app.example.com', 'https://evil.example.com/data')).toThrow(
			'Only same-origin URLs can receive an Agent token'
		)
	})

	it('does not allow callers to provide Authorization', () => {
		expect(() => injectAccessToken({ Authorization: 'Bearer user-token' }, 'agent-token')).toThrow(
			'Authorization header is managed by opc'
		)
	})
})
