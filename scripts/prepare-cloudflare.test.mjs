import { describe, expect, it } from 'vitest'
import {
	buildDnsCnameRecordPayload,
	buildAgentOAuthClientUpsertSql,
	buildAIChannelVars,
	buildRequiredSecretKeys,
	buildRuntimeSecretLines,
	buildTypesWranglerConfig,
	buildWorkerRoutes,
	selectDnsCnameRecord,
	validateRuntimeConfig
} from './prepare-cloudflare.mjs'
import { resolveAppCnCnameTarget } from './prepare-public.mjs'

describe('prepare cloudflare dns config', () => {
	it('seeds the fixed agent oauth client with the deployment callback', () => {
		const sql = buildAgentOAuthClientUpsertSql({
			baseUrl: 'https://app.example.com',
			nowMs: 123
		})

		expect(sql).toContain("'opcstack-agent', 'opcstack-agent'")
		expect(sql).toContain('https://app.example.com/api/agent/authorization_callback')
		expect(sql).toContain('authorization_code')
	})

	it('normalizes app cn cname target', () => {
		const env = {
			APP_CN_CNAME_TARGET: 'https://preferred.example.com/'
		}

		resolveAppCnCnameTarget(env)

		expect({
			target: env.APP_CN_CNAME_TARGET
		}).toEqual({
			target: 'preferred.example.com'
		})
	})

	it('builds unproxied cname payload', () => {
		const payload = buildDnsCnameRecordPayload('cn.example.com', 'preferred.example.com')

		expect({
			payload
		}).toEqual({
			payload: {
				type: 'CNAME',
				name: 'cn.example.com',
				content: 'preferred.example.com',
				ttl: 1,
				proxied: false
			}
		})
	})

	it('selects no cname record when none exists', () => {
		const record = selectDnsCnameRecord([], 'cn.example.com')

		expect({
			record
		}).toEqual({
			record: null
		})
	})

	it('selects the existing cname record', () => {
		const record = selectDnsCnameRecord(
			[
				{
					id: 'record-id',
					type: 'CNAME',
					name: 'cn.example.com',
					content: 'old.example.com'
				}
			],
			'cn.example.com'
		)

		expect({
			record
		}).toEqual({
			record: {
				id: 'record-id',
				type: 'CNAME',
				name: 'cn.example.com',
				content: 'old.example.com'
			}
		})
	})

	it('rejects duplicated dns records', () => {
		expect(() => {
			selectDnsCnameRecord(
				[
					{ id: 'a', type: 'CNAME', name: 'cn.example.com' },
					{ id: 'b', type: 'CNAME', name: 'cn.example.com' }
				],
				'cn.example.com'
			)
		}).toThrow('APP_CN_DOMAIN_DNS_RECORD_DUPLICATED')
	})

	it('rejects non cname dns record', () => {
		expect(() => {
			selectDnsCnameRecord(
				[
					{
						id: 'record-id',
						type: 'A',
						name: 'cn.example.com',
						content: '192.0.2.1'
					}
				],
				'cn.example.com'
			)
		}).toThrow('APP_CN_DOMAIN_DNS_RECORD_TYPE_INVALID')
	})

	it('adds cn custom domain route without external cname target', () => {
		const routes = buildWorkerRoutes('app.example.com', 'cn.example.com', '', '')

		expect({
			routes
		}).toEqual({
			routes: [
				{
					pattern: 'app.example.com',
					custom_domain: true
				},
				{
					pattern: 'cn.example.com',
					custom_domain: true
				}
			]
		})
	})

	it('adds cn zone route with external cname target', () => {
		const routes = buildWorkerRoutes(
			'app.example.com',
			'cn.example.com',
			'target.example.net',
			'example.com'
		)

		expect({
			routes
		}).toEqual({
			routes: [
				{
					pattern: 'app.example.com',
					custom_domain: true
				},
				{
					pattern: 'cn.example.com/*',
					zone_name: 'example.com'
				}
			]
		})
	})
})

describe('prepare cloudflare runtime config validation', () => {
	it('discovers complete async ai channels', () => {
		const env = createRuntimeEnv({
			IMAGE_OPENAI_BASE_URL: 'https://primary.example.com/v1',
			IMAGE_OPENAI_MODEL: 'gpt-image-2',
			IMAGE_OPENAI_OFFICIAL_BASE_URL: 'https://api.openai.com/v1',
			IMAGE_OPENAI_OFFICIAL_MODELS: 'gpt-image-2;gpt-image-1',
			IMAGE_OPENAI_OFFICIAL_PRICE_MULTIPLIER: '1',
			IMAGE_OPENAI_OFFICIAL_API_KEY: 'official-key'
		})

		validateRuntimeConfig(env, { isRemote: false })

		expect({
			vars: buildAIChannelVars(env),
			keys: buildRequiredSecretKeys(env)
		}).toEqual({
			vars: {
				IMAGE_OPENAI_OFFICIAL_BASE_URL: 'https://api.openai.com/v1',
				IMAGE_OPENAI_OFFICIAL_MODELS: 'gpt-image-2;gpt-image-1',
				IMAGE_OPENAI_OFFICIAL_PRICE_MULTIPLIER: '1'
			},
			keys: [
				'BETTER_AUTH_SECRET',
				'IMAGE_OPENAI_OFFICIAL_API_KEY'
			]
		})
	})

	it('rejects incomplete async ai channel config', () => {
		const env = createRuntimeEnv({
			IMAGE_OPENAI_BASE_URL: 'https://primary.example.com/v1',
			IMAGE_OPENAI_MODEL: 'gpt-image-2',
			IMAGE_OPENAI_OFFICIAL_BASE_URL: 'https://api.openai.com/v1',
			IMAGE_OPENAI_OFFICIAL_PRICE_MULTIPLIER: '1',
			IMAGE_OPENAI_OFFICIAL_API_KEY: 'official-key'
		})

		expect(() => {
			validateRuntimeConfig(env, { isRemote: false })
		}).toThrow('IMAGE_OPENAI_OFFICIAL_MODELS_MISSING')
	})

	it('rejects invalid async ai channel price multiplier', () => {
		const env = createRuntimeEnv({
			IMAGE_OPENAI_BASE_URL: 'https://primary.example.com/v1',
			IMAGE_OPENAI_MODEL: 'gpt-image-2',
			IMAGE_OPENAI_OFFICIAL_BASE_URL: 'https://api.openai.com/v1',
			IMAGE_OPENAI_OFFICIAL_MODELS: 'gpt-image-2',
			IMAGE_OPENAI_OFFICIAL_PRICE_MULTIPLIER: '0',
			IMAGE_OPENAI_OFFICIAL_API_KEY: 'official-key'
		})

		expect(() => {
			validateRuntimeConfig(env, { isRemote: false })
		}).toThrow('IMAGE_OPENAI_OFFICIAL_PRICE_MULTIPLIER_INVALID')
	})

	it('rejects async ai provider default model without a matching channel', () => {
		const env = createRuntimeEnv({
			IMAGE_OPENAI_BASE_URL: 'https://primary.example.com/v1',
			IMAGE_OPENAI_MODEL: 'gpt-image-2',
			IMAGE_OPENAI_OFFICIAL_BASE_URL: 'https://api.openai.com/v1',
			IMAGE_OPENAI_OFFICIAL_MODELS: 'gpt-image-1',
			IMAGE_OPENAI_OFFICIAL_PRICE_MULTIPLIER: '1',
			IMAGE_OPENAI_OFFICIAL_API_KEY: 'official-key'
		})

		expect(() => {
			validateRuntimeConfig(env, { isRemote: false })
		}).toThrow('IMAGE_OPENAI_DEFAULT_MODEL_CHANNEL_MISSING')
	})

	it('rejects unsupported async ai provider channel config', () => {
		const env = createRuntimeEnv({
			IMAGE_UNKNOWN_OFFICIAL_BASE_URL: 'https://example.com/v1',
			IMAGE_UNKNOWN_OFFICIAL_MODELS: 'model',
			IMAGE_UNKNOWN_OFFICIAL_PRICE_MULTIPLIER: '1',
			IMAGE_UNKNOWN_OFFICIAL_API_KEY: 'key'
		})

		expect(() => {
			validateRuntimeConfig(env, { isRemote: false })
		}).toThrow('IMAGE_UNKNOWN_CHANNEL_PROVIDER_UNSUPPORTED')
	})

	it('rejects invalid async ai routing weights and task retention', () => {
		expect(() => {
			validateRuntimeConfig(
				createRuntimeEnv({
					AI_ROUTING_ERROR_WEIGHT: '0',
					AI_ROUTING_LATENCY_WEIGHT: '0',
					AI_ROUTING_PRICE_WEIGHT: '0'
				}),
				{ isRemote: false }
			)
		}).toThrow('AI_ROUTING_WEIGHTS_INVALID')

		expect(() => {
			validateRuntimeConfig(createRuntimeEnv({ AI_ROUTING_PRICE_WEIGHT: '-1' }), {
				isRemote: false
			})
		}).toThrow('AI_ROUTING_PRICE_WEIGHT_INVALID')

		expect(() => {
			validateRuntimeConfig(createRuntimeEnv({ AI_TASK_RETENTION_DAYS: '0' }), {
				isRemote: false
			})
		}).toThrow('AI_TASK_RETENTION_DAYS_INVALID')
	})

	it('omits disabled optional secrets from runtime required keys', () => {
		const keys = buildRequiredSecretKeys(createRuntimeEnv())

		expect({
			keys
		}).toEqual({
			keys: ['BETTER_AUTH_SECRET']
		})
	})

	it('writes only runtime required secret values', () => {
		const lines = buildRuntimeSecretLines(createRuntimeEnv())

		expect({
			lines
		}).toEqual({
			lines: ['BETTER_AUTH_SECRET="auth-secret"']
		})
	})

	it('declares optional admin api token when configured', () => {
		const keys = buildRequiredSecretKeys(createRuntimeEnv({ ADMIN_API_TOKEN: 'admin-token' }))

		expect({
			keys
		}).toEqual({
			keys: ['BETTER_AUTH_SECRET', 'ADMIN_API_TOKEN']
		})
	})

	it('keeps full secret schema for wrangler types config', () => {
		const config = {
			secrets: {
				required: ['BETTER_AUTH_SECRET']
			}
		}

		const typesConfig = buildTypesWranglerConfig(config)

		expect({
			runtimeKeys: config.secrets.required,
			typeHasPaymentSecret: typesConfig.secrets.required.includes('PAYMENT_DODO_API_KEY')
		}).toEqual({
			runtimeKeys: ['BETTER_AUTH_SECRET'],
			typeHasPaymentSecret: true
		})
	})

	it('keeps dynamic async ai channel secrets in wrangler types config', () => {
		const config = {
			secrets: {
				required: ['BETTER_AUTH_SECRET', 'IMAGE_OPENAI_OFFICIAL_API_KEY']
			}
		}

		const typesConfig = buildTypesWranglerConfig(config)

		expect({
			hasChannelSecret: typesConfig.secrets.required.includes(
				'IMAGE_OPENAI_OFFICIAL_API_KEY'
			)
		}).toEqual({
			hasChannelSecret: true
		})
	})

	it('requires enabled feature secrets', () => {
		const env = createRuntimeEnv({
			GOOGLE_AUTH_ENABLED: 'true',
			GOOGLE_CLIENT_ID: 'google-client',
			GOOGLE_CLIENT_SECRET: 'google-secret',
			PAYMENT_ENABLED: 'true',
			PAYMENT_PROVIDER: 'creem',
			PAYMENT_PRODUCTS:
				'[{"product_id":"credits_100","type":"one_time","credits_amount":"100","providers":{"creem":{"kind":"remote_product","product_id":"prod_1"}}}]',
			PAYMENT_CREEM_API_KEY: 'creem-key',
			PAYMENT_CREEM_WEBHOOK_SECRET: 'creem-webhook'
		})

		const keys = buildRequiredSecretKeys(env)

		expect({
			keys
		}).toEqual({
			keys: [
				'BETTER_AUTH_SECRET',
				'GOOGLE_CLIENT_SECRET',
				'PAYMENT_CREEM_API_KEY',
				'PAYMENT_CREEM_WEBHOOK_SECRET'
			]
		})
	})

	it('rejects enabled r2 without origin signing secret', () => {
		const env = createRuntimeEnv({
			R2_ENABLED: 'true',
			R2_ORIGIN_SIGNING_SECRET: ''
		})

		expect(() => {
			validateRuntimeConfig(env, { isRemote: false })
		}).toThrow('R2_ORIGIN_SIGNING_SECRET_MISSING')
	})

	it('rejects enabled google auth without client secret', () => {
		const env = createRuntimeEnv({
			GOOGLE_AUTH_ENABLED: 'true',
			GOOGLE_CLIENT_ID: 'google-client',
			GOOGLE_CLIENT_SECRET: ''
		})

		expect(() => {
			validateRuntimeConfig(env, { isRemote: false })
		}).toThrow('GOOGLE_CLIENT_SECRET_MISSING')
	})

	it('rejects enabled payment without selected provider secrets', () => {
		const env = createRuntimeEnv({
			PAYMENT_ENABLED: 'true',
			PAYMENT_PROVIDER: 'creem',
			PAYMENT_PRODUCTS:
				'[{"product_id":"credits_100","type":"one_time","credits_amount":"100","providers":{"creem":{"kind":"remote_product","product_id":"prod_1"}}}]',
			PAYMENT_CREEM_API_KEY: '',
			PAYMENT_CREEM_WEBHOOK_SECRET: 'whsec'
		})

		expect(() => {
			validateRuntimeConfig(env, { isRemote: false })
		}).toThrow('PAYMENT_CREEM_API_KEY_MISSING')
	})
})

function createRuntimeEnv(overrides = {}) {
	return {
		BETTER_AUTH_SECRET: 'auth-secret',
		ADMIN_API_TOKEN: '',
		R2_ENABLED: 'false',
		R2_ORIGIN_SIGNING_SECRET: '',
		TURNSTILE_ENABLED: 'false',
		TURNSTILE_SITE_KEY: '',
		TURNSTILE_SECRET_KEY: '',
		GOOGLE_AUTH_ENABLED: 'false',
		GOOGLE_CLIENT_ID: '',
		GOOGLE_CLIENT_SECRET: '',
		GITHUB_AUTH_ENABLED: 'false',
		GITHUB_CLIENT_ID: '',
		GITHUB_CLIENT_SECRET: '',
		LINUXDO_AUTH_ENABLED: 'false',
		LINUXDO_CLIENT_ID: '',
		LINUXDO_CLIENT_SECRET: '',
		PAYMENT_ENABLED: 'false',
		PAYMENT_PROVIDER: 'creem',
		PAYMENT_PROVIDER_COUNTRY_OVERRIDES: '',
		PAYMENT_PRODUCTS: '[]',
		PAYMENT_DODO_API_KEY: '',
		PAYMENT_DODO_WEBHOOK_SECRET: '',
		PAYMENT_CREEM_API_KEY: '',
		PAYMENT_CREEM_WEBHOOK_SECRET: '',
		AI_ROUTING_ERROR_WEIGHT: '1',
		AI_ROUTING_LATENCY_WEIGHT: '0.8',
		AI_ROUTING_PRICE_WEIGHT: '0.2',
		AI_TASK_RETENTION_DAYS: '30',
		...overrides
	}
}
