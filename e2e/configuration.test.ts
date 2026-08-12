import { beforeAll, describe, expect, test } from 'vitest'

type GeneralConfig = {
	design_system: 'apple-saas' | 'brutalism'
	docs_enabled: boolean
	version: number
}

type StorageConfig = {
	allowed_content_types: string[]
	max_upload_bytes: number
	version: number
}

const appBaseUrl: string = process.env['APP_BASE_URL'] ?? 'http://localhost:5173'
const adminApiToken: string = process.env['E2E_ADMIN_API_TOKEN'] ?? 'admin-token'
const remote: boolean = process.env['E2E_REMOTE'] === '1'

describe.skipIf(remote)('dynamic configuration e2e', () => {
	beforeAll(async (): Promise<void> => {
		const response: Response = await fetch(`${appBaseUrl}/api/health`)
		if (response.status !== 200) {
			throw new Error('dev server is not ready for e2e tests')
		}
	})

	test('saved General and Storage configuration affects the next operation', async (): Promise<void> => {
		const originalGeneral: GeneralConfig = await readConfig<GeneralConfig>('get_general_config')
		const originalStorage: StorageConfig = await readConfig<StorageConfig>('get_storage_config')
		const nextDesignSystem: GeneralConfig['design_system'] =
			originalGeneral.design_system === 'apple-saas' ? 'brutalism' : 'apple-saas'

		let generalVersion: number = originalGeneral.version
		let storageVersion: number = originalStorage.version
		try {
			const generalResponse: Response = await callAdminConfig('update_general_config', {
				design_system: nextDesignSystem,
				docs_enabled: false,
				expected_version: generalVersion
			})
			const savedGeneral: GeneralConfig = await readJson<GeneralConfig>(generalResponse)
			generalVersion = savedGeneral.version
			const generalBookmark: string = requireBookmark(generalResponse)

			const pageResponse: Response = await fetch(`${appBaseUrl}/en`, {
				headers: {
					cookie: `d1_meta_bookmark=${encodeURIComponent(generalBookmark)}`
				}
			})
			const pageHtml: string = await pageResponse.text()
			expect(pageHtml).toContain(`data-design="${nextDesignSystem}"`)
			expect(pageHtml).not.toContain('href="/en/docs"')

			const docsResponse: Response = await fetch(`${appBaseUrl}/en/docs`, {
				headers: {
					cookie: `d1_meta_bookmark=${encodeURIComponent(generalBookmark)}`
				}
			})
			expect(docsResponse.status).toBe(404)

			const storageResponse: Response = await callAdminConfig('update_storage_config', {
				allowed_content_types: ['text/plain'],
				max_upload_bytes: 4,
				expected_version: storageVersion
			})
			const savedStorage: StorageConfig = await readJson<StorageConfig>(storageResponse)
			storageVersion = savedStorage.version
			const storageBookmark: string = requireBookmark(storageResponse)

			const uploadResponse: Response = await fetch(
				`${appBaseUrl}/api/admin/r2/public/e2e/configuration.txt`,
				{
					method: 'PUT',
					headers: {
						authorization: `Bearer ${adminApiToken}`,
						'content-type': 'text/plain',
						'content-length': '5',
						'x-d1-meta-bookmark': storageBookmark
					},
					body: '12345'
				}
			)
			const uploadPayload: { code?: string } = await uploadResponse.json()
			expect({ status: uploadResponse.status, code: uploadPayload.code }).toEqual({
				status: 400,
				code: 'R2_USER_UPLOAD_SIZE_TOO_LARGE'
			})
		} finally {
			await callAdminConfig('update_general_config', {
				design_system: originalGeneral.design_system,
				docs_enabled: originalGeneral.docs_enabled,
				expected_version: generalVersion
			})
			await callAdminConfig('update_storage_config', {
				allowed_content_types: originalStorage.allowed_content_types,
				max_upload_bytes: originalStorage.max_upload_bytes,
				expected_version: storageVersion
			})
		}
	})
})

async function readConfig<TConfig>(endpoint: string): Promise<TConfig> {
	const response: Response = await callAdminConfig(endpoint, {})
	return readJson<TConfig>(response)
}

async function callAdminConfig(endpoint: string, body: unknown): Promise<Response> {
	const response: Response = await fetch(`${appBaseUrl}/api/admin/${endpoint}`, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${adminApiToken}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify(body)
	})
	if (!response.ok) {
		throw new Error(`${endpoint} failed with ${response.status}: ${await response.text()}`)
	}
	return response
}

async function readJson<T>(response: Response): Promise<T> {
	return response.json() as Promise<T>
}

function requireBookmark(response: Response): string {
	const bookmark: string | null = response.headers.get('x-d1-meta-bookmark')
	if (!bookmark) {
		throw new Error('CONFIGURATION_BOOKMARK_MISSING')
	}
	return bookmark
}
