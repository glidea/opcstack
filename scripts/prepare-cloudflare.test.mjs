import { describe, expect, it } from 'vitest'
import { decryptConfigSecret } from '../src/backend/config/crypto.ts'
import {
	buildAgentOAuthClientUpsertSql,
	buildDnsCnameRecordPayload,
	buildOAuthClientUpsertSql,
	buildInitialAdministratorInsertSql,
	buildRequiredSecretKeys,
	buildRuntimeSecretLines,
	buildSystemSettingsInitializationSql,
	buildTypesWranglerConfig,
	buildWorkerRoutes,
	encryptInitializationSecret,
	resolveLocalSystemSecrets,
	resolveAdministratorInitialization,
	resolveRemoteSystemSecrets,
	resolveSystemSettingsInitialization,
	resolveTurnstileInitializationConfig,
	selectDnsCnameRecord,
	validateSystemSecretRecovery,
	validateRuntimeConfig
} from './prepare-cloudflare.mjs'
import { resolveAppCnCnameTarget } from './prepare-public.mjs'

describe('prepare cloudflare dns config', () => {
	it('creates the initial administrator only when D1 has no administrator', () => {
		const result = resolveAdministratorInitialization([], () => 'random-password')

		expect(result).toEqual({
			create: true,
			email: 'admin@opcstack.local',
			password: 'random-password'
		})
	})

	it('does not reset an existing administrator during another prepare', () => {
		const result = resolveAdministratorInitialization([
			{ id: 'admin-1', email: 'owner@example.com' }
		], () => {
			throw new Error('password must not be generated')
		})

		expect(result).toEqual({
			create: false,
			id: 'admin-1',
			email: 'owner@example.com'
		})
	})

	it('inserts an administrator role without an email upsert', () => {
		const sql = buildInitialAdministratorInsertSql({
			userId: 'admin-1',
			email: 'admin@opcstack.local',
			affCode: 'ADMIN001',
			passwordHash: 'password-hash',
			nowMs: 123
		})

		expect(sql).toContain("'admin'")
		expect(sql).not.toContain('ON CONFLICT')
		expect(sql).not.toContain('UPDATE account')
	})

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
				hasLocalEncryptionKey: false
			})
		}).toThrow('SYSTEM_SECRETS_RECOVERY_UNAVAILABLE')
		expect(() => {
			validateSystemSecretRecovery({
				settingsExist: true,
				isRemote: false,
				workerExists: false,
				hasPendingSecrets: false,
				hasLocalEncryptionKey: false
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
				hasLocalEncryptionKey: false
			})
		}).not.toThrow()
		expect(() => {
			validateSystemSecretRecovery({
				settingsExist: true,
				isRemote: false,
				workerExists: false,
				hasPendingSecrets: false,
				hasLocalEncryptionKey: true
			})
		}).not.toThrow()
	})

	it('allows missing non-encryption local secrets to be generated for existing settings', () => {
		expect(() => {
			validateSystemSecretRecovery({
				settingsExist: true,
				isRemote: false,
				workerExists: false,
				hasPendingSecrets: false,
				hasLocalEncryptionKey: true
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
			typeHasPaymentSecret: typesConfig.secrets.required.some((key) => key.startsWith('PAYMENT_')),
			typeHasGeneratedSystemSecret:
				typesConfig.secrets.required.includes('CONFIG_ENCRYPTION_KEY')
		}).toEqual({
			runtimeKeys: ['BETTER_AUTH_SECRET'],
			typeHasPaymentSecret: false,
			typeHasGeneratedSystemSecret: true
		})
	})

})

function createRuntimeEnv(overrides = {}) {
	return {
		BETTER_AUTH_SECRET: 'auth-secret',
		CONFIG_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
		R2_ENABLED: 'false',
		R2_ORIGIN_SIGNING_SECRET: 'r2-secret',
		...overrides
	}
}
