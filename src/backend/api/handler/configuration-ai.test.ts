import type { Context } from 'hono'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ApiEnv } from '..'
import type { MetaDb } from '../../db'
import type { AIConfigView } from '../../ai/config'
import { AIConfigError } from '../../ai/config'
import * as aiConfig from '../../ai/config'
import { getAIConfigHandler, updateAIProviderHandler } from './configuration'

describe('AI configuration handlers', (): void => {
	afterEach((): void => {
		vi.restoreAllMocks()
	})

	test('returns provider entities without credential material', async (): Promise<void> => {
		vi.spyOn(aiConfig, 'getAIConfig').mockResolvedValue(createAIConfig())

		const response: Response = await getAIConfigHandler(createContext({}))
		const body: Record<string, unknown> = await response.json()

		expect({
			status: response.status,
			provider: (body['providers'] as Array<Record<string, unknown>>)[0],
			serialized: JSON.stringify(body)
		}).toEqual({
			status: 200,
			provider: {
				id: 'openai-official',
				name: 'OpenAI official',
				type: 'image_openai',
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

	test('maps stale provider updates to CONFIG_CONFLICT', async (): Promise<void> => {
		vi.spyOn(aiConfig, 'updateAIProvider').mockRejectedValue(
			new AIConfigError('AI_PROVIDER_CONFLICT')
		)

		const response: Response = await updateAIProviderHandler(
			createContext({
				id: 'openai-official',
				name: 'OpenAI official',
				type: 'image_openai',
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
	return {
		routing: { errorWeight: 1, latencyWeight: 0.8, priceWeight: 0.2 },
		taskRetentionDays: 30,
		providers: [
			{
				id: 'openai-official',
				name: 'OpenAI official',
				type: 'image_openai',
				baseUrl: 'https://api.openai.com/v1',
				models: ['gpt-image-2'],
				priceMultiplier: 1,
				apiKeyCiphertext: 'provider-secret',
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
