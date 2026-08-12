import { execSync } from 'node:child_process'
import { createCipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
	normalizeDomain,
	parseEnvFile,
	resolveAppBase,
	resolveAppCnCnameTarget,
	resolveAppCnDomain,
	syncPublicAssets,
	writeClientConfig
} from './prepare-public.mjs'

const SVELTE_WORKER_PATH = '.svelte-kit/cloudflare/_worker.js'
const SVELTE_SERVER_PATH = '.svelte-kit/output/server/index.js'
const SVELTE_MANIFEST_PATH = '.svelte-kit/cloudflare-tmp/manifest.js'
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'
const TURNSTILE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA'
const CLOUDFLARE_TOKEN_CACHE_PATH = '.wrangler/cloudflare-api-token'
const CLOUDFLARE_TOKEN_PERMISSION_CACHE_PATH = '.wrangler/cloudflare-api-token.permissions'
const RUNTIME_SECRETS_PATH = '.wrangler/runtime-secrets.env'
const TYPES_WRANGLER_CONFIG_PATH = '.wrangler/wrangler.types.jsonc'
const AI_ASYNC_PROVIDER_CONFIGS = [
	{ prefix: 'IMAGE_GEMINI', defaultModelKey: 'IMAGE_GEMINI_MODEL' },
	{ prefix: 'IMAGE_OPENAI', defaultModelKey: 'IMAGE_OPENAI_MODEL' },
	{ prefix: 'IMAGE_SEEDDREAM', defaultModelKey: 'IMAGE_SEEDDREAM_MODEL' },
	{ prefix: 'IMAGE_ALIYUN', defaultModelKey: 'IMAGE_ALIYUN_MODEL' },
	{ prefix: 'TTS_GEMINI', defaultModelKey: 'TTS_GEMINI_MODEL' },
	{ prefix: 'TTS_SEED', defaultModelKey: 'TTS_SEED_MODEL' },
	{ prefix: 'VIDEO_SEEDDANCE', defaultModelKey: 'VIDEO_SEEDDANCE_MODEL' }
]
const SECRET_KEYS = [
	'BETTER_AUTH_SECRET',
	'CONFIG_ENCRYPTION_KEY',
	'SUPER_ADMIN_PASSWORD',
	'ADMIN_API_TOKEN',
	'TURNSTILE_SECRET_KEY',
	'GOOGLE_CLIENT_SECRET',
	'GITHUB_CLIENT_SECRET',
	'LINUXDO_CLIENT_SECRET',
	'EMAIL_RESEND_API_KEY',
	'PAYMENT_DODO_API_KEY',
	'PAYMENT_DODO_WEBHOOK_SECRET',
	'PAYMENT_CREEM_API_KEY',
	'PAYMENT_CREEM_WEBHOOK_SECRET',
	'CHAT_OPENAI_API_KEY',
	'IMAGE_GEMINI_API_KEY',
	'IMAGE_OPENAI_API_KEY',
	'IMAGE_SEEDDREAM_API_KEY',
	'IMAGE_ALIYUN_API_KEY',
	'TTS_GEMINI_API_KEY',
	'TTS_SEED_API_KEY',
	'REALTIME_DOUBAO_API_KEY',
	'VIDEO_SEEDDANCE_API_KEY',
	'R2_ORIGIN_SIGNING_SECRET'
]
const CLOUDFLARE_TOKEN_PERMISSIONS = [
	{ key: 'api_tokens', type: 'edit' },
	{ key: 'memberships', type: 'read' },
	{ key: 'zone', type: 'read' },
	{ key: 'zone_settings', type: 'edit' },
	{ key: 'dns', type: 'edit' },
	{ key: 'workers_scripts', type: 'edit' },
	{ key: 'workers_kv_storage', type: 'edit' },
	{ key: 'workers_routes', type: 'edit' },
	{ key: 'workers_r2', type: 'edit' },
	{ key: 'd1', type: 'edit' },
	{ key: 'queues', type: 'edit' },
	{ key: 'challenge_widgets', type: 'edit' }
]
const CLOUDFLARE_TOKEN_PERMISSION_FINGERPRINT = createHash('sha256')
	.update(JSON.stringify(CLOUDFLARE_TOKEN_PERMISSIONS))
	.digest('hex')
const CLOUDFLARE_TOKEN_TEMPLATE_URL = buildCloudflareTokenTemplateUrl()

function buildCloudflareTokenTemplateUrl() {
	const params = new URLSearchParams({
		permissionGroupKeys: JSON.stringify(CLOUDFLARE_TOKEN_PERMISSIONS),
		accountId: '*',
		zoneId: 'all',
		name: 'OPCStack Deploy Token'
	})
	return `https://dash.cloudflare.com/profile/api-tokens?${params.toString()}`
}

function run(command, options = {}) {
	console.log(`> ${command}`)
	execSync(command, { stdio: 'inherit', ...options })
}

function runOutput(command) {
	console.log(`> ${command}`)
	return execSync(command, { encoding: 'utf-8' })
}

const D1_SHARD_REGIONS = ['wnam', 'enam', 'weur', 'eeur', 'apac', 'oc']

function parseShardSpecs(raw) {
	if (raw === undefined || raw === '') {
		return [{ region: 'wnam', count: 1 }]
	}

	return raw.split(';').map((segment) => {
		const [rawRegion, rawCount] = segment.split(':')
		const region = rawRegion.trim()
		const count = Number(rawCount)
		if (!D1_SHARD_REGIONS.includes(region) || !Number.isInteger(count) || count < 1) {
			throw new Error('D1_SHARDS_INVALID')
		}
		return { region, count }
	})
}

function buildShardDescriptors(appName, specs) {
	const shards = []
	for (const spec of specs) {
		let index = 0
		while (index < spec.count) {
			const suffix = shardSuffix(index)
			shards.push({
				id: `shard_${spec.region}_${suffix}`,
				bindingName: tenantBindingName(spec.region, index),
				databaseName: tenantDatabaseName(appName, spec.region, index),
				region: spec.region
			})
			index += 1
		}
	}
	return shards
}

function buildD1DatabaseBindings(appName, metaDatabaseId, shards, shardDatabaseIds = {}) {
	const bindings = [
		{
			binding: 'META_DB',
			database_name: `${appName}-meta`,
			database_id: metaDatabaseId,
			migrations_dir: 'src/backend/db/meta-migrations'
		}
	]

	for (const shard of shards) {
		bindings.push({
			binding: shard.bindingName,
			database_name: shard.databaseName,
			database_id: shardDatabaseIds[shard.id] ?? '00000000-0000-0000-0000-000000000000',
			migrations_dir: 'src/backend/db/shard-migrations'
		})
	}

	return bindings
}

function tenantBindingName(region, index) {
	return `TENANT_DB_${region.toUpperCase()}_${shardSuffix(index)}`
}

function tenantDatabaseName(appName, region, index) {
	return `${appName}-shard-${region}-${shardSuffix(index)}`
}

function shardSuffix(index) {
	return String(index).padStart(4, '0')
}

function localD1DatabaseId(index) {
	return `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`
}

function resolveTurnstileConfig(input) {
	if (input.enabled !== 'true') {
		return {
			enabled: 'false',
			siteKey: '',
			secretKey: ''
		}
	}

	if (!input.isRemote) {
		return {
			enabled: 'true',
			siteKey: input.siteKey,
			secretKey: TURNSTILE_TEST_SECRET_KEY
		}
	}

	if (!input.widget) {
		throw new Error('TURNSTILE_WIDGET_MISSING')
	}

	return {
		enabled: 'true',
		siteKey: input.widget.sitekey,
		secretKey: input.widget.secret
	}
}

export function resolveTurnstileInitializationConfig(input) {
	if (!input.isRemote) {
		return {
			siteKey: TURNSTILE_TEST_SITE_KEY,
			secretKey: TURNSTILE_TEST_SECRET_KEY
		}
	}

	if (!input.widget) {
		throw new Error('TURNSTILE_WIDGET_MISSING')
	}

	return {
		siteKey: input.widget.sitekey,
		secretKey: input.widget.secret
	}
}

function selectTurnstileWidget(widgets, appName) {
	const matches = widgets.filter((widget) => {
		return widget.name === appName
	})

	if (matches.length > 1) {
		throw new Error('TURNSTILE_WIDGET_DUPLICATED')
	}

	return matches[0]
}

function loadEnv(isRemote) {
	const defaultEnvFile = isRemote ? '.env.prod' : '.env.dev'
	const secretEnvFile = isRemote ? '.env.secret.prod' : '.env.secret.dev'
	const overrideEnvFile = '.env'

	console.log(`Loading public defaults from ${defaultEnvFile}...`)
	const defaultEnv = parseEnvFile(defaultEnvFile)

	const secretEnv = parseEnvFile(secretEnvFile)
	if (Object.keys(secretEnv).length > 0) {
		console.log(`Loading secrets from ${secretEnvFile}...`)
	}

	const overrideEnv = parseEnvFile(overrideEnvFile)
	if (Object.keys(overrideEnv).length > 0) {
		console.log(`Loading overrides from ${overrideEnvFile}...`)
	}

	return {
		...defaultEnv,
		...secretEnv,
		...overrideEnv,
		...process.env
	}
}

function formatEnvValue(value) {
	return JSON.stringify(String(value ?? ''))
}

export function buildRequiredSecretKeys(env) {
	const keys = ['BETTER_AUTH_SECRET', 'CONFIG_ENCRYPTION_KEY']

	if (String(env.ADMIN_API_TOKEN ?? '').trim() !== '') {
		keys.push('ADMIN_API_TOKEN')
	}
	if (env.TURNSTILE_ENABLED === 'true') {
		keys.push('TURNSTILE_SECRET_KEY')
	}
	if (env.GOOGLE_AUTH_ENABLED === 'true') {
		keys.push('GOOGLE_CLIENT_SECRET')
	}
	if (env.GITHUB_AUTH_ENABLED === 'true') {
		keys.push('GITHUB_CLIENT_SECRET')
	}
	if (env.LINUXDO_AUTH_ENABLED === 'true') {
		keys.push('LINUXDO_CLIENT_SECRET')
	}
	if (env.EMAIL_PROVIDER === 'resend') {
		keys.push('EMAIL_RESEND_API_KEY')
	}
	if (env.R2_ENABLED === 'true') {
		keys.push('R2_ORIGIN_SIGNING_SECRET')
	}
	if (env.PAYMENT_ENABLED === 'true') {
		const providers = collectPaymentProviders(parsePaymentProducts(env.PAYMENT_PRODUCTS))
		if (providers.includes('dodo')) {
			keys.push('PAYMENT_DODO_API_KEY')
			keys.push('PAYMENT_DODO_WEBHOOK_SECRET')
		}
		if (providers.includes('creem')) {
			keys.push('PAYMENT_CREEM_API_KEY')
			keys.push('PAYMENT_CREEM_WEBHOOK_SECRET')
		}
	}

	for (const key of aiPrimarySecretKeys()) {
		if (String(env[key] ?? '').trim() !== '') {
			keys.push(key)
		}
	}
	for (const channel of collectAIChannels(env)) {
		keys.push(channel.apiKeyKey)
	}

	return keys
}

export function buildRuntimeSecretLines(env) {
	const lines = []
	for (const key of buildRequiredSecretKeys(env)) {
		lines.push(`${key}=${formatEnvValue(env[key])}`)
	}
	return lines
}

function writeRuntimeSecrets(env) {
	mkdirSync('.wrangler', { recursive: true })

	const lines = buildRuntimeSecretLines(env)

	writeFileSync(RUNTIME_SECRETS_PATH, `${lines.join('\n')}\n`, { mode: 0o600 })
	console.log(`Runtime secrets written to ${RUNTIME_SECRETS_PATH}`)
}

export function buildTypesWranglerConfig(config) {
	const typesConfig = JSON.parse(JSON.stringify(config))
	typesConfig.secrets = {
		required: [...new Set([...SECRET_KEYS, ...(config.secrets?.required ?? [])])]
	}
	return typesConfig
}

export function buildAIChannelVars(env) {
	const vars = {}
	for (const channel of collectAIChannels(env)) {
		vars[channel.baseUrlKey] = env[channel.baseUrlKey]
		vars[channel.modelsKey] = env[channel.modelsKey]
		vars[channel.priceMultiplierKey] = env[channel.priceMultiplierKey]
	}
	return vars
}

function writeTypesWranglerConfig(config) {
	mkdirSync('.wrangler', { recursive: true })

	const typesConfig = buildTypesWranglerConfig(config)
	writeFileSync(TYPES_WRANGLER_CONFIG_PATH, JSON.stringify(typesConfig, null, 4))
	console.log(`Wrangler types config written to ${TYPES_WRANGLER_CONFIG_PATH}`)
}

export function resolveCloudflareHost(rawDomain) {
	const value = normalizeDomain(rawDomain.trim())
	return new URL(`https://${value}`).hostname.toLowerCase()
}

export function selectCloudflareZone(zones, host) {
	const matches = zones.filter((zone) => {
		return host === zone.name || host.endsWith(`.${zone.name}`)
	})
	matches.sort((a, b) => {
		return b.name.length - a.name.length
	})
	return matches[0]
}

export function buildWorkerRoutes(appBaseHost, appCnDomain, appCnCnameTarget, appCnZoneName) {
	const routes = [
		{
			pattern: appBaseHost,
			custom_domain: true
		}
	]

	if (appCnDomain !== '' && appCnCnameTarget === '') {
		routes.push({
			pattern: appCnDomain,
			custom_domain: true
		})
	}

	if (appCnDomain !== '' && appCnCnameTarget !== '' && appCnZoneName !== '') {
		routes.push({
			pattern: `${appCnDomain}/*`,
			zone_name: appCnZoneName
		})
	}

	return routes
}

export function buildTurnstileDomains(appDomain, appCnDomain) {
	const domains = [appDomain]
	if (appCnDomain !== '') {
		domains.push(appCnDomain)
	}
	return domains
}

export function buildDnsCnameRecordPayload(name, target) {
	return {
		type: 'CNAME',
		name,
		content: target,
		ttl: 1,
		proxied: false
	}
}

export function selectDnsCnameRecord(records, name) {
	const matches = records.filter((record) => {
		return record?.name === name
	})
	if (matches.length === 0) {
		return null
	}
	if (matches.length > 1) {
		throw new Error('APP_CN_DOMAIN_DNS_RECORD_DUPLICATED')
	}

	const record = matches[0]
	if (record.type !== 'CNAME') {
		throw new Error('APP_CN_DOMAIN_DNS_RECORD_TYPE_INVALID')
	}
	return record
}

function renderTemplate(template, env) {
	return template.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
		if (Object.prototype.hasOwnProperty.call(env, varName)) {
			return JSON.stringify(String(env[varName] ?? '')).slice(1, -1)
		}

		console.error(`Error: Missing required variable ${varName}`)
		process.exit(1)
	})
}

function validateEmailConfig(env) {
	const requiredKeys = [
		'EMAIL_PROVIDER',
		'EMAIL_SIGNUP_ENABLED',
		'EMAIL_REQUIRE_VERIFICATION',
		'EMAIL_USER_ACTION_COOLDOWN_SECONDS',
		'EMAIL_RESEND_API_KEY',
		'SYSTEM_EMAIL',
		'EMAIL_SIGNUP_DOMAIN_ALLOWLIST'
	]
	for (const key of requiredKeys) {
		if (!Object.prototype.hasOwnProperty.call(env, key)) {
			console.error(`Error: EMAIL_CONFIG_MISSING_${key}`)
			process.exit(1)
		}
	}

	const booleanKeys = [
		'EMAIL_SIGNUP_ENABLED',
		'EMAIL_REQUIRE_VERIFICATION'
	]
	for (const key of booleanKeys) {
		if (env[key] !== 'true' && env[key] !== 'false') {
			console.error(`Error: EMAIL_CONFIG_BOOLEAN_INVALID_${key}`)
			process.exit(1)
		}
	}

	const emailProvider = env.EMAIL_PROVIDER
	const cooldown = Number(env.EMAIL_USER_ACTION_COOLDOWN_SECONDS)
	const cooldownValid = Number.isInteger(cooldown) && cooldown > 0
	if (!cooldownValid) {
		console.error('Error: EMAIL_COOLDOWN_CONFIG_INVALID')
		process.exit(1)
	}

	if (emailProvider !== 'resend' && emailProvider !== 'cloudflare') {
		console.error('Error: EMAIL_PROVIDER_CONFIG_INVALID')
		process.exit(1)
	}

	if (!env.SYSTEM_EMAIL) {
		console.error('Error: EMAIL_PROVIDER_CONFIG_MISSING')
		process.exit(1)
	}

	if (emailProvider === 'resend' && !env.EMAIL_RESEND_API_KEY) {
		console.error('Error: EMAIL_PROVIDER_CONFIG_MISSING')
		process.exit(1)
	}
}

export function validateRuntimeConfig(env, options = {}) {
	requireSecret(env, 'BETTER_AUTH_SECRET')
	requireSecret(env, 'CONFIG_ENCRYPTION_KEY')
	validateConfigEncryptionKey(env.CONFIG_ENCRYPTION_KEY)

	if (env.R2_ENABLED === 'true') {
		requireSecret(env, 'R2_ORIGIN_SIGNING_SECRET')
	}

	if (env.TURNSTILE_ENABLED === 'true' && options.isRemote !== true) {
		requireSecret(env, 'TURNSTILE_SITE_KEY')
	}

	validateEnabledAuthProvider(env, 'GOOGLE')
	validateEnabledAuthProvider(env, 'GITHUB')
	validateEnabledAuthProvider(env, 'LINUXDO')
	validatePaymentRuntimeConfig(env)
	validateAIRoutingConfig(env)
	collectAIChannels(env)
}

function validateAIRoutingConfig(env) {
	const weightKeys = [
		'AI_ROUTING_ERROR_WEIGHT',
		'AI_ROUTING_LATENCY_WEIGHT',
		'AI_ROUTING_PRICE_WEIGHT'
	]
	let totalWeight = 0
	for (const key of weightKeys) {
		const raw = String(env[key] ?? '').trim()
		const weight = Number(raw)
		if (raw === '' || !Number.isFinite(weight) || weight < 0) {
			throw new Error(`${key}_INVALID`)
		}
		totalWeight += weight
	}
	if (totalWeight === 0) {
		throw new Error('AI_ROUTING_WEIGHTS_INVALID')
	}

	const retentionDays = Number(env.AI_TASK_RETENTION_DAYS)
	if (!Number.isInteger(retentionDays) || retentionDays < 1) {
		throw new Error('AI_TASK_RETENTION_DAYS_INVALID')
	}
}

function collectAIChannels(env) {
	const channelPrefixes = new Set()
	const channelKeyPattern = /^(IMAGE|TTS|VIDEO)_([A-Z0-9]+)_([A-Z0-9_]+)_(BASE_URL|MODELS|PRICE_MULTIPLIER|API_KEY)$/
	for (const key of Object.keys(env)) {
		const match = channelKeyPattern.exec(key)
		if (!match) {
			continue
		}

		const providerPrefix = `${match[1]}_${match[2]}`
		const providerConfig = AI_ASYNC_PROVIDER_CONFIGS.find((item) => {
			return item.prefix === providerPrefix
		})
		if (!providerConfig) {
			throw new Error(`${providerPrefix}_CHANNEL_PROVIDER_UNSUPPORTED`)
		}
		channelPrefixes.add(`${providerPrefix}_${match[3]}`)
	}

	const channels = []
	for (const prefix of channelPrefixes) {
		const baseUrlKey = `${prefix}_BASE_URL`
		const modelsKey = `${prefix}_MODELS`
		const priceMultiplierKey = `${prefix}_PRICE_MULTIPLIER`
		const apiKeyKey = `${prefix}_API_KEY`
		requireConfigValue(env, baseUrlKey)
		requireConfigValue(env, modelsKey)
		requireConfigValue(env, priceMultiplierKey)
		requireSecret(env, apiKeyKey)

		const models = String(env[modelsKey])
			.split(';')
			.map((model) => {
				return model.trim()
			})
			.filter((model) => {
				return model !== ''
			})
		if (models.length === 0) {
			throw new Error(`${modelsKey}_INVALID`)
		}

		const priceMultiplier = Number(env[priceMultiplierKey])
		if (!Number.isFinite(priceMultiplier) || priceMultiplier <= 0) {
			throw new Error(`${priceMultiplierKey}_INVALID`)
		}

		channels.push({
			prefix,
			baseUrlKey,
			modelsKey,
			priceMultiplierKey,
			apiKeyKey,
			models
		})
	}

	for (const providerConfig of AI_ASYNC_PROVIDER_CONFIGS) {
		const baseUrl = String(env[`${providerConfig.prefix}_BASE_URL`] ?? '').trim()
		const defaultModel = String(env[providerConfig.defaultModelKey] ?? '').trim()
		const providerChannels = channels.filter((channel) => {
			return channel.prefix.startsWith(`${providerConfig.prefix}_`)
		})
		if (baseUrl === '' && defaultModel === '' && providerChannels.length === 0) {
			continue
		}
		if (
			defaultModel === '' ||
			!providerChannels.some((channel) => {
				return channel.models.includes(defaultModel)
			})
		) {
			throw new Error(`${providerConfig.prefix}_DEFAULT_MODEL_CHANNEL_MISSING`)
		}
	}

	return channels
}

function requireConfigValue(env, key) {
	if (String(env[key] ?? '').trim() === '') {
		throw new Error(`${key}_MISSING`)
	}
}

function validateEnabledAuthProvider(env, provider) {
	if (env[`${provider}_AUTH_ENABLED`] !== 'true') {
		return
	}

	requireSecret(env, `${provider}_CLIENT_ID`)
	requireSecret(env, `${provider}_CLIENT_SECRET`)
}

function validatePaymentRuntimeConfig(env) {
	if (env.PAYMENT_ENABLED !== 'true') {
		return
	}

	const products = parsePaymentProducts(env.PAYMENT_PRODUCTS)
	if (products.length === 0) {
		throw new Error('PAYMENT_PRODUCTS_MISSING')
	}

	const providers = collectPaymentProviders(products)
	if (!providers.includes(env.PAYMENT_PROVIDER)) {
		throw new Error('PAYMENT_PROVIDER_INVALID')
	}

	validatePaymentCountryOverrides(env.PAYMENT_PROVIDER_COUNTRY_OVERRIDES, providers)

	if (providers.includes('dodo')) {
		requireSecret(env, 'PAYMENT_DODO_API_KEY')
		requireSecret(env, 'PAYMENT_DODO_WEBHOOK_SECRET')
	}
	if (providers.includes('creem')) {
		requireSecret(env, 'PAYMENT_CREEM_API_KEY')
		requireSecret(env, 'PAYMENT_CREEM_WEBHOOK_SECRET')
	}
}

function parsePaymentProducts(raw) {
	const text = String(raw ?? '').trim()
	if (text === '') {
		return []
	}

	const products = JSON.parse(text)
	if (!Array.isArray(products)) {
		throw new Error('PAYMENT_PRODUCTS_INVALID')
	}
	return products
}

function collectPaymentProviders(products) {
	const providers = []
	for (const product of products) {
		const productProviders = product?.providers
		if (typeof productProviders !== 'object' || productProviders === null || Array.isArray(productProviders)) {
			throw new Error('PAYMENT_PRODUCTS_INVALID')
		}
		for (const provider of Object.keys(productProviders)) {
			if (provider !== 'dodo' && provider !== 'creem') {
				throw new Error('PAYMENT_PROVIDER_INVALID')
			}
			if (!providers.includes(provider)) {
				providers.push(provider)
			}
		}
	}
	return providers
}

function validatePaymentCountryOverrides(raw, providers) {
	const text = String(raw ?? '').trim()
	if (text === '') {
		return
	}

	const overrides = JSON.parse(text)
	if (!Array.isArray(overrides)) {
		throw new Error('PAYMENT_PROVIDER_COUNTRY_OVERRIDES_INVALID')
	}

	for (const override of overrides) {
		const provider = String(override?.provider ?? '').trim()
		const country = String(override?.country ?? '').trim()
		if (country === '' || !providers.includes(provider)) {
			throw new Error('PAYMENT_PROVIDER_COUNTRY_OVERRIDES_INVALID')
		}
	}
}

function aiPrimarySecretKeys() {
	return [
		'CHAT_OPENAI_API_KEY',
		'IMAGE_GEMINI_API_KEY',
		'IMAGE_OPENAI_API_KEY',
		'IMAGE_SEEDDREAM_API_KEY',
		'IMAGE_ALIYUN_API_KEY',
		'TTS_GEMINI_API_KEY',
		'TTS_SEED_API_KEY',
		'REALTIME_DOUBAO_API_KEY',
		'VIDEO_SEEDDANCE_API_KEY'
	]
}

function requireSecret(env, key) {
	if (String(env[key] ?? '').trim() === '') {
		throw new Error(`${key}_MISSING`)
	}
}

function validateConfigEncryptionKey(value) {
	const encoded = String(value).trim()
	const key = Buffer.from(encoded, 'base64')
	if (key.byteLength !== 32 || key.toString('base64') !== encoded) {
		throw new Error('CONFIG_ENCRYPTION_KEY_INVALID')
	}
}

export function readAdminConfig(env) {
	const email = String(env.SYSTEM_EMAIL ?? '').trim().toLowerCase()
	if (email === '') {
		throw new Error('SYSTEM_EMAIL_MISSING')
	}

	const password = String(env.SUPER_ADMIN_PASSWORD ?? '')
	if (password === '') {
		throw new Error('SUPER_ADMIN_PASSWORD_MISSING')
	}

	return {
		email,
		password
	}
}

function ensureSvelteWorkerBuild() {
	if (
		existsSync(SVELTE_WORKER_PATH) &&
		existsSync(SVELTE_SERVER_PATH) &&
		existsSync(SVELTE_MANIFEST_PATH) &&
		manifestServerImportsExist()
	) {
		return
	}

	console.log('\nMissing Svelte build output, building Svelte worker once...')
	run('pnpm exec vite build')
}

function manifestServerImportsExist() {
	const manifest = readFileSync(SVELTE_MANIFEST_PATH, 'utf-8')
	const importMatches = manifest.matchAll(/['"]\.\.\/output\/server\/([^'"]+)['"]/g)

	for (const match of importMatches) {
		if (!existsSync(join('.svelte-kit/output/server', match[1]))) {
			return false
		}
	}

	return true
}

function parseQueueNames(rawValue) {
	if (!rawValue) {
		return []
	}

	const names = rawValue
		.split(';')
		.map((name) => name.trim())
		.filter((name) => name !== '')

	return [...new Set(names)]
}

function parseDurableObjectNames(rawValue) {
	if (!rawValue) {
		return []
	}

	const names = rawValue
		.split(';')
		.map((name) => name.trim())
		.filter((name) => name !== '')

	for (const name of names) {
		if (!/^[a-z][a-z0-9-]*$/.test(name)) {
			throw new Error('DO_NAMES_INVALID')
		}
	}

	return [...new Set(names)]
}

function durableObjectBindingName(name) {
	return `DO_${name.replaceAll('-', '_').toUpperCase()}`
}

function durableObjectClassName(name) {
	return `${name
		.split('-')
		.map((part) => {
			return `${part[0].toUpperCase()}${part.slice(1)}`
		})
		.join('')}DO`
}

function buildDurableObjectConfig(names) {
	const classes = names.map((name) => {
		return {
			bindingName: durableObjectBindingName(name),
			className: durableObjectClassName(name)
		}
	})

	return {
		bindings: classes.map((item) => {
			return {
				name: item.bindingName,
				class_name: item.className
			}
		}),
		migration: {
			tag: 'v1',
			new_sqlite_classes: classes.map((item) => {
				return item.className
			})
		}
	}
}

export function parseQueueMaxConcurrency(rawValue) {
	if (!rawValue || rawValue.trim() === '') {
		return undefined
	}

	const maxConcurrency = Number(rawValue)
	if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1 || maxConcurrency > 250) {
		throw new Error('QUEUE_MAX_CONCURRENCY_INVALID')
	}

	return maxConcurrency
}

export function buildQueueConsumers(queueNames, rawMaxConcurrency) {
	const maxConcurrency = parseQueueMaxConcurrency(rawMaxConcurrency)

	return queueNames.map((queueName) => {
		const consumer = {
			queue: queueName
		}

		if (maxConcurrency !== undefined) {
			consumer.max_concurrency = maxConcurrency
		}

		return consumer
	})
}

function queueBindingName(queueName) {
	return `Q_${queueName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`
}

function shellQuote(value) {
	return `'${String(value).replaceAll("'", "'\\''")}'`
}

export function buildD1ExecuteCommand(input) {
	const jsonFlag = input.json ? ' --json' : ''
	return `pnpm exec wrangler d1 execute ${input.databaseName} ${input.migrateFlag}${jsonFlag} --command ${shellQuote(input.sql)}`
}

function buildD1CreatePayload(name, region) {
	if (region === undefined || region === '') {
		return { name }
	}
	return {
		name,
		primary_location_hint: region
	}
}

function buildShardRegistryUpsertSql(shard, databaseId, nowMs) {
	return [
		'INSERT INTO d1_shards',
		'(id, binding_name, database_name, database_id, region, status, assigned_count, created_at, updated_at)',
		'VALUES',
		`(${sqlString(shard.id)}, ${sqlString(shard.bindingName)}, ${sqlString(shard.databaseName)}, ${sqlString(databaseId)}, ${sqlString(shard.region)}, 'active', 0, ${nowMs}, ${nowMs})`,
		'ON CONFLICT(id) DO UPDATE SET',
		`binding_name = ${sqlString(shard.bindingName)},`,
		`database_name = ${sqlString(shard.databaseName)},`,
		`database_id = ${sqlString(databaseId)},`,
		`region = ${sqlString(shard.region)},`,
		"status = 'active',",
		`updated_at = ${nowMs}`
	].join(' ')
}

function sqlString(value) {
	return `'${String(value).replaceAll("'", "''")}'`
}

export function encryptInitializationSecret(encryptionKey, value) {
	const key = Buffer.from(String(encryptionKey).trim(), 'base64')
	if (key.byteLength !== 32 || key.toString('base64') !== String(encryptionKey).trim()) {
		throw new Error('CONFIG_ENCRYPTION_KEY_INVALID')
	}

	const iv = randomBytes(12)
	const cipher = createCipheriv('aes-256-gcm', key, iv)
	const ciphertext = Buffer.concat([
		cipher.update(String(value), 'utf8'),
		cipher.final(),
		cipher.getAuthTag()
	])
	return {
		ciphertext: ciphertext.toString('base64'),
		iv: iv.toString('base64')
	}
}

export function buildSystemSettingsInitializationSql(input) {
	const emptyAIProvider = {
		enabled: false,
		baseUrl: null,
		defaultModel: null,
		apiKey: null
	}
	const generalConfig = {
		designSystem: 'apple-saas',
		docsEnabled: true
	}
	const authenticationConfig = {
		betaCodeEnabled: false,
		emailSignupEnabled: false,
		emailSignupDomainAllowlist: [],
		emailRequireVerification: false,
		emailUserActionCooldownSeconds: 50,
		turnstile: {
			enabled: false,
			siteKey: input.siteKey,
			secretKey: {
				ciphertext: input.secretKeyCiphertext,
				iv: input.secretKeyIv
			}
		},
		providers: {
			google: { enabled: false, clientId: null, clientSecret: null },
			github: { enabled: false, clientId: null, clientSecret: null },
			linuxdo: { enabled: false, clientId: null, clientSecret: null }
		}
	}
	const emailConfig = {
		enabled: false,
		provider: null,
		resendApiKey: null
	}
	const storageConfig = {
		allowedContentTypes: ['image/png', 'image/jpeg', 'image/webp'],
		maxUploadBytes: 5_242_880
	}
	const creditsConfig = {
		signupEnabled: false,
		signupAmount: 100_000_000,
		dailyCheckinEnabled: false,
		dailyCheckinAmount: 10_000_000,
		historyRetentionDays: 90
	}
	const affiliateConfig = {
		enabled: false,
		inviterCreditAmount: 50_000_000,
		inviteeCreditAmount: 20_000_000
	}
	const paymentConfig = {
		enabled: false,
		defaultProvider: null,
		providerCountryOverrides: [],
		providers: {
			dodo: { testMode: true, apiKey: null, webhookSecret: null },
			creem: { testMode: true, apiKey: null, webhookSecret: null }
		}
	}
	const aiConfig = {
		routing: {
			errorWeight: 1,
			latencyWeight: 0.8,
			priceWeight: 0.2
		},
		taskRetentionDays: 30,
		providers: {
			chatOpenai: emptyAIProvider,
			imageGemini: emptyAIProvider,
			imageOpenai: emptyAIProvider,
			imageSeedream: emptyAIProvider,
			imageAliyun: emptyAIProvider,
			ttsGemini: emptyAIProvider,
			ttsSeed: emptyAIProvider,
			realtimeDoubao: emptyAIProvider,
			videoSeedance: emptyAIProvider
		}
	}

	return [
		'INSERT INTO system_settings',
		'(id, general_config, general_version, general_updated_at, authentication_config, authentication_version, authentication_updated_at, email_config, email_version, email_updated_at, storage_config, storage_version, storage_updated_at, credits_config, credits_version, credits_updated_at, affiliate_config, affiliate_version, affiliate_updated_at, payment_config, payment_version, payment_updated_at, ai_config, ai_version, ai_updated_at, created_at)',
		'VALUES',
		`(1, ${sqlString(JSON.stringify(generalConfig))}, 1, ${input.nowMs}, ${sqlString(JSON.stringify(authenticationConfig))}, 1, ${input.nowMs}, ${sqlString(JSON.stringify(emailConfig))}, 1, ${input.nowMs}, ${sqlString(JSON.stringify(storageConfig))}, 1, ${input.nowMs}, ${sqlString(JSON.stringify(creditsConfig))}, 1, ${input.nowMs}, ${sqlString(JSON.stringify(affiliateConfig))}, 1, ${input.nowMs}, ${sqlString(JSON.stringify(paymentConfig))}, 1, ${input.nowMs}, ${sqlString(JSON.stringify(aiConfig))}, 1, ${input.nowMs}, ${input.nowMs})`,
		'ON CONFLICT(id) DO NOTHING'
	].join(' ')
}

export function buildAgentOAuthClientUpsertSql(input) {
	const redirectUri = new URL('/api/agent/authorization_callback', input.baseUrl).toString()
	const scopes = JSON.stringify(['agent', 'offline_access'])
	const redirectUris = JSON.stringify([redirectUri])
	const grantTypes = JSON.stringify(['authorization_code', 'refresh_token'])
	const responseTypes = JSON.stringify(['code'])
	return [
		'INSERT INTO oauth_client',
		'(id, client_id, disabled, skip_consent, scopes, created_at, updated_at, name, redirect_uris, token_endpoint_auth_method, grant_types, response_types, public, type, require_pkce)',
		'VALUES',
		`('opcstack-agent', 'opcstack-agent', 0, 0, ${sqlString(scopes)}, ${input.nowMs}, ${input.nowMs}, 'OPCStack Agent', ${sqlString(redirectUris)}, 'none', ${sqlString(grantTypes)}, ${sqlString(responseTypes)}, 1, 'user-agent-based', 1)`,
		'ON CONFLICT(client_id) DO UPDATE SET',
		`disabled = 0, skip_consent = 0, scopes = ${sqlString(scopes)}, updated_at = ${input.nowMs}, redirect_uris = ${sqlString(redirectUris)}, token_endpoint_auth_method = 'none', grant_types = ${sqlString(grantTypes)}, response_types = ${sqlString(responseTypes)}, public = 1, type = 'user-agent-based', require_pkce = 1`
	].join(' ')
}

export function buildOAuthClientUpsertSql(input) {
	const redirectUri = new URL('/api/oauth/authorization_callback', input.baseUrl).toString()
	const scopes = JSON.stringify(['api_access', 'offline_access'])
	const redirectUris = JSON.stringify([redirectUri])
	const grantTypes = JSON.stringify(['authorization_code', 'refresh_token'])
	const responseTypes = JSON.stringify(['code'])
	return [
		'INSERT INTO oauth_client',
		'(id, client_id, disabled, skip_consent, scopes, created_at, updated_at, name, redirect_uris, token_endpoint_auth_method, grant_types, response_types, public, type, require_pkce)',
		'VALUES',
		`('opc-cli', 'opc-cli', 0, 0, ${sqlString(scopes)}, ${input.nowMs}, ${input.nowMs}, 'OPC CLI', ${sqlString(redirectUris)}, 'none', ${sqlString(grantTypes)}, ${sqlString(responseTypes)}, 1, 'native', 1)`,
		'ON CONFLICT(client_id) DO UPDATE SET',
		`disabled = 0, skip_consent = 0, scopes = ${sqlString(scopes)}, updated_at = ${input.nowMs}, redirect_uris = ${sqlString(redirectUris)}, token_endpoint_auth_method = 'none', grant_types = ${sqlString(grantTypes)}, response_types = ${sqlString(responseTypes)}, public = 1, type = 'native', require_pkce = 1`
	].join(' ')
}

export function hashAdminPassword(password) {
	const saltHex = randomBytes(8).toString('hex')
	const digestHex = createHash('sha1').update(`${password}:${saltHex}`).digest('hex')
	return `${saltHex}:${digestHex}`
}

export function buildAdminUserUpsertSql(input) {
	return [
		'INSERT INTO "user"',
		'(id, name, email, aff_code, email_verified, created_at, updated_at)',
		'VALUES',
		`(${sqlString(input.userId)}, ${sqlString(input.email)}, ${sqlString(input.email)}, ${sqlString(input.affCode)}, 1, ${input.nowMs}, ${input.nowMs})`,
		'ON CONFLICT(email) DO NOTHING'
	].join(' ')
}

export function buildAdminCredentialAccountUpsertSql(input) {
	const userIdSql = `(SELECT id FROM "user" WHERE email = ${sqlString(input.email)})`
	return [
		'UPDATE account SET',
		`password = ${sqlString(input.passwordHash)},`,
		`updated_at = ${input.nowMs}`,
		`WHERE provider_id = 'credential' AND user_id = ${userIdSql};`,
		'INSERT INTO account',
		'(id, account_id, provider_id, user_id, password, created_at, updated_at)',
		'SELECT',
		`'credential:' || id, id, 'credential', id, ${sqlString(input.passwordHash)}, ${input.nowMs}, ${input.nowMs}`,
		'FROM "user"',
		`WHERE email = ${sqlString(input.email)}`,
		`AND NOT EXISTS (SELECT 1 FROM account WHERE user_id = "user".id AND provider_id = 'credential')`
	].join(' ')
}

export function buildAdminUserShardEnsureSql(input) {
	const userIdSql = `(SELECT id FROM "user" WHERE email = ${sqlString(input.email)})`
	return [
		'INSERT INTO user_shards',
		'(user_id, shard_id, created_at)',
		'SELECT',
		`${userIdSql}, id, ${input.nowMs}`,
		'FROM d1_shards',
		`WHERE status = 'active'`,
		`AND NOT EXISTS (SELECT 1 FROM user_shards WHERE user_id = ${userIdSql})`,
		'ORDER BY assigned_count ASC, id ASC',
		'LIMIT 1;',
		'UPDATE d1_shards SET',
		`assigned_count = assigned_count + 1, updated_at = ${input.nowMs}`,
		`WHERE id = (SELECT shard_id FROM user_shards WHERE user_id = ${userIdSql})`,
		`AND EXISTS (SELECT 1 FROM user_shards WHERE user_id = ${userIdSql} AND created_at = ${input.nowMs});`,
		`SELECT shard_id FROM user_shards WHERE user_id = ${userIdSql}`
	].join(' ')
}

export function buildAdminCreditBalanceEnsureSql(input) {
	return [
		'INSERT INTO credit_balances',
		'(user_id, balance, updated_at)',
		'VALUES',
		`(${sqlString(input.userId)}, 0, ${input.nowMs})`,
		'ON CONFLICT(user_id) DO NOTHING'
	].join(' ')
}

function buildAdminUserSelectSql(email) {
	return `SELECT id FROM "user" WHERE email = ${sqlString(email)}`
}

function readD1ExecuteValue(output, key) {
	const executions = JSON.parse(output)
	let index = executions.length - 1
	while (index >= 0) {
		const rows = executions[index]?.results
		if (Array.isArray(rows) && rows.length > 0 && rows[0][key] !== undefined) {
			return String(rows[0][key])
		}
		index -= 1
	}
	throw new Error(`D1_VALUE_MISSING_${key}`)
}

function createAdminAffCode() {
	return randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
}

function syncSuperAdminUser(adminConfig, metaDbName, migrateFlag, shards) {
	const nowMs = Date.now()
	const passwordHash = hashAdminPassword(adminConfig.password)
	run(buildD1ExecuteCommand({
		databaseName: metaDbName,
		migrateFlag,
		sql: buildAdminUserUpsertSql({
			email: adminConfig.email,
			userId: randomUUID(),
			affCode: createAdminAffCode(),
			nowMs
		}),
		json: false
	}))
	run(buildD1ExecuteCommand({
		databaseName: metaDbName,
		migrateFlag,
		sql: buildAdminCredentialAccountUpsertSql({
			email: adminConfig.email,
			passwordHash,
			nowMs
		}),
		json: false
	}))

	const shardOutput = runOutput(buildD1ExecuteCommand({
		databaseName: metaDbName,
		migrateFlag,
		sql: buildAdminUserShardEnsureSql({
			email: adminConfig.email,
			nowMs
		}),
		json: true
	}))
	const shardId = readD1ExecuteValue(shardOutput, 'shard_id')
	const shard = shards.find((item) => {
		return item.id === shardId
	})
	if (!shard) {
		throw new Error('SUPER_ADMIN_SHARD_MISSING')
	}

	const userOutput = runOutput(buildD1ExecuteCommand({
		databaseName: metaDbName,
		migrateFlag,
		sql: buildAdminUserSelectSql(adminConfig.email),
		json: true
	}))
	const userId = readD1ExecuteValue(userOutput, 'id')
	run(buildD1ExecuteCommand({
		databaseName: shard.databaseName,
		migrateFlag,
		sql: buildAdminCreditBalanceEnsureSql({
			userId,
			nowMs
		}),
		json: false
	}))
}

function parseCronExpressions(rawValue) {
	if (!rawValue) {
		return []
	}

	return rawValue
		.split(';')
		.map((value) => value.trim())
		.filter((value) => value !== '')
}

export function parseR2TmpLifecycleRules(rawValue) {
	if (!rawValue) {
		return []
	}

	const rules = []
	const prefixes = new Set()
	const parts = rawValue
		.split(';')
		.map((value) => value.trim())
		.filter((value) => value !== '')

	for (const part of parts) {
		const separatorIndex = part.lastIndexOf(':')
		if (separatorIndex === -1) {
			throw new Error('R2_TMP_LIFECYCLE_RULE_INVALID')
		}

		const prefix = part.slice(0, separatorIndex).trim()
		const expireDays = Number(part.slice(separatorIndex + 1).trim())
		if (prefix !== 'tmp/public/' && prefix !== 'tmp/private/') {
			throw new Error('R2_TMP_LIFECYCLE_PREFIX_INVALID')
		}
		if (!Number.isInteger(expireDays) || expireDays <= 0) {
			throw new Error('R2_TMP_LIFECYCLE_DAYS_INVALID')
		}
		if (prefixes.has(prefix)) {
			throw new Error('R2_TMP_LIFECYCLE_PREFIX_DUPLICATED')
		}

		prefixes.add(prefix)
		rules.push({
			id: `expire-${prefix.slice(0, -1).replaceAll('/', '-')}`,
			prefix,
			expireDays
		})
	}

	return rules
}

export function buildR2LifecyclePayload(rules) {
	return {
		rules: rules.map((rule) => {
			return {
				id: rule.id,
				enabled: true,
				conditions: {
					prefix: rule.prefix
				},
				deleteObjectsTransition: {
					condition: {
						type: 'Age',
						maxAge: rule.expireDays * 24 * 60 * 60
					}
				}
			}
		})
	}
}

async function cfApiRequest(token, method, path, body) {
	const endpoint = `https://api.cloudflare.com/client/v4${path}`
	const response = await fetch(endpoint, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: body ? JSON.stringify(body) : undefined
	})

	const text = await response.text()
	let payload
	try {
		payload = text ? JSON.parse(text) : undefined
	} catch {
		payload = undefined
	}

	if (!response.ok || payload?.success === false) {
		console.error('Cloudflare API request failed')
		console.error(`${method} ${path}`)
		console.error(`Status: ${response.status}`)
		if (text) {
			console.error(text)
		}
		process.exit(1)
	}

	return payload?.result
}

async function getSingleCloudflareAccountId(token) {
	const memberships = await cfApiRequest(token, 'GET', '/memberships', undefined)
	const accounts = Array.isArray(memberships)
		? memberships.map((membership) => membership?.account).filter(Boolean)
		: []

	if (accounts.length !== 1) {
		console.error(`Expected exactly one Cloudflare account from memberships API got ${accounts.length}`)
		process.exit(1)
	}

	const accountId = accounts[0]?.id
	if (!accountId) {
		console.error('Failed to get account id from memberships API')
		process.exit(1)
	}

	return accountId
}

async function listD1Databases(accountId, token) {
	const result = await cfApiRequest(
		token,
		'GET',
		`/accounts/${accountId}/d1/database?per_page=100&page=1`,
		undefined
	)
	return Array.isArray(result) ? result : []
}

async function createD1Database(accountId, token, name, region) {
	return cfApiRequest(token, 'POST', `/accounts/${accountId}/d1/database`, buildD1CreatePayload(name, region))
}

async function listQueues(accountId, token) {
	const result = await cfApiRequest(token, 'GET', `/accounts/${accountId}/queues?page=1`, undefined)
	return Array.isArray(result) ? result : []
}

async function createQueue(accountId, token, queueName) {
	return cfApiRequest(token, 'POST', `/accounts/${accountId}/queues`, { queue_name: queueName })
}

async function listR2Buckets(accountId, token) {
	const result = await cfApiRequest(token, 'GET', `/accounts/${accountId}/r2/buckets`, undefined)
	if (Array.isArray(result?.buckets)) {
		return result.buckets
	}
	return []
}

async function createR2Bucket(accountId, token, name) {
	return cfApiRequest(token, 'POST', `/accounts/${accountId}/r2/buckets`, { name })
}

function buildR2CorsPayload(appBaseUrl, appCnDomain) {
	const origins = [appBaseUrl]
	if (appCnDomain !== '') {
		origins.push(`https://${appCnDomain}`)
	}

	return {
		rules: [
			{
				id: 'opcstack-browser-upload',
				allowed: {
					methods: ['PUT'],
					origins,
					headers: ['content-type']
				},
				maxAgeSeconds: 3600
			}
		]
	}
}

async function listZones(accountId, token) {
	const result = await cfApiRequest(
		token,
		'GET',
		`/zones?account.id=${encodeURIComponent(accountId)}&per_page=50&page=1`,
		undefined
	)
	return Array.isArray(result) ? result : []
}

async function listDnsRecords(zoneId, token, name) {
	const params = new URLSearchParams({
		name,
		per_page: '100',
		page: '1'
	})
	const result = await cfApiRequest(
		token,
		'GET',
		`/zones/${zoneId}/dns_records?${params.toString()}`,
		undefined
	)
	return Array.isArray(result) ? result : []
}

async function createDnsCnameRecord(zoneId, token, name, target) {
	return cfApiRequest(
		token,
		'POST',
		`/zones/${zoneId}/dns_records`,
		buildDnsCnameRecordPayload(name, target)
	)
}

async function updateDnsCnameRecord(zoneId, token, recordId, name, target) {
	return cfApiRequest(
		token,
		'PUT',
		`/zones/${zoneId}/dns_records/${recordId}`,
		buildDnsCnameRecordPayload(name, target)
	)
}

async function ensureAppCnDnsRecord(accountId, token, appCnDomain, appCnCnameTarget) {
	if (appCnDomain === '' || appCnCnameTarget === '') {
		return ''
	}

	const zones = await listZones(accountId, token)
	const zone = selectCloudflareZone(zones, appCnDomain)
	if (!zone?.id || !zone.name) {
		console.error(`Cloudflare zone not found for APP_CN_DOMAIN ${appCnDomain}`)
		process.exit(1)
	}

	const records = await listDnsRecords(zone.id, token, appCnDomain)
	let record
	try {
		record = selectDnsCnameRecord(records, appCnDomain)
	} catch (error) {
		console.error(error.message)
		process.exit(1)
	}

	if (!record) {
		console.log(`Creating DNS CNAME '${appCnDomain}' -> '${appCnCnameTarget}'...`)
		await createDnsCnameRecord(zone.id, token, appCnDomain, appCnCnameTarget)
		return zone.name
	}

	if (record.content === appCnCnameTarget && record.proxied === false) {
		console.log(`DNS CNAME '${appCnDomain}' already points to '${appCnCnameTarget}'.`)
		return zone.name
	}

	console.log(`Updating DNS CNAME '${appCnDomain}' -> '${appCnCnameTarget}'...`)
	await updateDnsCnameRecord(zone.id, token, record.id, appCnDomain, appCnCnameTarget)
	return zone.name
}

async function enableImageTransformations(accountId, token, rawDomain) {
	const host = resolveCloudflareHost(rawDomain)
	const zones = await listZones(accountId, token)
	const zone = selectCloudflareZone(zones, host)
	if (!zone?.id) {
		console.error(`Cloudflare zone not found for APP_DOMAIN ${host}`)
		process.exit(1)
	}

	await cfApiRequest(token, 'PATCH', `/zones/${zone.id}/settings/transformations`, {
		value: 'on'
	})
	console.log(`Image Transformations enabled for zone '${zone.name}'`)
}

async function putR2LifecycleRules(accountId, token, bucketName, rules) {
	await cfApiRequest(
		token,
		'PUT',
		`/accounts/${accountId}/r2/buckets/${bucketName}/lifecycle`,
		buildR2LifecyclePayload(rules)
	)
}

async function putR2CorsRules(accountId, token, bucketName, appBaseUrl, appCnDomain) {
	await cfApiRequest(
		token,
		'PUT',
		`/accounts/${accountId}/r2/buckets/${bucketName}/cors`,
		buildR2CorsPayload(appBaseUrl, appCnDomain)
	)
}

async function listKVNamespaces(accountId, token) {
	const result = await cfApiRequest(
		token,
		'GET',
		`/accounts/${accountId}/storage/kv/namespaces?per_page=100&order=title&direction=asc&page=1`,
		undefined
	)
	return Array.isArray(result) ? result : []
}

async function createKVNamespace(accountId, token, title) {
	return cfApiRequest(token, 'POST', `/accounts/${accountId}/storage/kv/namespaces`, { title })
}

async function listTurnstileWidgets(accountId, token) {
	const result = await cfApiRequest(
		token,
		'GET',
		`/accounts/${accountId}/challenges/widgets?per_page=100&page=1`,
		undefined
	)
	return Array.isArray(result) ? result : []
}

async function createTurnstileWidget(accountId, token, name, domains) {
	return cfApiRequest(token, 'POST', `/accounts/${accountId}/challenges/widgets`, {
		name,
		domains,
		mode: 'managed',
		region: 'world'
	})
}

async function getTurnstileWidget(accountId, token, sitekey) {
	return cfApiRequest(token, 'GET', `/accounts/${accountId}/challenges/widgets/${sitekey}`, undefined)
}

async function updateTurnstileWidget(accountId, token, widget, domains) {
	return cfApiRequest(token, 'PUT', `/accounts/${accountId}/challenges/widgets/${widget.sitekey}`, {
		name: widget.name,
		domains,
		mode: widget.mode
	})
}

function hasSameStringSet(actual, expected) {
	if (!Array.isArray(actual) || actual.length !== expected.length) {
		return false
	}

	for (const item of expected) {
		if (!actual.includes(item)) {
			return false
		}
	}

	return true
}

async function ensureTurnstileWidget(accountId, token, appName, domains) {
	let widgets = await listTurnstileWidgets(accountId, token)
	let widget = selectTurnstileWidget(widgets, appName)
	if (widget) {
		console.log(`Turnstile widget '${appName}' already exists.`)
		const existingWidget = await getTurnstileWidget(accountId, token, widget.sitekey)
		if (hasSameStringSet(existingWidget.domains, domains)) {
			return existingWidget
		}

		console.log(`Updating Turnstile widget '${appName}' domains...`)
		return updateTurnstileWidget(accountId, token, existingWidget, domains)
	}

	console.log(`Creating Turnstile widget '${appName}'...`)
	await createTurnstileWidget(accountId, token, appName, domains)
	widgets = await listTurnstileWidgets(accountId, token)
	widget = selectTurnstileWidget(widgets, appName)
	if (!widget) {
		console.error('Failed to get Turnstile widget after creation')
		process.exit(1)
	}

	return getTurnstileWidget(accountId, token, widget.sitekey)
}

async function enableD1ReadReplication(accountId, databaseId, token) {
	await cfApiRequest(token, 'PUT', `/accounts/${accountId}/d1/database/${databaseId}`, {
		read_replication: {
			mode: 'auto'
		}
	})
}

function readCachedCloudflareApiToken() {
	if (!existsSync(CLOUDFLARE_TOKEN_CACHE_PATH)) {
		return ''
	}

	const cachedPermissions = existsSync(CLOUDFLARE_TOKEN_PERMISSION_CACHE_PATH)
		? readFileSync(CLOUDFLARE_TOKEN_PERMISSION_CACHE_PATH, 'utf-8').trim()
		: ''
	if (cachedPermissions !== CLOUDFLARE_TOKEN_PERMISSION_FINGERPRINT) {
		console.log('Cloudflare API token permissions changed. Create a new token.')
		return ''
	}

	return readFileSync(CLOUDFLARE_TOKEN_CACHE_PATH, 'utf-8').trim()
}

function writeCachedCloudflareApiToken(token) {
	mkdirSync('.wrangler', { recursive: true })
	writeFileSync(CLOUDFLARE_TOKEN_CACHE_PATH, `${token}\n`, { mode: 0o600 })
	writeFileSync(CLOUDFLARE_TOKEN_PERMISSION_CACHE_PATH, `${CLOUDFLARE_TOKEN_PERMISSION_FINGERPRINT}\n`, { mode: 0o600 })
}

function isCI() {
	return process.env.CI === 'true'
}

async function promptCloudflareApiToken() {
	console.log('Cloudflare API token is required for remote deploy.')
	console.log('Create a token with permissions:')
	console.log('- API Tokens:Edit')
	console.log('- Zone:Read')
	console.log('- Zone Settings:Edit')
	console.log('- DNS:Edit')
	console.log('- Workers Scripts:Edit')
	console.log('- Workers KV Storage:Edit')
	console.log('- Workers Routes:Edit')
	console.log('- Workers R2 Storage:Edit')
	console.log('- D1:Edit')
	console.log('- Queues:Edit')
	console.log('- Turnstile:Edit')
	console.log(`\nOpen and create token: ${CLOUDFLARE_TOKEN_TEMPLATE_URL}\n`)

	const rl = createInterface({ input, output })
	const token = (await rl.question('Paste Cloudflare API token to here: ')).trim()
	rl.close()

	if (token === '') {
		console.error('CLOUDFLARE_API_TOKEN_MISSING')
		process.exit(1)
	}

	writeCachedCloudflareApiToken(token)
	console.log(`Cloudflare API token saved to ${CLOUDFLARE_TOKEN_CACHE_PATH}`)
	return token
}

async function getCloudflareApiToken() {
	if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_API_TOKEN.trim() !== '') {
		console.log('Using Cloudflare API token from CLOUDFLARE_API_TOKEN')
		return process.env.CLOUDFLARE_API_TOKEN.trim()
	}

	const cachedToken = readCachedCloudflareApiToken()
	if (cachedToken !== '') {
		console.log(`Using Cloudflare API token from ${CLOUDFLARE_TOKEN_CACHE_PATH}`)
		return cachedToken
	}

	if (isCI()) {
		console.error('Missing CLOUDFLARE_API_TOKEN')
		console.error(`Create token: ${CLOUDFLARE_TOKEN_TEMPLATE_URL}`)
		process.exit(1)
	}

	return promptCloudflareApiToken()
}

async function main() {
	const mode = readMode()
	const isRemote = mode === 'prod'
	const env = loadEnv(isRemote)
	const adminConfig = readAdminConfig(env)
	resolveAppBase(env, mode)
	resolveAppCnDomain(env)
	resolveAppCnCnameTarget(env)
	validateEmailConfig(env)
	validateRuntimeConfig(env, { isRemote })
	const queueNames = parseQueueNames(env.QUEUE_NAMES)
	const durableObjectNames = parseDurableObjectNames(env.DO_NAMES)
	const cronExpressions = parseCronExpressions(env.CRONS)
	const r2Enabled = env.R2_ENABLED === 'true'
	const r2TmpLifecycleRules = parseR2TmpLifecycleRules(env.R2_TMP_LIFECYCLE_RULES)
	const shardSpecs = parseShardSpecs(env.D1_SHARDS)
	const shards = buildShardDescriptors(env.APP_NAME, shardSpecs)

	console.log(`\nPreparing Cloudflare app (${mode} mode)\n`)

	let databaseId = localD1DatabaseId(0)
	const appName = env.APP_NAME
	const metaDbName = `${env.APP_NAME}-meta`
	const shardDatabaseIds = {}
	let kvNamespaceId = '00000000000000000000000000000000'
	let accountId = ''
	let cloudflareApiToken = ''
	let appCnZoneName = ''

	if (isRemote) {
		console.log('\nResolving Cloudflare API token...')
		cloudflareApiToken = await getCloudflareApiToken()
		process.env.CLOUDFLARE_API_TOKEN = cloudflareApiToken

		console.log('\nResolving Cloudflare account...')
		accountId = await getSingleCloudflareAccountId(cloudflareApiToken)
		console.log(`Account ID: ${accountId}`)

		appCnZoneName = await ensureAppCnDnsRecord(
			accountId,
			cloudflareApiToken,
			env.APP_CN_DOMAIN,
			env.APP_CN_CNAME_TARGET
		)

		console.log('\nChecking D1 databases...')
		let dbs = await listD1Databases(accountId, cloudflareApiToken)
		let existingDB = dbs.find((db) => db.name === metaDbName)
		if (!existingDB) {
			console.log(`Creating D1 database '${metaDbName}'...`)
			await createD1Database(accountId, cloudflareApiToken, metaDbName)
			dbs = await listD1Databases(accountId, cloudflareApiToken)
			existingDB = dbs.find((db) => db.name === metaDbName)
		} else {
			console.log(`Database '${metaDbName}' already exists.`)
		}

		databaseId = existingDB?.uuid
		if (!databaseId) {
			console.error('Failed to get D1 database ID')
			process.exit(1)
		}

		console.log(`Database ID: ${databaseId}`)

		for (const shard of shards) {
			let existingShardDB = dbs.find((db) => db.name === shard.databaseName)
			if (!existingShardDB) {
				console.log(`Creating D1 database '${shard.databaseName}'...`)
				await createD1Database(accountId, cloudflareApiToken, shard.databaseName, shard.region)
				dbs = await listD1Databases(accountId, cloudflareApiToken)
				existingShardDB = dbs.find((db) => db.name === shard.databaseName)
			} else {
				console.log(`Database '${shard.databaseName}' already exists.`)
			}

			if (!existingShardDB?.uuid) {
				console.error(`Failed to get D1 database ID for ${shard.databaseName}`)
				process.exit(1)
			}

			shardDatabaseIds[shard.id] = existingShardDB.uuid
		}
	} else {
		console.log(`Using local Meta D1 database ID: ${databaseId}`)
		let index = 0
		for (const shard of shards) {
			shardDatabaseIds[shard.id] = localD1DatabaseId(index + 1)
			index += 1
		}
	}

	if (isRemote) {
		console.log('\nEnabling D1 read replication...')
		await enableD1ReadReplication(accountId, databaseId, cloudflareApiToken)
		for (const shard of shards) {
			await enableD1ReadReplication(accountId, shardDatabaseIds[shard.id], cloudflareApiToken)
		}
		console.log('D1 read replication enabled')
	}

	if (isRemote && queueNames.length > 0) {
		console.log('\nChecking Queues...')
		let queues = await listQueues(accountId, cloudflareApiToken)

		for (const queueName of queueNames) {
			const existingQueue = queues.find((queue) => {
				return queue.name === queueName || queue.queue_name === queueName
			})
			if (existingQueue) {
				console.log(`Queue '${queueName}' already exists.`)
				continue
			}

			console.log(`Creating Queue '${queueName}'...`)
			await createQueue(accountId, cloudflareApiToken, queueName)
			queues.push({ queue_name: queueName })
		}
	}

	if (isRemote && r2Enabled) {
		console.log('\nChecking R2 bucket...')
		let buckets = await listR2Buckets(accountId, cloudflareApiToken)

		const existingBucket = buckets.find((bucket) => {
			return bucket.name === appName || bucket.bucket_name === appName
		})
		if (!existingBucket) {
			console.log(`Creating R2 bucket '${appName}'...`)
			await createR2Bucket(accountId, cloudflareApiToken, appName)
		} else {
			console.log(`R2 bucket '${appName}' already exists.`)
		}

		console.log('\nSyncing R2 CORS rules...')
		await putR2CorsRules(accountId, cloudflareApiToken, appName, env.APP_BASE_URL, env.APP_CN_DOMAIN)
		console.log('R2 CORS rules synced')

		if (r2TmpLifecycleRules.length > 0) {
			console.log('\nSyncing R2 tmp lifecycle rules...')
			await putR2LifecycleRules(accountId, cloudflareApiToken, appName, r2TmpLifecycleRules)
			console.log('R2 tmp lifecycle rules synced')
		}

		console.log('\nEnabling Image Transformations...')
		await enableImageTransformations(accountId, cloudflareApiToken, env.APP_DOMAIN)
	}

	if (isRemote) {
		console.log('\nChecking KV namespace...')
		let namespaces = await listKVNamespaces(accountId, cloudflareApiToken)

		let existingNamespace = namespaces.find((namespace) => {
			return namespace.title === appName || namespace.name === appName
		})

		if (!existingNamespace) {
			console.log(`Creating KV namespace '${appName}'...`)
			await createKVNamespace(accountId, cloudflareApiToken, appName)
			namespaces = await listKVNamespaces(accountId, cloudflareApiToken)
			existingNamespace = namespaces.find((namespace) => {
				return namespace.title === appName || namespace.name === appName
			})
		} else {
			console.log(`KV namespace '${appName}' already exists.`)
		}

		kvNamespaceId = existingNamespace?.id
		if (!kvNamespaceId) {
			console.error('Failed to get KV namespace ID')
			process.exit(1)
		}

		console.log(`KV namespace ID: ${kvNamespaceId}`)
	}

	let turnstileWidget
	if (isRemote) {
		console.log('\nChecking Turnstile widget...')
		turnstileWidget = await ensureTurnstileWidget(
			accountId,
			cloudflareApiToken,
			env.APP_NAME,
			buildTurnstileDomains(env.APP_DOMAIN, env.APP_CN_DOMAIN)
		)
		console.log(`Turnstile sitekey: ${turnstileWidget.sitekey}`)
	}
	const initialTurnstileConfig = resolveTurnstileInitializationConfig({
		isRemote,
		widget: turnstileWidget
	})

	const turnstileConfig = resolveTurnstileConfig({
		enabled: env.TURNSTILE_ENABLED,
		siteKey: env.TURNSTILE_SITE_KEY,
		isRemote,
		widget: turnstileWidget
	})
	env.TURNSTILE_ENABLED = turnstileConfig.enabled
	env.TURNSTILE_SITE_KEY = turnstileConfig.siteKey
	env.TURNSTILE_SECRET_KEY = turnstileConfig.secretKey

	console.log('\nRendering configuration...')
	env.D1_DATABASE_UUID = databaseId

	const template = readFileSync('wrangler.jsonc.tpl', 'utf-8')
	const rendered = renderTemplate(template, env)

	let config
	try {
		config = JSON.parse(rendered)
	} catch (error) {
		console.error('Failed to parse rendered wrangler.jsonc:', error.message)
		console.error('Rendered content:', rendered)
		process.exit(1)
	}

	config.vars = config.vars || {}
	Object.assign(config.vars, buildAIChannelVars(env))
	writeClientConfig(config.vars)
	await syncPublicAssets()
	ensureSvelteWorkerBuild()

	if (queueNames.length > 0) {
		config.queues = {
			producers: queueNames.map((queueName) => {
				return {
					binding: queueBindingName(queueName),
					queue: queueName
				}
			}),
			consumers: buildQueueConsumers(queueNames, env.QUEUE_MAX_CONCURRENCY)
		}
	}

	if (cronExpressions.length > 0) {
		config.triggers = {
			crons: cronExpressions
		}
	}

	if (durableObjectNames.length > 0) {
		const durableObjectConfig = buildDurableObjectConfig(durableObjectNames)
		config.durable_objects = {
			bindings: durableObjectConfig.bindings
		}
		config.migrations = [durableObjectConfig.migration]
	}

	config.routes = buildWorkerRoutes(
		env.APP_BASE_HOST,
		env.APP_CN_DOMAIN,
		env.APP_CN_CNAME_TARGET,
		appCnZoneName
	)
	config.vars.R2_ENABLED = r2Enabled ? 'true' : 'false'
	config.vars.R2_ACCOUNT_ID = accountId || 'local'
	config.secrets = {
		required: buildRequiredSecretKeys(env)
	}
	config.d1_databases = buildD1DatabaseBindings(appName, databaseId, shards, shardDatabaseIds)

	if (r2Enabled) {
		config.r2_buckets = [
			{
				binding: 'R2',
				bucket_name: appName
			}
		]
	}

	config.kv_namespaces = [
		{
			binding: 'KV',
			id: kvNamespaceId
		}
	]

	writeFileSync('wrangler.jsonc', JSON.stringify(config, null, 4))
	console.log('wrangler.jsonc generated successfully')
	writeTypesWranglerConfig(config)
	writeRuntimeSecrets(env)

	console.log('\nGenerating migrations...')
	run('pnpm exec drizzle-kit generate --config drizzle.meta.config.ts')
	run('pnpm exec drizzle-kit generate --config drizzle.shard.config.ts')

	console.log('\nApplying migrations...')
	const migrateFlag = isRemote ? '--remote' : '--local'
	run(`pnpm exec wrangler d1 migrations apply ${metaDbName} ${migrateFlag}`)
	for (const shard of shards) {
		run(`pnpm exec wrangler d1 migrations apply ${shard.databaseName} ${migrateFlag}`)
	}

	console.log('\nUpserting shard registry...')
	const nowMs = Date.now()
	const encryptedTurnstileSecret = encryptInitializationSecret(
		env.CONFIG_ENCRYPTION_KEY,
		initialTurnstileConfig.secretKey
	)
	run(buildD1ExecuteCommand({
		databaseName: metaDbName,
		migrateFlag,
		sql: buildSystemSettingsInitializationSql({
			siteKey: initialTurnstileConfig.siteKey,
			secretKeyCiphertext: encryptedTurnstileSecret.ciphertext,
			secretKeyIv: encryptedTurnstileSecret.iv,
			nowMs
		}),
		json: false
	}))
	run(buildD1ExecuteCommand({
		databaseName: metaDbName,
		migrateFlag,
		sql: buildAgentOAuthClientUpsertSql({ baseUrl: env.APP_BASE_URL, nowMs }),
		json: false
	}))
	run(buildD1ExecuteCommand({
		databaseName: metaDbName,
		migrateFlag,
		sql: buildOAuthClientUpsertSql({ baseUrl: env.APP_BASE_URL, nowMs }),
		json: false
	}))
	for (const shard of shards) {
		const shardDatabaseId = shardDatabaseIds[shard.id] ?? localD1DatabaseId(0)
		const sql = buildShardRegistryUpsertSql(shard, shardDatabaseId, nowMs)
		run(buildD1ExecuteCommand({
			databaseName: metaDbName,
			migrateFlag,
			sql,
			json: false
		}))
	}

	console.log('\nSyncing super admin user...')
	syncSuperAdminUser(adminConfig, metaDbName, migrateFlag, shards)

	console.log('\nCloudflare app prepared\n')
}

function readMode() {
	if (process.argv.includes('--mode')) {
		const index = process.argv.indexOf('--mode')
		return process.argv[index + 1]
	}

	return 'dev'
}

if (import.meta.url === `file://${process.argv[1]}`) {
	await main()
}
