import { execSync } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const SVELTE_WORKER_PATH = '.svelte-kit/cloudflare/_worker.js'
const SVELTE_SERVER_PATH = '.svelte-kit/output/server/index.js'
const SVELTE_MANIFEST_PATH = '.svelte-kit/cloudflare-tmp/manifest.js'
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'
const TURNSTILE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA'
const CLOUDFLARE_TOKEN_CACHE_PATH = '.wrangler/cloudflare-api-token'
const CLOUDFLARE_TOKEN_PERMISSION_CACHE_PATH = '.wrangler/cloudflare-api-token.permissions'
const R2_S3_TOKEN_CACHE_PATH = '.wrangler/r2-s3-token.json'
const R2_BUCKET_WRITE_PERMISSION_NAME = 'Workers R2 Storage Bucket Item Write'
const CLOUDFLARE_TOKEN_PERMISSIONS = [
	{ key: 'api_tokens', type: 'edit' },
	{ key: 'memberships', type: 'read' },
	{ key: 'zone', type: 'read' },
	{ key: 'zone_settings', type: 'edit' },
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
			migrations_dir: 'src/db/meta-migrations'
		}
	]

	for (const shard of shards) {
		bindings.push({
			binding: shard.bindingName,
			database_name: shard.databaseName,
			database_id: shardDatabaseIds[shard.id] ?? '00000000-0000-0000-0000-000000000000',
			migrations_dir: 'src/db/shard-migrations'
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
			siteKey: TURNSTILE_TEST_SITE_KEY,
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

function selectTurnstileWidget(widgets, appName) {
	const matches = widgets.filter((widget) => {
		return widget.name === appName
	})

	if (matches.length > 1) {
		throw new Error('TURNSTILE_WIDGET_DUPLICATED')
	}

	return matches[0]
}

function parseEnvFile(filePath) {
	const env = {}

	if (!existsSync(filePath)) {
		return env
	}

	const content = readFileSync(filePath, 'utf-8')
	const lines = content.split('\n')

	for (const line of lines) {
		const trimmed = line.trim()
		if (!trimmed || trimmed.startsWith('#')) {
			continue
		}

		const match = trimmed.match(/^([^=]+)=(.*)$/)
		if (match) {
			const key = match[1].trim()
			let value = match[2].trim()

			const hasDoubleQuotes = value.startsWith('"') && value.endsWith('"')
			const hasSingleQuotes = value.startsWith("'") && value.endsWith("'")
			if (hasDoubleQuotes || hasSingleQuotes) {
				value = value.slice(1, -1)
			}

			env[key] = value
		}
	}

	return env
}


function loadEnv(isRemote) {
	const defaultEnvFile = isRemote ? '.env.prod' : '.env.dev'
	const overrideEnvFile = '.env'

	console.log(`Loading defaults from ${defaultEnvFile}...`)
	const defaultEnv = parseEnvFile(defaultEnvFile)

	const overrideEnv = parseEnvFile(overrideEnvFile)
	if (Object.keys(overrideEnv).length > 0) {
		console.log(`Loading overrides from ${overrideEnvFile}...`)
	}

	return {
		...defaultEnv,
		...overrideEnv,
		...process.env
	}
}

function readLocalVitePort() {
	try {
		const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'))
		const devScript = packageJson?.scripts?.dev
		if (typeof devScript === 'string') {
			const match = devScript.match(/\bvite dev\b[^\n]*?\s--port\s+(\d+)/)
			if (match) {
				return match[1]
			}
		}
	} catch { }

	return '5173'
}

function normalizeDomain(rawDomain) {
	return rawDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
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

function resolveAppBase(env, isRemote) {
	const rawDomain = env.APP_DOMAIN
	if (!rawDomain || rawDomain.trim() === '') {
		console.error('Error: Missing required variable APP_DOMAIN')
		process.exit(1)
	}

	const domain = normalizeDomain(rawDomain.trim())
	if (domain === '') {
		console.error('Error: APP_DOMAIN is invalid')
		process.exit(1)
	}

	if (isRemote) {
		env.APP_BASE_URL = `https://${domain}`
		env.APP_BASE_HOST = domain
		return
	}

	if (domain === 'localhost') {
		const vitePort = readLocalVitePort()
		env.APP_BASE_URL = `http://localhost:${vitePort}`
		env.APP_BASE_HOST = `localhost:${vitePort}`
		return
	}

	env.APP_BASE_URL = `http://${domain}`
	env.APP_BASE_HOST = domain
}

function resolveAppCnDomain(env) {
	const rawDomain = env.APP_CN_DOMAIN || ''
	const domain = normalizeDomain(rawDomain.trim())
	env.APP_CN_DOMAIN = domain
}

export function buildWorkerRoutes(appBaseHost, appCnDomain) {
	const routes = [
		{
			pattern: appBaseHost,
			custom_domain: true
		}
	]

	if (appCnDomain !== '') {
		routes.push({
			pattern: appCnDomain,
			custom_domain: true
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
		'EMAIL_ENABLED',
		'EMAIL_PROVIDER',
		'EMAIL_SIGNUP_ENABLED',
		'EMAIL_REQUIRE_VERIFICATION',
		'EMAIL_USER_ACTION_COOLDOWN_SECONDS',
		'EMAIL_RESEND_API_KEY',
		'EMAIL_FROM',
		'EMAIL_SIGNUP_DOMAIN_ALLOWLIST'
	]
	for (const key of requiredKeys) {
		if (!Object.prototype.hasOwnProperty.call(env, key)) {
			console.error(`Error: EMAIL_CONFIG_MISSING_${key}`)
			process.exit(1)
		}
	}

	const booleanKeys = [
		'EMAIL_ENABLED',
		'EMAIL_SIGNUP_ENABLED',
		'EMAIL_REQUIRE_VERIFICATION'
	]
	for (const key of booleanKeys) {
		if (env[key] !== 'true' && env[key] !== 'false') {
			console.error(`Error: EMAIL_CONFIG_BOOLEAN_INVALID_${key}`)
			process.exit(1)
		}
	}

	const emailEnabled = env.EMAIL_ENABLED === 'true'
	const emailSignupEnabled = env.EMAIL_SIGNUP_ENABLED === 'true'
	const emailProvider = env.EMAIL_PROVIDER
	const cooldown = Number(env.EMAIL_USER_ACTION_COOLDOWN_SECONDS)
	const cooldownValid = Number.isInteger(cooldown) && cooldown > 0
	if (!cooldownValid) {
		console.error('Error: EMAIL_COOLDOWN_CONFIG_INVALID')
		process.exit(1)
	}

	if (emailSignupEnabled && !emailEnabled) {
		console.error('Error: EMAIL_FEATURE_REQUIRED_FOR_SIGNUP')
		process.exit(1)
	}

	if (emailProvider !== 'resend' && emailProvider !== 'cloudflare') {
		console.error('Error: EMAIL_PROVIDER_CONFIG_INVALID')
		process.exit(1)
	}

	if (emailEnabled && !env.EMAIL_FROM) {
		console.error('Error: EMAIL_PROVIDER_CONFIG_MISSING')
		process.exit(1)
	}

	if (emailEnabled && emailProvider === 'resend' && !env.EMAIL_RESEND_API_KEY) {
		console.error('Error: EMAIL_PROVIDER_CONFIG_MISSING')
		process.exit(1)
	}
}

export function readAdminConfig(env) {
	const email = String(env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase()
	if (email === '') {
		throw new Error('SUPER_ADMIN_EMAIL_MISSING')
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

async function listZones(accountId, token) {
	const result = await cfApiRequest(
		token,
		'GET',
		`/zones?account.id=${encodeURIComponent(accountId)}&per_page=50&page=1`,
		undefined
	)
	return Array.isArray(result) ? result : []
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

async function listPermissionGroups(token) {
	const result = await cfApiRequest(token, 'GET', '/user/tokens/permission_groups', undefined)
	return Array.isArray(result) ? result : []
}

async function createUserToken(token, body) {
	return cfApiRequest(token, 'POST', '/user/tokens', body)
}

function readCachedR2S3Token(accountId, bucket) {
	if (!existsSync(R2_S3_TOKEN_CACHE_PATH)) {
		return null
	}

	const raw = readFileSync(R2_S3_TOKEN_CACHE_PATH, 'utf-8')
	const token = JSON.parse(raw)
	if (token.accountId !== accountId || token.bucket !== bucket) {
		return null
	}
	if (!token.accessKeyId || !token.secretAccessKey) {
		return null
	}
	return token
}

function writeCachedR2S3Token(token) {
	mkdirSync('.wrangler', { recursive: true })
	writeFileSync(R2_S3_TOKEN_CACHE_PATH, `${JSON.stringify(token, null, 2)}\n`, { mode: 0o600 })
}

export function selectPermissionGroup(permissionGroups, permissionName) {
	const group = permissionGroups.find((item) => item?.name === permissionName)
	if (!group?.id) {
		console.error(`Cloudflare permission group missing: ${permissionName}`)
		process.exit(1)
	}
	return group
}

async function ensureR2S3Token(accountId, token, bucket) {
	const cachedToken = readCachedR2S3Token(accountId, bucket)
	if (cachedToken) {
		console.log(`Using cached R2 S3 token for bucket '${bucket}'`)
		return cachedToken
	}

	console.log(`Creating R2 S3 token for bucket '${bucket}'...`)
	const permissionGroups = await listPermissionGroups(token)
	const r2WritePermission = selectPermissionGroup(permissionGroups, R2_BUCKET_WRITE_PERMISSION_NAME)
	const createdToken = await createUserToken(token, {
		name: `OPCStack R2 Upload ${bucket}`,
		policies: [
			{
				effect: 'allow',
				resources: {
					[`com.cloudflare.edge.r2.bucket.${accountId}_default_${bucket}`]: '*'
				},
				permission_groups: [
					{
						id: r2WritePermission.id
					}
				]
			}
		]
	})

	if (!createdToken?.id || !createdToken?.value) {
		console.error('Failed to create R2 S3 token')
		process.exit(1)
	}

	const r2Token = {
		accountId,
		bucket,
		accessKeyId: createdToken.id,
		secretAccessKey: createHash('sha256').update(createdToken.value).digest('hex')
	}
	writeCachedR2S3Token(r2Token)
	return r2Token
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
	const isRemote = process.argv.slice(2).includes('--remote')
	const env = loadEnv(isRemote)
	const adminConfig = readAdminConfig(env)
	resolveAppBase(env, isRemote)
	resolveAppCnDomain(env)
	validateEmailConfig(env)
	const queueNames = parseQueueNames(env.QUEUE_NAMES)
	const cronExpressions = parseCronExpressions(env.CRONS)
	const r2Enabled = env.R2_ENABLED === 'true'
	const r2TmpLifecycleRules = parseR2TmpLifecycleRules(env.R2_TMP_LIFECYCLE_RULES)
	const turnstileEnabled = env.TURNSTILE_ENABLED === 'true'
	const shardSpecs = parseShardSpecs(env.D1_SHARDS)
	const shards = buildShardDescriptors(env.APP_NAME, shardSpecs)

	console.log(`\nPre-build script (${isRemote ? 'REMOTE' : 'LOCAL'} mode)\n`)

	let databaseId = localD1DatabaseId(0)
	const appName = env.APP_NAME
	const metaDbName = `${env.APP_NAME}-meta`
	const shardDatabaseIds = {}
	let kvNamespaceId = '00000000000000000000000000000000'
	let accountId = ''
	let cloudflareApiToken = ''
	let r2S3Token = null

	if (isRemote) {
		console.log('\nResolving Cloudflare API token...')
		cloudflareApiToken = await getCloudflareApiToken()
		process.env.CLOUDFLARE_API_TOKEN = cloudflareApiToken

		console.log('\nResolving Cloudflare account...')
		accountId = await getSingleCloudflareAccountId(cloudflareApiToken)
		console.log(`Account ID: ${accountId}`)

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

		if (r2TmpLifecycleRules.length > 0) {
			console.log('\nSyncing R2 tmp lifecycle rules...')
			await putR2LifecycleRules(accountId, cloudflareApiToken, appName, r2TmpLifecycleRules)
			console.log('R2 tmp lifecycle rules synced')
		}

		r2S3Token = await ensureR2S3Token(accountId, cloudflareApiToken, appName)

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
	if (isRemote && turnstileEnabled) {
		console.log('\nChecking Turnstile widget...')
		turnstileWidget = await ensureTurnstileWidget(
			accountId,
			cloudflareApiToken,
			env.APP_NAME,
			buildTurnstileDomains(env.APP_DOMAIN, env.APP_CN_DOMAIN)
		)
		console.log(`Turnstile sitekey: ${turnstileWidget.sitekey}`)
	}

	const turnstileConfig = resolveTurnstileConfig({
		enabled: env.TURNSTILE_ENABLED,
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

	config.vars = config.vars || {}
	config.routes = buildWorkerRoutes(env.APP_BASE_HOST, env.APP_CN_DOMAIN)
	config.vars.R2_ENABLED = r2Enabled ? 'true' : 'false'
	config.vars.R2_ACCOUNT_ID = r2S3Token?.accountId || accountId || 'local'
	config.vars.R2_ACCESS_KEY_ID = r2S3Token?.accessKeyId || 'local'
	config.vars.R2_SECRET_ACCESS_KEY = r2S3Token?.secretAccessKey || 'local'
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

	console.log('\nGenerating migrations...')
	run('pnpm exec drizzle-kit generate')

	console.log('\nApplying migrations...')
	const migrateFlag = isRemote ? '--remote' : '--local'
	run(`pnpm exec wrangler d1 migrations apply ${metaDbName} ${migrateFlag}`)
	for (const shard of shards) {
		run(`pnpm exec wrangler d1 migrations apply ${shard.databaseName} ${migrateFlag}`)
	}

	console.log('\nUpserting shard registry...')
	const nowMs = Date.now()
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

	console.log('\nPre-build completed\n')
}

if (import.meta.url === `file://${process.argv[1]}`) {
	await main()
}
