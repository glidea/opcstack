import type { Context } from 'hono'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ApiEnv } from '..'
import type { MetaDb } from '../../db'
import type { PaymentConfigView } from '../../payment/config'
import { PaymentConfigError } from '../../payment/config'
import * as paymentConfig from '../../payment/config'
import {
	deletePaymentProductHandler,
	getPaymentConfigHandler
} from './configuration'

describe('payment configuration handlers', (): void => {
	afterEach((): void => {
		vi.restoreAllMocks()
	})

	test('returns redacted provider credentials and derived webhook URLs', async (): Promise<void> => {
		vi.spyOn(paymentConfig, 'getPaymentConfig').mockResolvedValue(createPaymentConfig())

		const response: Response = await getPaymentConfigHandler(createContext({}))

		expect({ status: response.status, body: await response.json() }).toEqual({
			status: 200,
			body: {
				enabled: false,
				default_provider: null,
				country_provider_overrides: [],
				dodo: {
					api_key_configured: true,
					webhook_secret_configured: true,
					webhook_url: 'https://app.example.com/api/webhook/dodo'
				},
				creem: {
					api_key_configured: false,
					webhook_secret_configured: false,
					webhook_url: 'https://app.example.com/api/webhook/creem'
				},
				products: [],
				version: 3
			}
		})
	})

	test('maps referenced product deletion to CONFIG_CONFLICT', async (): Promise<void> => {
		vi.spyOn(paymentConfig, 'deletePaymentProduct').mockRejectedValue(
			new PaymentConfigError('PAYMENT_PRODUCT_REFERENCED')
		)

		const response: Response = await deletePaymentProductHandler(
			createContext({ product_id: 'pro', expected_version: 1 })
		)

		expect({ status: response.status, body: await response.json() }).toEqual({
			status: 409,
			body: {
				code: 'CONFIG_CONFLICT',
				message: 'Configuration has changed'
			}
		})
	})
})

function createPaymentConfig(): PaymentConfigView {
	return {
		enabled: false,
		defaultProvider: null,
		providerCountryOverrides: [],
		providers: {
			dodo: {
				apiKey: { ciphertext: 'encrypted', iv: 'iv' },
				webhookSecret: { ciphertext: 'encrypted', iv: 'iv' }
			},
			creem: {
				apiKey: null,
				webhookSecret: null
			}
		},
		products: [],
		version: 3
	}
}

function createContext(body: unknown): Context<ApiEnv> {
	return {
		env: {
			APP_BASE_URL: 'https://app.example.com',
			CONFIG_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
		},
		req: {
			json: async (): Promise<unknown> => body
		},
		get: (): MetaDb => ({}) as MetaDb,
		json: (payload: unknown, status?: number): Response => {
			return Response.json(payload, { status: status ?? 200 })
		}
	} as unknown as Context<ApiEnv>
}
