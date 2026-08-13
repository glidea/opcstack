import { expect } from 'vitest'
import { authorizeApiAccess, type OAuthTokenSet } from './oauth'
import { browserHeaders, type CookieJar, readJson, requireBookmark } from './http'

type GeneralConfig = {
	docs_enabled: boolean
	version: number
}

type StorageConfig = {
	allowed_content_types: string[]
	max_upload_bytes: number
	version: number
}

type OAuthGrant = {
	id: string
	scopes: string[]
	status: 'pending' | 'active' | 'revoked'
	created_at: number
}

export async function verifyConfigurationAndOAuthJourney(input: {
	appBaseUrl: string
	cookies: CookieJar
}): Promise<void> {
	const scopes: string[] = ['config:storage:read', 'config:storage:write']
	const originalGeneral: GeneralConfig = await callAdmin<GeneralConfig>(
		input,
		'get_general_config',
		{}
	)
	let generalVersion: number = originalGeneral.version
	let storageVersion: number | undefined
	let grantId: string | undefined
	let token: OAuthTokenSet | undefined
	try {
		const generalResponse: Response = await callAdminRaw(input, 'update_general_config', {
			docs_enabled: false,
			expected_version: generalVersion
		})
		expect(generalResponse.status).toBe(200)
		const savedGeneral: GeneralConfig = await readJson<GeneralConfig>(generalResponse)
		generalVersion = savedGeneral.version
		const generalBookmark: string = requireBookmark(generalResponse)
		const pageResponse: Response = await fetch(`${input.appBaseUrl}/en`, {
			headers: {
				cookie: `${input.cookies.toHeader()}; d1_meta_bookmark=${encodeURIComponent(generalBookmark)}`
			}
		})
		const pageHtml: string = await pageResponse.text()
		expect(pageResponse.status).toBe(200)
		expect(pageHtml).toMatch(/data-design="(?:apple-saas|brutalism)"/)
		expect(pageHtml).not.toContain('href="/en/docs"')

		token = await authorizeApiAccess({
			appBaseUrl: input.appBaseUrl,
			cookies: input.cookies,
			scopes
		})
		const storageResponse: Response = await callOAuthRaw(
			input.appBaseUrl,
			token.access_token,
			'get_storage_config',
			{}
		)
		expect(storageResponse.status, await storageResponse.clone().text()).toBe(200)
		const originalStorage: StorageConfig = await readJson<StorageConfig>(storageResponse)
		storageVersion = originalStorage.version
		const forbiddenResponse: Response = await callOAuthRaw(
			input.appBaseUrl,
			token.access_token,
			'get_ai_config',
			{}
		)
		expect(forbiddenResponse.status).toBe(403)
		expect(await readJson<{ code: string }>(forbiddenResponse)).toEqual({
			code: 'FORBIDDEN',
			message: 'Required API scope is missing'
		})
		const updateStorageResponse: Response = await callOAuthRaw(
			input.appBaseUrl,
			token.access_token,
			'update_storage_config',
			{
				allowed_content_types: originalStorage.allowed_content_types,
				max_upload_bytes: originalStorage.max_upload_bytes + 1,
				expected_version: storageVersion
			}
		)
		expect(updateStorageResponse.status).toBe(200)
		const savedStorage: StorageConfig = await readJson<StorageConfig>(updateStorageResponse)
		storageVersion = savedStorage.version
		expect(savedStorage.max_upload_bytes).toBe(originalStorage.max_upload_bytes + 1)

		const grantsResponse: Response = await fetch(`${input.appBaseUrl}/api/oauth/list_grants`, {
			method: 'POST',
			headers: browserHeaders(input.appBaseUrl, input.cookies),
			body: JSON.stringify({})
		})
		expect(grantsResponse.status).toBe(200)
		const grants: { items: OAuthGrant[] } = await readJson<{ items: OAuthGrant[] }>(grantsResponse)
		const activeGrant: OAuthGrant | undefined = grants.items
			.filter((grant: OAuthGrant): boolean => grant.status === 'active')
			.filter((grant: OAuthGrant): boolean => grant.scopes.join(' ') === scopes.join(' '))
			.sort((left: OAuthGrant, right: OAuthGrant): number => right.created_at - left.created_at)[0]
		expect(activeGrant).toBeDefined()
		grantId = activeGrant?.id

		const revokeResponse: Response = await fetch(`${input.appBaseUrl}/api/oauth/revoke_grant`, {
			method: 'POST',
			headers: browserHeaders(input.appBaseUrl, input.cookies),
			body: JSON.stringify({ grant_id: grantId })
		})
		expect(revokeResponse.status).toBe(200)

		const revokedAccessResponse: Response = await callOAuthRaw(
			input.appBaseUrl,
			token.access_token,
			'get_storage_config',
			{}
		)
		expect(revokedAccessResponse.status).toBe(401)
		const refreshResponse: Response = await fetch(`${input.appBaseUrl}/api/auth/oauth2/token`, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'refresh_token',
				client_id: 'opc-cli',
				refresh_token: token.refresh_token,
				resource: input.appBaseUrl
			}).toString()
		})
		expect(refreshResponse.ok).toBe(false)
	} finally {
		if (storageVersion !== undefined) {
			const currentStorage: StorageConfig = await callAdmin<StorageConfig>(
				input,
				'get_storage_config',
				{}
			)
			if (currentStorage.version === storageVersion) {
				await callAdmin<StorageConfig>(input, 'update_storage_config', {
					allowed_content_types: currentStorage.allowed_content_types,
					max_upload_bytes: currentStorage.max_upload_bytes - 1,
					expected_version: currentStorage.version
				})
			}
		}
		await callAdmin<GeneralConfig>(input, 'update_general_config', {
			docs_enabled: originalGeneral.docs_enabled,
			expected_version: generalVersion
		})
	}
}

async function callAdmin<T>(
	input: { appBaseUrl: string; cookies: CookieJar },
	endpoint: string,
	body: unknown
): Promise<T> {
	const response: Response = await callAdminRaw(input, endpoint, body)
	if (!response.ok) {
		throw new Error(`${endpoint} failed with ${response.status}: ${await response.text()}`)
	}
	return readJson<T>(response)
}

function callAdminRaw(
	input: { appBaseUrl: string; cookies: CookieJar },
	endpoint: string,
	body: unknown
): Promise<Response> {
	return fetch(`${input.appBaseUrl}/api/admin/${endpoint}`, {
		method: 'POST',
		headers: browserHeaders(input.appBaseUrl, input.cookies),
		body: JSON.stringify(body)
	})
}

function callOAuthRaw(
	appBaseUrl: string,
	accessToken: string,
	endpoint: string,
	body: unknown
): Promise<Response> {
	return fetch(`${appBaseUrl}/api/admin/${endpoint}`, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${accessToken}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify(body)
	})
}
