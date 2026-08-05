import { describe, expect, it } from 'vitest'
import { buildApiUrl, createPkcePair, parseScopes } from './opc.mjs'

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
})
