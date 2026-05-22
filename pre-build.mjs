import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { resolveTurnstileConfig, selectTurnstileWidget } from './src/build/turnstile.mjs'

const SVELTE_WORKER_PATH = '.svelte-kit/cloudflare/_worker.js'
const SVELTE_SERVER_PATH = '.svelte-kit/output/server/index.js'
const SVELTE_MANIFEST_PATH = '.svelte-kit/cloudflare-tmp/manifest.js'

function run(command, options = {}) {
	console.log(`> ${command}`)
	execSync(command, { stdio: 'inherit', ...options })
}

function exec(command, options = {}) {
	console.log(`> ${command}`)
	return execSync(command, { encoding: 'utf-8', ...options })
}

function extractValidJson(output) {
	const arrMatch = output.match(/\[[\s\S]*?\]/)
	if (arrMatch) {
		return JSON.parse(arrMatch[0])
	}

	const objMatch = output.match(/\{[\s\S]*\}/)
	if (objMatch) {
		return JSON.parse(objMatch[0])
	}

	return undefined
}

function json(command, options = {}) {
	return extractValidJson(exec(command, options))
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

	if (emailEnabled && (!env.EMAIL_RESEND_API_KEY || !env.EMAIL_FROM)) {
		console.error('Error: EMAIL_PROVIDER_CONFIG_MISSING')
		process.exit(1)
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

function queueBindingName(queueName) {
	return `Q_${queueName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`
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

function getWranglerAuthToken() {
	const auth = json('pnpm exec wrangler auth token --json')
	if (!auth || typeof auth !== 'object') {
		console.error('Failed to get wrangler auth token')
		process.exit(1)
	}

	if (auth.type === 'api_key') {
		console.error('Wrangler Global API Key is not supported for Bearer auth. Use wrangler login.')
		process.exit(1)
	}

	const token = auth.token
	if (!token || typeof token !== 'string') {
		console.error('Failed to read token from wrangler auth token --json')
		process.exit(1)
	}

	return token
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

async function createD1Database(accountId, token, name) {
	return cfApiRequest(token, 'POST', `/accounts/${accountId}/d1/database`, { name })
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

async function createTurnstileWidget(accountId, token, name, domain) {
	return cfApiRequest(token, 'POST', `/accounts/${accountId}/challenges/widgets`, {
		name,
		domains: [domain],
		mode: 'managed',
		region: 'world'
	})
}

async function ensureTurnstileWidget(accountId, token, appName, domain) {
	let widgets = await listTurnstileWidgets(accountId, token)
	let widget = selectTurnstileWidget(widgets, appName)
	if (widget) {
		console.log(`Turnstile widget '${appName}' already exists.`)
		return widget
	}

	console.log(`Creating Turnstile widget '${appName}'...`)
	await createTurnstileWidget(accountId, token, appName, domain)
	widgets = await listTurnstileWidgets(accountId, token)
	widget = selectTurnstileWidget(widgets, appName)
	if (!widget) {
		console.error('Failed to get Turnstile widget after creation')
		process.exit(1)
	}

	return widget
}

async function enableD1ReadReplication(accountId, databaseId, token) {
	await cfApiRequest(token, 'PUT', `/accounts/${accountId}/d1/database/${databaseId}`, {
		read_replication: {
			mode: 'auto'
		}
	})
}

async function main() {
	const isRemote = process.argv.slice(2).includes('--remote')
	const env = loadEnv(isRemote)
	resolveAppBase(env, isRemote)
	validateEmailConfig(env)
	const queueNames = parseQueueNames(env.QUEUE_NAMES)
	const cronExpressions = parseCronExpressions(env.CRONS)
	const r2Enabled = env.R2_ENABLED === 'true'
	const turnstileEnabled = env.TURNSTILE_ENABLED === 'true'

	console.log(`\nPre-build script (${isRemote ? 'REMOTE' : 'LOCAL'} mode)\n`)

	let databaseId = '00000000-0000-0000-0000-000000000000'
	const dbName = env.APP_NAME
	let kvNamespaceId = '00000000000000000000000000000000'
	let accountId = ''
	let wranglerToken = ''

	if (isRemote) {
		console.log('\nResolving Wrangler auth token...')
		try {
			wranglerToken = getWranglerAuthToken()
		} catch {
			console.error(
				"Wrangler is not ready. Ensure dependencies are installed and run 'pnpm exec wrangler login'."
			)
			process.exit(1)
		}
		console.log('Wrangler token resolved')

		console.log('\nResolving Cloudflare account...')
		accountId = await getSingleCloudflareAccountId(wranglerToken)
		console.log(`Account ID: ${accountId}`)

		console.log('\nChecking D1 databases...')
		let dbs = await listD1Databases(accountId, wranglerToken)
		let existingDB = dbs.find((db) => db.name === dbName)
		if (!existingDB) {
			console.log(`Creating D1 database '${dbName}'...`)
			await createD1Database(accountId, wranglerToken, dbName)
			dbs = await listD1Databases(accountId, wranglerToken)
			existingDB = dbs.find((db) => db.name === dbName)
		} else {
			console.log(`Database '${dbName}' already exists.`)
		}

		databaseId = existingDB?.uuid
		if (!databaseId) {
			console.error('Failed to get D1 database ID')
			process.exit(1)
		}

		console.log(`Database ID: ${databaseId}`)
	} else {
		// Local mode can use a placeholder ID because D1 is addressed by name for local migrations
		console.log(`Using local placeholder D1 database ID: ${databaseId}`)
	}

	if (isRemote) {
		console.log('\nEnabling D1 read replication...')
		await enableD1ReadReplication(accountId, databaseId, wranglerToken)
		console.log('D1 read replication enabled')
	}

	if (isRemote && queueNames.length > 0) {
		console.log('\nChecking Queues...')
		let queues = await listQueues(accountId, wranglerToken)

		for (const queueName of queueNames) {
			const existingQueue = queues.find((queue) => {
				return queue.name === queueName || queue.queue_name === queueName
			})
			if (existingQueue) {
				console.log(`Queue '${queueName}' already exists.`)
				continue
			}

			console.log(`Creating Queue '${queueName}'...`)
			await createQueue(accountId, wranglerToken, queueName)
			queues.push({ queue_name: queueName })
		}
	}

	if (isRemote && r2Enabled) {
		console.log('\nChecking R2 bucket...')
		let buckets = await listR2Buckets(accountId, wranglerToken)

		const existingBucket = buckets.find((bucket) => {
			return bucket.name === dbName || bucket.bucket_name === dbName
		})
		if (!existingBucket) {
			console.log(`Creating R2 bucket '${dbName}'...`)
			await createR2Bucket(accountId, wranglerToken, dbName)
		} else {
			console.log(`R2 bucket '${dbName}' already exists.`)
		}
	}

	if (isRemote) {
		console.log('\nChecking KV namespace...')
		let namespaces = await listKVNamespaces(accountId, wranglerToken)

		let existingNamespace = namespaces.find((namespace) => {
			return namespace.title === dbName || namespace.name === dbName
		})

		if (!existingNamespace) {
			console.log(`Creating KV namespace '${dbName}'...`)
			await createKVNamespace(accountId, wranglerToken, dbName)
			namespaces = await listKVNamespaces(accountId, wranglerToken)
			existingNamespace = namespaces.find((namespace) => {
				return namespace.title === dbName || namespace.name === dbName
			})
		} else {
			console.log(`KV namespace '${dbName}' already exists.`)
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
			wranglerToken,
			env.APP_NAME,
			env.APP_DOMAIN
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
			consumers: queueNames.map((queueName) => {
				return {
					queue: queueName
				}
			})
		}
	}

	if (cronExpressions.length > 0) {
		config.triggers = {
			crons: cronExpressions
		}
	}

	config.vars = config.vars || {}
	config.vars.R2_ENABLED = r2Enabled ? 'true' : 'false'

	if (r2Enabled) {
		config.r2_buckets = [
			{
				binding: 'R2',
				bucket_name: dbName
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
	run(`pnpm exec wrangler d1 migrations apply ${dbName} ${migrateFlag}`)

	console.log('\nPre-build completed\n')
}

await main()
