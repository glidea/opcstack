import { describe, expect, test } from 'vitest'
import type { MetaDb } from '../db'
import type { AIChannel, AISettingsDocument, SystemSettings } from '../db/schema.meta'
import { decryptConfigSecret, encryptConfigSecret } from '../config/crypto'
import {
	AIConfigError,
	createAIChannel,
	getAIRuntimeConfig,
	updateAIChannel,
	validateAISettings
} from './config'

describe('AI D1 configuration', (): void => {
	test('rejects an enabled provider without a complete endpoint', (): void => {
		const settings: AISettingsDocument = createAISettings()
		settings.providers.chatOpenai = {
			enabled: true,
			baseUrl: 'https://api.example.com/v1',
			defaultModel: null,
			apiKey: null
		}

		expect((): void => validateAISettings(settings)).toThrowError(
			new AIConfigError('AI_PROVIDER_CONFIG_INVALID')
		)
	})

	test('rejects a channel provider outside its area', async (): Promise<void> => {
		await expect(
			createAIChannel({} as MetaDb, createEncryptionKey(), {
				id: 'invalid-channel',
				area: 'video',
				provider: 'openai',
				name: 'Invalid channel',
				baseUrl: 'https://api.example.com/v1',
				models: ['model-1'],
				priceMultiplier: 1,
				apiKey: 'secret',
				enabled: true,
				nowMs: 1000
			})
		).rejects.toEqual(new AIConfigError('AI_CHANNEL_CONFIG_INVALID'))
	})

	test('rejects duplicate channel models', async (): Promise<void> => {
		await expect(
			createAIChannel({} as MetaDb, createEncryptionKey(), {
				id: 'openai-official',
				area: 'image',
				provider: 'openai',
				name: 'OpenAI official',
				baseUrl: 'https://api.openai.com/v1',
				models: ['gpt-image-2', 'gpt-image-2'],
				priceMultiplier: 1,
				apiKey: 'secret',
				enabled: true,
				nowMs: 1000
			})
		).rejects.toEqual(new AIConfigError('AI_CHANNEL_CONFIG_INVALID'))
	})

	test('encrypts a channel credential before inserting it', async (): Promise<void> => {
		let inserted: Partial<AIChannel> | undefined
		const db: MetaDb = {
			insert: (): Record<string, unknown> => ({
				values: (values: Partial<AIChannel>): Record<string, unknown> => {
					inserted = values
					return {
						onConflictDoNothing: (): Record<string, unknown> => ({
							returning: async (): Promise<AIChannel[]> => [values as AIChannel]
						})
					}
				}
			})
		} as unknown as MetaDb

		await createAIChannel(db, createEncryptionKey(), createChannelInput('provider-secret'))

		expect({
			storedPlaintext: inserted?.apiKeyCiphertext === 'provider-secret',
			decrypted: await decryptConfigSecret(createEncryptionKey(), {
				ciphertext: inserted?.apiKeyCiphertext ?? '',
				iv: inserted?.apiKeyIv ?? ''
			})
		}).toEqual({ storedPlaintext: false, decrypted: 'provider-secret' })
	})

	test('replaces a channel credential with new encrypted material', async (): Promise<void> => {
		const oldSecret = await encryptConfigSecret(createEncryptionKey(), 'old-secret')
		const current: AIChannel = createChannelRow(oldSecret.ciphertext, oldSecret.iv)
		let updated: Partial<AIChannel> | undefined
		const db: MetaDb = {
			query: {
				aiChannel: { findFirst: async (): Promise<AIChannel> => current }
			},
			update: (): Record<string, unknown> => ({
				set: (values: Partial<AIChannel>): Record<string, unknown> => {
					updated = values
					return {
						where: (): Record<string, unknown> => ({
							returning: async (): Promise<AIChannel[]> => [
								{ ...current, ...values, version: 2 } as AIChannel
							]
						})
					}
				}
			})
		} as unknown as MetaDb

		await updateAIChannel(db, createEncryptionKey(), {
			...createChannelInput('unused'),
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

	test('decrypts one D1 snapshot for provider and channel execution', async (): Promise<void> => {
		const providerSecret = await encryptConfigSecret(createEncryptionKey(), 'provider-secret')
		const channelSecret = await encryptConfigSecret(createEncryptionKey(), 'channel-secret')
		const settings: AISettingsDocument = createAISettings()
		settings.providers.chatOpenai = {
			enabled: true,
			baseUrl: 'https://chat.example.com/v1',
			defaultModel: 'chat-model',
			apiKey: providerSecret
		}
		const db: MetaDb = {
			query: {
				systemSettings: {
					findFirst: async (): Promise<SystemSettings> => ({
						aiConfig: settings,
						aiVersion: 4
					}) as SystemSettings
				},
				aiChannel: {
					findMany: async (): Promise<AIChannel[]> => [
						createChannelRow(channelSecret.ciphertext, channelSecret.iv)
					]
				}
			}
		} as unknown as MetaDb

		const result = await getAIRuntimeConfig(db, createEncryptionKey())

		expect({
			providerKey: result.providers.chatOpenai?.endpoint.apiKey,
			channelKey: result.channels[0]?.endpoint.apiKey,
			version: result.version
		}).toEqual({ providerKey: 'provider-secret', channelKey: 'channel-secret', version: 4 })
	})
})

function createChannelInput(apiKey: string): {
	id: string
	area: 'image'
	provider: string
	name: string
	baseUrl: string
	models: string[]
	priceMultiplier: number
	apiKey: string
	enabled: boolean
	nowMs: number
} {
	return {
		id: 'openai-official',
		area: 'image',
		provider: 'openai',
		name: 'OpenAI official',
		baseUrl: 'https://api.openai.com/v1',
		models: ['gpt-image-2'],
		priceMultiplier: 1,
		apiKey,
		enabled: true,
		nowMs: 1000
	}
}

function createChannelRow(apiKeyCiphertext: string, apiKeyIv: string): AIChannel {
	return {
		...createChannelInput('unused'),
		apiKeyCiphertext,
		apiKeyIv,
		version: 1,
		createdAt: 1000,
		updatedAt: 1000
	}
}

function createAISettings(): AISettingsDocument {
	const emptyProvider = {
		enabled: false,
		baseUrl: null,
		defaultModel: null,
		apiKey: null
	}
	return {
		routing: { errorWeight: 1, latencyWeight: 0.8, priceWeight: 0.2 },
		taskRetentionDays: 30,
		providers: {
			chatOpenai: { ...emptyProvider },
			imageGemini: { ...emptyProvider },
			imageOpenai: { ...emptyProvider },
			imageSeedream: { ...emptyProvider },
			imageAliyun: { ...emptyProvider },
			ttsGemini: { ...emptyProvider },
			ttsSeed: { ...emptyProvider },
			realtimeDoubao: { ...emptyProvider },
			videoSeedance: { ...emptyProvider }
		}
	}
}

function createEncryptionKey(): string {
	return btoa(String.fromCharCode(...new Uint8Array(32).fill(7)))
}
