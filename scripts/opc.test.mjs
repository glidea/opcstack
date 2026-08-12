import { describe, expect, it } from 'vitest'
import {
	buildApiUrl,
	createRefreshTokenRequest,
	createEmptyCredentialStore,
	createPkcePair,
	getConnection,
	injectAccessToken,
	parseScopes,
	removeConnection,
	resolveSameOriginUrl,
	setConnection
} from './opc.mjs'

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
			'Only relative API paths can receive an access token'
		)
	})

	it('rejects same-origin absolute URLs', () => {
		expect(() => resolveSameOriginUrl('https://app.example.com', 'https://app.example.com/api/data')).toThrow(
			'Only relative API paths can receive an access token'
		)
	})

	it('does not allow callers to provide Authorization', () => {
		expect(() => injectAccessToken({ Authorization: 'Bearer user-token' }, 'access-token')).toThrow(
			'Authorization header is managed by opc'
		)
	})

	it('stores and removes named project connections independently', () => {
		const emptyStore = createEmptyCredentialStore()
		const withLocal = setConnection(emptyStore, 'shop-local', {
			server: 'http://localhost:5173',
			access_token: 'local-access',
			refresh_token: 'local-refresh',
			expires_at: 1000,
			scopes: ['config:ai:read']
		})
		const withBoth = setConnection(withLocal, 'shop-prod', {
			server: 'https://shop.example.com',
			access_token: 'prod-access',
			refresh_token: 'prod-refresh',
			expires_at: 2000,
			scopes: ['config:ai:write']
		})

		expect(getConnection(withBoth, 'shop-local').server).toBe('http://localhost:5173')
		expect(getConnection(withBoth, 'shop-prod').server).toBe('https://shop.example.com')
		expect(removeConnection(withBoth, 'shop-local')).toEqual({
			connections: {
				'shop-prod': getConnection(withBoth, 'shop-prod')
			}
		})
	})

	it('refreshes against the named connection server and token', () => {
		const request = createRefreshTokenRequest({
			server: 'https://shop.example.com',
			access_token: 'access-token',
			refresh_token: 'refresh-token',
			expires_at: 1000,
			scopes: ['config:ai:read']
		})

		expect(request.url).toBe('https://shop.example.com/api/auth/oauth2/token')
		expect(request.body.get('refresh_token')).toBe('refresh-token')
		expect(request.body.get('resource')).toBe('https://shop.example.com')
	})
})
