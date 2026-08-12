import { describe, expect, it } from 'vitest'
import { decryptConfigSecret } from '../src/backend/config/crypto.ts'
import {
	buildAgentOAuthClientUpsertSql,
	buildAIChannelVars,
	buildDnsCnameRecordPayload,
	buildOAuthClientUpsertSql,
	buildRequiredSecretKeys,
	buildRuntimeSecretLines,
	buildSystemSettingsInitializationSql,
	buildTypesWranglerConfig,
	buildWorkerRoutes,
	encryptInitializationSecret,
	resolveLocalSystemSecrets,
	resolveRemoteSystemSecrets,
	resolveSystemSettingsInitialization,
	resolveTurnstileInitializationConfig,
	selectDnsCnameRecord,
	validateSystemSecretRecovery,
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

	it('seeds the fixed opc cli public client with pkce', () => {
		const sql = buildOAuthClientUpsertSql({
			baseUrl: 'https://app.example.com',
			nowMs: 123
		})

		expect(sql).toContain("'opc-cli', 'opc-cli'")
		expect(sql).toContain('https://app.example.com/api/oauth/authorization_callback')
		expect(sql).toContain('["api_access","offline_access"]')
		expect(sql).toContain('require_pkce')
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

describe('prepare cloudflare configuration initialization', () => {
	it('uses local Turnstile test credentials', () => {
		const config = resolveTurnstileInitializationConfig({ isRemote: false })

		expect(config).toEqual({
			siteKey: '1x00000000000000000000AA',
			secretKey: '1x0000000000000000000000000000000AA'
		})
	})

	it('uses the provisioned remote Turnstile widget credentials', () => {
		const config = resolveTurnstileInitializationConfig({
			isRemote: true,
			widget: { sitekey: 'remote-site-key', secret: 'remote-secret-key' }
		})

		expect(config).toEqual({ siteKey: 'remote-site-key', secretKey: 'remote-secret-key' })
	})

	it('encrypts the initial secret for Worker decryption', async () => {
		const encryptionKey = Buffer.alloc(32, 7).toString('base64')
		const encrypted = encryptInitializationSecret(encryptionKey, 'turnstile-secret')

		const result = await decryptConfigSecret(encryptionKey, encrypted)

		expect({ result }).toEqual({ result: 'turnstile-secret' })
	})

	it('initializes complete domain documents without overwriting saved configuration', () => {
		const sql = buildSystemSettingsInitializationSql({
			siteKey: 'site-key',
			secretKeyCiphertext: 'ciphertext',
			secretKeyIv: 'iv',
			nowMs: 123
		})

		expect(sql).toContain('INSERT INTO system_settings')
		expect(sql).toContain('general_config')
		expect(sql).toContain('authentication_config')
		expect(sql).toContain('storage_config')
		expect(sql).toContain('ON CONFLICT(id) DO NOTHING')
		expect(sql).not.toContain('turnstile_secret_key_ciphertext')
		expect(sql).not.toContain('turnstile-secret')
	})
})

describe('prepare cloudflare runtime config validation', () => {
	it('generates and then reuses local system secrets', () => {
		const generated = resolveLocalSystemSecrets({}, () => Buffer.alloc(32, 7))
		const reused = resolveLocalSystemSecrets(generated, () => Buffer.alloc(32, 8))

		expect({ generated, reused }).toEqual({
			generated: {
				BETTER_AUTH_SECRET: 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc',
				CONFIG_ENCRYPTION_KEY: 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=',
				R2_ORIGIN_SIGNING_SECRET: 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc'
			},
			reused: generated
		})
	})

	it('generates remote system secrets only for a new Worker', () => {
		const generated = resolveRemoteSystemSecrets(null, {}, () => Buffer.alloc(32, 7))
		const reusedPending = resolveRemoteSystemSecrets(null, generated, () => Buffer.alloc(32, 8))
		const existing = resolveRemoteSystemSecrets(
			new Set([
				'BETTER_AUTH_SECRET',
				'CONFIG_ENCRYPTION_KEY',
				'R2_ORIGIN_SIGNING_SECRET'
			]),
			{},
			() => Buffer.alloc(32, 8)
		)

		expect({ generated, reusedPending, existing }).toEqual({
			generated: {
				BETTER_AUTH_SECRET: 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc',
				CONFIG_ENCRYPTION_KEY: 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=',
				R2_ORIGIN_SIGNING_SECRET: 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc'
			},
			reusedPending: generated,
			existing: {}
		})
	})

	it('rejects missing generated secrets on an existing Worker', () => {
		expect(() => {
			resolveRemoteSystemSecrets(new Set(['BETTER_AUTH_SECRET']), {}, () =>
				Buffer.alloc(32, 7)
			)
		}).toThrow('WORKER_SYSTEM_SECRETS_INCOMPLETE')
	})

	it('initializes settings only when the generated encryption key is available', () => {
		expect(
			resolveSystemSettingsInitialization({
				settingsExist: false,
				encryptionKey: 'generated-key'
			})
		).toBe(true)
		expect(
			resolveSystemSettingsInitialization({ settingsExist: true, encryptionKey: '' })
		).toBe(false)
		expect(() => {
			resolveSystemSettingsInitialization({ settingsExist: false, encryptionKey: '' })
		}).toThrow('CONFIG_ENCRYPTION_KEY_UNAVAILABLE')
	})

	it('rejects existing encrypted settings when system secrets cannot be recovered', () => {
		expect(() => {
			validateSystemSecretRecovery({
				settingsExist: true,
				isRemote: true,
				workerExists: false,
				hasPendingSecrets: false,
				hasLocalSecrets: false
			})
		}).toThrow('SYSTEM_SECRETS_RECOVERY_UNAVAILABLE')
		expect(() => {
			validateSystemSecretRecovery({
				settingsExist: true,
				isRemote: false,
				workerExists: false,
				hasPendingSecrets: false,
				hasLocalSecrets: false
			})
		}).toThrow('SYSTEM_SECRETS_RECOVERY_UNAVAILABLE')
	})

	it('allows existing settings when the matching system secrets are recoverable', () => {
		expect(() => {
			validateSystemSecretRecovery({
				settingsExist: true,
				isRemote: true,
				workerExists: false,
				hasPendingSecrets: true,
				hasLocalSecrets: false
			})
		}).not.toThrow()
		expect(() => {
			validateSystemSecretRecovery({
				settingsExist: true,
				isRemote: false,
				workerExists: false,
				hasPendingSecrets: false,
				hasLocalSecrets: true
			})
		}).not.toThrow()
	})

	it('rejects an invalid configuration encryption key', () => {
		expect(() => {
			validateRuntimeConfig(
				createRuntimeEnv({ CONFIG_ENCRYPTION_KEY: Buffer.alloc(31).toString('base64') }),
				{ isRemote: false }
			)
		}).toThrow('CONFIG_ENCRYPTION_KEY_INVALID')
	})

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
				'CONFIG_ENCRYPTION_KEY',
				'R2_ORIGIN_SIGNING_SECRET',
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
			keys: [
				'BETTER_AUTH_SECRET',
				'CONFIG_ENCRYPTION_KEY',
				'R2_ORIGIN_SIGNING_SECRET'
			]
		})
	})

	it('writes only runtime required secret values', () => {
		const lines = buildRuntimeSecretLines(createRuntimeEnv())

		expect({
			lines
		}).toEqual({
			lines: [
				'BETTER_AUTH_SECRET="auth-secret"',
				'CONFIG_ENCRYPTION_KEY="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="',
				'R2_ORIGIN_SIGNING_SECRET="r2-secret"'
			]
		})
	})

	it('omits system secret values already stored by Cloudflare', () => {
		const lines = buildRuntimeSecretLines(
			createRuntimeEnv({
				BETTER_AUTH_SECRET: '',
				CONFIG_ENCRYPTION_KEY: '',
				R2_ORIGIN_SIGNING_SECRET: ''
			})
		)

		expect({ lines }).toEqual({ lines: [] })
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
			typeHasPaymentSecret: typesConfig.secrets.required.includes('PAYMENT_DODO_API_KEY'),
			typeHasPrepareOnlyPassword:
				typesConfig.secrets.required.includes('SUPER_ADMIN_PASSWORD')
		}).toEqual({
			runtimeKeys: ['BETTER_AUTH_SECRET'],
			typeHasPaymentSecret: true,
			typeHasPrepareOnlyPassword: false
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

	it('requires enabled payment secrets', () => {
		const env = createRuntimeEnv({
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
				'CONFIG_ENCRYPTION_KEY',
				'R2_ORIGIN_SIGNING_SECRET',
				'PAYMENT_CREEM_API_KEY',
				'PAYMENT_CREEM_WEBHOOK_SECRET'
			]
		})
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
		CONFIG_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
		R2_ENABLED: 'false',
		R2_ORIGIN_SIGNING_SECRET: 'r2-secret',
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
