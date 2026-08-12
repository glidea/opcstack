import type { Context } from 'hono'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ApiEnv } from '..'
import type { MetaDb } from '../../db'
import type { AIConfigView } from '../../ai/config'
import { AIConfigError } from '../../ai/config'
import * as aiConfig from '../../ai/config'
import { getAIConfigHandler, updateAIChannelHandler } from './configuration'

describe('AI configuration handlers', (): void => {
	afterEach((): void => {
		vi.restoreAllMocks()
	})

	test('returns only configured state for provider and channel credentials', async (): Promise<void> => {
		vi.spyOn(aiConfig, 'getAIConfig').mockResolvedValue(createAIConfig())

		const response: Response = await getAIConfigHandler(createContext({}))
		const body: Record<string, unknown> = await response.json()

		expect({
			status: response.status,
			provider: (body['providers'] as Array<Record<string, unknown>>)[0],
			channel: (body['channels'] as Array<Record<string, unknown>>)[0],
			serialized: JSON.stringify(body)
		}).toEqual({
			status: 200,
			provider: {
				id: 'chat_openai',
				area: 'chat',
				provider: 'openai',
				enabled: true,
				base_url: 'https://chat.example.com/v1',
				default_model: 'chat-model',
				api_key_configured: true
			},
			channel: {
				id: 'openai-official',
				area: 'image',
				provider: 'openai',
				name: 'OpenAI official',
				base_url: 'https://api.openai.com/v1',
				models: ['gpt-image-2'],
				price_multiplier: 1,
				api_key_configured: true,
				enabled: true,
				version: 2
			},
			serialized: JSON.stringify(body)
		})
		expect(JSON.stringify(body)).not.toContain('ciphertext')
		expect(JSON.stringify(body)).not.toContain('provider-secret')
	})

	test('maps stale channel updates to CONFIG_CONFLICT', async (): Promise<void> => {
		vi.spyOn(aiConfig, 'updateAIChannel').mockRejectedValue(
			new AIConfigError('AI_CHANNEL_CONFLICT')
		)

		const response: Response = await updateAIChannelHandler(
			createContext({
				id: 'openai-official',
				area: 'image',
				provider: 'openai',
				name: 'OpenAI official',
				base_url: 'https://api.openai.com/v1',
				models: ['gpt-image-2'],
				price_multiplier: 1,
				api_key: { action: 'keep' },
				enabled: true,
				expected_version: 1
			})
		)

		expect({ status: response.status, body: await response.json() }).toEqual({
			status: 409,
			body: { code: 'CONFIG_CONFLICT', message: 'Configuration has changed' }
		})
	})
})

function createAIConfig(): AIConfigView {
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
			chatOpenai: {
				enabled: true,
				baseUrl: 'https://chat.example.com/v1',
				defaultModel: 'chat-model',
				apiKey: { ciphertext: 'provider-secret', iv: 'iv' }
			},
			imageGemini: { ...emptyProvider },
			imageOpenai: { ...emptyProvider },
			imageSeedream: { ...emptyProvider },
			imageAliyun: { ...emptyProvider },
			ttsGemini: { ...emptyProvider },
			ttsSeed: { ...emptyProvider },
			realtimeDoubao: { ...emptyProvider },
			videoSeedance: { ...emptyProvider }
		},
		channels: [
			{
				id: 'openai-official',
				area: 'image',
				provider: 'openai',
				name: 'OpenAI official',
				baseUrl: 'https://api.openai.com/v1',
				models: ['gpt-image-2'],
				priceMultiplier: 1,
				apiKeyCiphertext: 'channel-secret',
				apiKeyIv: 'iv',
				enabled: true,
				version: 2,
				createdAt: 1000,
				updatedAt: 2000
			}
		],
		version: 3
	}
}

function createContext(body: unknown): Context<ApiEnv> {
	return {
		env: { CONFIG_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' },
		req: { json: async (): Promise<unknown> => body },
		get: (): MetaDb => ({}) as MetaDb,
		json: (payload: unknown, status?: number): Response => {
			return Response.json(payload, { status: status ?? 200 })
		}
	} as unknown as Context<ApiEnv>
}
