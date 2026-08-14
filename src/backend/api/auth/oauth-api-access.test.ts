import { describe, expect, it } from 'vitest'
import type { MetaDb } from '../../db'
import {
	API_SCOPES,
	OAuthApiAccessError,
	POLL_INTERVAL_SECONDS,
	canonicalizeScopes,
	completeAuthorization,
	createAuthorizationRequest,
	createProtocolSecret,
	getAuthorizationStatus,
	pollAuthorization
} from './oauth-api-access'

describe('OAuth API access domain', () => {
	it('owns the complete public scope vocabulary', () => {
		expect(API_SCOPES).toContain('credits:read')
		expect(API_SCOPES).toContain('config:ai:write')
		expect(API_SCOPES).not.toContain('admin:users:write')
		expect(API_SCOPES).not.toContain('config:storage:read')
		expect(API_SCOPES).not.toContain('config:storage:write')
	})

	it('sorts and removes duplicate registered scopes', () => {
		expect(canonicalizeScopes(['credits:write', 'credits:read', 'credits:write'])).toEqual([
			'credits:read',
			'credits:write'
		])
	})

	it('rejects unknown scopes', () => {
		expect(() => canonicalizeScopes(['reports:read'])).toThrowError(
			new OAuthApiAccessError('INVALID_SCOPE', 'Invalid API scope: reports:read')
		)
	})

	it('creates a protocol secret whose hash cannot be used as the secret', async () => {
		const secret = await createProtocolSecret()

		expect(secret.value).toMatch(/^[A-Za-z0-9_-]{32,}$/)
		expect(secret.hash).not.toBe(secret.value)
		expect(secret.hash).toMatch(/^[A-Za-z0-9_-]{43}$/)
	})

	it('expires pending authorization requests at the expiry time', () => {
		expect(getAuthorizationStatus('pending', 1000, 1001)).toBe('expired')
		expect(getAuthorizationStatus('pending', 1000, 1000)).toBe('pending')
	})

	it('publishes the fixed polling interval', () => {
		expect(POLL_INTERVAL_SECONDS).toBe(5)
	})

	it('consumes an authorization code only once', async () => {
		const db = createAuthorizationDb()
		const authorization = await createAuthorizationRequest(
			db,
			{
				clientId: 'opc-cli',
				codeChallenge: 'A'.repeat(43),
				codeChallengeMethod: 'S256',
				scopes: ['credits:read']
			},
			1000
		)

		await completeAuthorization(
			db,
			{ state: authorization.state, authorizationCode: 'oauth-code' },
			2000
		)
		const first = await pollAuthorization(db, authorization.deviceCode, 2001)
		const second = await pollAuthorization(db, authorization.deviceCode, 2002)

		expect(first).toEqual({
			status: 'authorized',
			code: 'oauth-code',
			redirectUri: '/api/oauth/authorization_callback'
		})
		expect(second).toEqual({ status: 'consumed' })
	})
})

function createAuthorizationDb(): MetaDb {
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
			oauthAuthorizationRequest: {
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
