import { describe, expect, test } from 'vitest'
import type { MetaDb } from '../db'
import type { AIProvider, AISettingsDocument, SystemSettings } from '../db/schema.meta'
import { decryptConfigSecret, encryptConfigSecret } from '../config/crypto'
import {
	AIConfigError,
	createAIProvider,
	getAIProviderCandidates,
	getAIRuntimeConfig,
	updateAIProvider,
	validateAISettings
} from './config'

describe('AI D1 configuration', (): void => {
	test('rejects routing weights whose sum is zero', (): void => {
		const settings: AISettingsDocument = {
			routing: { errorWeight: 0, latencyWeight: 0, priceWeight: 0 },
			taskRetentionDays: 30
		}

		expect((): void => validateAISettings(settings)).toThrowError(
			new AIConfigError('AI_CONFIG_INVALID')
		)
	})

	test('rejects duplicate provider models', async (): Promise<void> => {
		await expect(
			createAIProvider({} as MetaDb, createEncryptionKey(), {
				...createProviderInput('provider-secret'),
				models: ['gpt-image-2', 'gpt-image-2']
			})
		).rejects.toEqual(new AIConfigError('AI_PROVIDER_CONFIG_INVALID'))
	})

	test('generates provider ID without storing a copy of the official endpoint', async (): Promise<void> => {
		let inserted: Partial<AIProvider> | undefined
		const db: MetaDb = {
			insert: (): Record<string, unknown> => ({
				values: (values: Partial<AIProvider>): Record<string, unknown> => {
					inserted = values
					return {
						onConflictDoNothing: (): Record<string, unknown> => ({
							returning: async (): Promise<AIProvider[]> => [values as AIProvider]
						})
					}
				}
			})
		} as unknown as MetaDb

		await createAIProvider(db, createEncryptionKey(), {
			name: 'Google Gemini image',
			type: 'image_gemini',
			baseUrl: null,
			models: ['gemini-2.5-flash-image'],
			priceMultiplier: 1,
			apiKey: 'provider-secret',
			enabled: true,
			nowMs: 1000
		} as Parameters<typeof createAIProvider>[2])

		expect({
			id: inserted?.id,
			baseUrl: inserted?.baseUrl
		}).toEqual({
			id: expect.stringMatching(/^[0-9a-f-]{36}$/),
			baseUrl: null
		})
	})

	test('requires a base URL for OpenAI-compatible providers', async (): Promise<void> => {
		await expect(
			createAIProvider({} as MetaDb, createEncryptionKey(), {
				...createProviderInput('provider-secret'),
				baseUrl: null
			} as Parameters<typeof createAIProvider>[2])
		).rejects.toEqual(new AIConfigError('AI_PROVIDER_CONFIG_INVALID'))
	})

	test('encrypts a provider credential before inserting it', async (): Promise<void> => {
		let inserted: Partial<AIProvider> | undefined
		const db: MetaDb = {
			insert: (): Record<string, unknown> => ({
				values: (values: Partial<AIProvider>): Record<string, unknown> => {
					inserted = values
					return {
						onConflictDoNothing: (): Record<string, unknown> => ({
							returning: async (): Promise<AIProvider[]> => [values as AIProvider]
						})
					}
				}
			})
		} as unknown as MetaDb

		await createAIProvider(db, createEncryptionKey(), createProviderInput('provider-secret'))

		expect({
			storedPlaintext: inserted?.apiKeyCiphertext === 'provider-secret',
			decrypted: await decryptConfigSecret(createEncryptionKey(), {
				ciphertext: inserted?.apiKeyCiphertext ?? '',
				iv: inserted?.apiKeyIv ?? ''
			})
		}).toEqual({ storedPlaintext: false, decrypted: 'provider-secret' })
	})

	test('replaces a provider credential with new encrypted material', async (): Promise<void> => {
		const oldSecret = await encryptConfigSecret(createEncryptionKey(), 'old-secret')
		const current: AIProvider = createProviderRow(oldSecret.ciphertext, oldSecret.iv)
		let updated: Partial<AIProvider> | undefined
		const db: MetaDb = {
			query: {
				aiProvider: { findFirst: async (): Promise<AIProvider> => current }
			},
			update: (): Record<string, unknown> => ({
				set: (values: Partial<AIProvider>): Record<string, unknown> => {
					updated = values
					return {
						where: (): Record<string, unknown> => ({
							returning: async (): Promise<AIProvider[]> => [
								{ ...current, ...values, version: 2 } as AIProvider
							]
						})
					}
				}
			})
		} as unknown as MetaDb

		await updateAIProvider(db, createEncryptionKey(), {
			...createProviderInput('unused'),
			apiKey: { action: 'replace', value: 'new-secret' },
			expectedVersion: 1
		})

		expect({
			reusedCiphertext: updated?.apiKeyCiphertext === oldSecret.ciphertext,
			decrypted: await decryptConfigSecret(createEncryptionKey(), {
				ciphertext: updated?.apiKeyCiphertext ?? '',
				iv: updated?.apiKeyIv ?? ''
			})
		}).toEqual({ reusedCiphertext: false, decrypted: 'new-secret' })
	})

	test('decrypts one D1 snapshot into provider runtime configuration', async (): Promise<void> => {
		const providerSecret = await encryptConfigSecret(createEncryptionKey(), 'provider-secret')
		const db: MetaDb = {
			query: {
				systemSettings: {
					findFirst: async (): Promise<SystemSettings> => ({
						aiConfig: createAISettings(),
						aiVersion: 4
					}) as SystemSettings
				},
				aiProvider: {
					findMany: async (): Promise<AIProvider[]> => [
						createProviderRow(providerSecret.ciphertext, providerSecret.iv)
					]
				}
			}
		} as unknown as MetaDb

		const result = await getAIRuntimeConfig(db, createEncryptionKey())

		expect({
			providerKey: result.providers[0]?.endpoint.apiKey,
			providerType: result.providers[0]?.type,
			version: result.version
		}).toEqual({ providerKey: 'provider-secret', providerType: 'image_openai', version: 4 })
	})

	test('filters enabled providers by type and model before routing', (): void => {
		const provider: ReturnType<typeof createRuntimeProvider> = createRuntimeProvider()
		const candidates = getAIProviderCandidates(
			{
				...createAISettings(),
				providers: [
					provider,
					{ ...provider, id: 'disabled', enabled: false },
					{ ...provider, id: 'wrong-type', type: 'image_gemini' }
				],
				version: 1
			},
			'image_openai',
			'gpt-image-2'
		)

		expect(candidates.map((item): string => item.id)).toEqual(['openai-official'])
	})
})

function createProviderInput(apiKey: string): {
	id: string
	name: string
	type: 'image_openai'
	baseUrl: string
	models: string[]
	priceMultiplier: number
	apiKey: string
	enabled: boolean
	nowMs: number
} {
	return {
		id: 'openai-official',
		name: 'OpenAI official',
		type: 'image_openai',
		baseUrl: 'https://api.openai.com/v1',
		models: ['gpt-image-2'],
		priceMultiplier: 1,
		apiKey,
		enabled: true,
		nowMs: 1000
	}
}

function createProviderRow(apiKeyCiphertext: string, apiKeyIv: string): AIProvider {
	return {
		...createProviderInput('unused'),
		apiKeyCiphertext,
		apiKeyIv,
		version: 1,
		createdAt: 1000,
		updatedAt: 1000
	}
}

function createRuntimeProvider(): {
	id: string
	name: string
	type: 'image_openai'
	models: string[]
	priceMultiplier: number
	endpoint: { baseURL: string; apiKey: string }
	enabled: boolean
} {
	return {
		id: 'openai-official',
		name: 'OpenAI official',
		type: 'image_openai',
		models: ['gpt-image-2'],
		priceMultiplier: 1,
		endpoint: { baseURL: 'https://api.openai.com/v1', apiKey: 'provider-secret' },
		enabled: true
	}
}

function createAISettings(): AISettingsDocument {
	return {
		routing: { errorWeight: 1, latencyWeight: 0.8, priceWeight: 0.2 },
		taskRetentionDays: 30
	}
}

function createEncryptionKey(): string {
	return btoa(String.fromCharCode(...new Uint8Array(32).fill(7)))
}
