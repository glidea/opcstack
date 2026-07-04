import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CLIENT_CONFIG_PATH = 'src/frontend/lib/config/client.generated.ts'
const LOGO_PATH = 'logo.svg'
const WEB_LOGO_PATH = 'src/frontend/web/static/logo.svg'
const EXTENSION_ICON_DIR = 'src/frontend/extension/public/icons'
const EXTENSION_ICON_SIZES = [16, 32, 48, 128]

export function parseEnvFile(filePath) {
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

export function loadPublicEnv(mode) {
	const envFile = mode === 'prod' ? '.env.prod' : '.env.dev'
	const overrideEnvFile = '.env'

	console.log(`Loading public config from ${envFile}...`)
	const env = parseEnvFile(envFile)

	const overrideEnv = parseEnvFile(overrideEnvFile)
	if (Object.keys(overrideEnv).length > 0) {
		console.log(`Loading overrides from ${overrideEnvFile}...`)
	}

	return {
		...env,
		...overrideEnv,
		...process.env
	}
}

function readLocalVitePort() {
	const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'))
	const devScript = packageJson.scripts.dev
	if (typeof devScript === 'string') {
		const match = devScript.match(/\bvite dev\b[^\n]*?\s--port\s+(\d+)/)
		if (match) {
			return match[1]
		}
	}

	return '5173'
}

export function normalizeDomain(rawDomain) {
	return rawDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
}

export function resolveAppBase(env, mode) {
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

	if (mode === 'prod') {
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

export function resolveAppCnDomain(env) {
	const rawDomain = env.APP_CN_DOMAIN || ''
	const domain = normalizeDomain(rawDomain.trim())
	env.APP_CN_DOMAIN = domain
}

export function resolveAppCnCnameTarget(env) {
	const rawDomain = env.APP_CN_CNAME_TARGET || ''
	const domain = normalizeDomain(rawDomain.trim())
	env.APP_CN_CNAME_TARGET = domain
}

function parseConfigBoolean(value) {
	return String(value) === 'true'
}

function parseList(value) {
	return String(value || '')
		.split(';')
		.map((item) => item.trim())
		.filter((item) => item !== '')
}

export function buildClientConfig(vars) {
	validatePublicConfig(vars)

	return {
		appName: vars.APP_NAME,
		appVersion: vars.APP_VERSION,
		apiBaseUrl: vars.APP_BASE_URL,
		webBaseUrl: vars.APP_BASE_URL,
		supportEmail: vars.SYSTEM_EMAIL,
		designSystem: vars.DESIGN_SYSTEM,
		docsEnabled: parseConfigBoolean(vars.DOCS_ENABLED),
		emailSignupEnabled: parseConfigBoolean(vars.EMAIL_SIGNUP_ENABLED),
		emailRequireVerification: parseConfigBoolean(vars.EMAIL_REQUIRE_VERIFICATION),
		emailUserActionCooldownSeconds: Number(vars.EMAIL_USER_ACTION_COOLDOWN_SECONDS),
		googleAuthEnabled: parseConfigBoolean(vars.GOOGLE_AUTH_ENABLED),
		githubAuthEnabled: parseConfigBoolean(vars.GITHUB_AUTH_ENABLED),
		linuxdoAuthEnabled: parseConfigBoolean(vars.LINUXDO_AUTH_ENABLED),
		turnstileEnabled: parseConfigBoolean(vars.TURNSTILE_ENABLED),
		turnstileSiteKey: vars.TURNSTILE_SITE_KEY || '',
		paymentEnabled: parseConfigBoolean(vars.PAYMENT_ENABLED),
		extension: {
			hostPermissions: parseList(vars.EXTENSION_HOST_PERMISSIONS)
		}
	}
}

function validatePublicConfig(vars) {
	const requiredKeys = [
		'APP_NAME',
		'APP_VERSION',
		'APP_BASE_URL',
		'SYSTEM_EMAIL',
		'DESIGN_SYSTEM',
		'DOCS_ENABLED',
		'EMAIL_SIGNUP_ENABLED',
		'EMAIL_REQUIRE_VERIFICATION',
		'EMAIL_USER_ACTION_COOLDOWN_SECONDS',
		'GOOGLE_AUTH_ENABLED',
		'GITHUB_AUTH_ENABLED',
		'LINUXDO_AUTH_ENABLED',
		'TURNSTILE_ENABLED',
		'PAYMENT_ENABLED',
		'EXTENSION_HOST_PERMISSIONS'
	]

	for (const key of requiredKeys) {
		if (vars[key] === undefined || vars[key] === '') {
			console.error(`Error: PUBLIC_CONFIG_MISSING_${key}`)
			process.exit(1)
		}
	}

}

export function writeClientConfig(vars) {
	mkdirSync('src/frontend/lib/config', { recursive: true })
	const clientConfig = buildClientConfig(vars)
	const content = `export type ClientConfig = {
	appName: string
	appVersion: string
	apiBaseUrl: string
	webBaseUrl: string
	supportEmail: string
	designSystem: string
	docsEnabled: boolean
	emailSignupEnabled: boolean
	emailRequireVerification: boolean
	emailUserActionCooldownSeconds: number
	googleAuthEnabled: boolean
	githubAuthEnabled: boolean
	linuxdoAuthEnabled: boolean
	turnstileEnabled: boolean
	turnstileSiteKey: string
	paymentEnabled: boolean
	extension: {
		hostPermissions: string[]
	}
}

export const clientConfig: ClientConfig = ${JSON.stringify(clientConfig, null, '\t')}
`
	writeFileSync(CLIENT_CONFIG_PATH, content)
	console.log(`${CLIENT_CONFIG_PATH} generated successfully`)
}

export async function syncPublicAssets() {
	mkdirSync('src/frontend/web/static', { recursive: true })
	copyFileSync(LOGO_PATH, WEB_LOGO_PATH)

	const { default: sharp } = await import('sharp')
	mkdirSync(EXTENSION_ICON_DIR, { recursive: true })
	for (const size of EXTENSION_ICON_SIZES) {
		await sharp(LOGO_PATH)
			.resize(size, size)
			.png()
			.toFile(join(EXTENSION_ICON_DIR, `icon-${size}.png`))
	}

	console.log('Public assets generated successfully')
}

export async function preparePublicArtifacts(mode) {
	const env = loadPublicEnv(mode)
	resolveAppBase(env, mode)
	resolveAppCnDomain(env)
	resolveAppCnCnameTarget(env)
	writeClientConfig(env)
	await syncPublicAssets()
}

function readMode() {
	if (process.argv.includes('--mode')) {
		const index = process.argv.indexOf('--mode')
		return process.argv[index + 1]
	}

	return 'dev'
}

if (import.meta.url === `file://${process.argv[1]}`) {
	await preparePublicArtifacts(readMode())
}
