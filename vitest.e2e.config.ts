import { existsSync, readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

const isRemote = process.env.E2E_REMOTE === '1'
const envFile = isRemote ? '.env.prod' : '.env.dev'
const secretEnvFile = isRemote ? '.env.secret.prod' : '.env.secret.dev'
const envValues: Record<string, string> = readEnvFiles([envFile, secretEnvFile, '.env'])
const appDomain = readConfig('APP_DOMAIN') ?? 'localhost'
const appBaseUrl = resolveAppBaseUrl(appDomain, isRemote)
const adminApiToken = readConfig('ADMIN_API_TOKEN') ?? 'admin-token'
const betterAuthSecret = readConfig('BETTER_AUTH_SECRET') ?? ''
const betaEnabled = readConfig('BETA_CODE_ENABLED') ?? 'true'
const googleEnabled = readConfig('GOOGLE_AUTH_ENABLED') ?? 'true'
const r2Enabled = readConfig('R2_ENABLED') ?? 'false'
const emailSignupEnabled = readConfig('EMAIL_SIGNUP_ENABLED') ?? 'false'
const emailRequireVerification = readConfig('EMAIL_REQUIRE_VERIFICATION') ?? 'true'
const emailUserActionCooldownSeconds =
	readConfig('EMAIL_USER_ACTION_COOLDOWN_SECONDS') ?? '50'
const emailSignupDomainAllowlist = readConfig('EMAIL_SIGNUP_DOMAIN_ALLOWLIST') ?? ''
const emailResendApiKey = readConfig('EMAIL_RESEND_API_KEY') ?? ''
const systemEmail = readConfig('SYSTEM_EMAIL') ?? ''
const turnstileEnabled = readConfig('TURNSTILE_ENABLED') ?? 'false'
const paymentEnabled = readConfig('PAYMENT_ENABLED') ?? 'false'
const paymentProvider = readConfig('PAYMENT_PROVIDER') ?? ''
const paymentProducts = readConfig('PAYMENT_PRODUCTS') ?? ''
const paymentCreemWebhookSecret = readConfig('PAYMENT_CREEM_WEBHOOK_SECRET') ?? ''
const affEnabled = readConfig('AFF_ENABLED') ?? 'false'
const d1ShardCount = readConfig('D1_SHARD_COUNT') ?? '1'
const creditsDailyCheckinEnabled = readConfig('CREDITS_DAILY_CHECKIN_ENABLED') ?? 'false'

export default defineConfig({
	test: {
		globals: true,
		include: ['e2e/**/*.test.ts'],
		testTimeout: 30_000,
		fileParallelism: false,
		env: {
			APP_BASE_URL: appBaseUrl,
			E2E_REMOTE: isRemote ? '1' : '0',
			E2E_ADMIN_API_TOKEN: adminApiToken,
			E2E_BETTER_AUTH_SECRET: betterAuthSecret,
			E2E_BETA_CODE_ENABLED: betaEnabled,
			E2E_GOOGLE_AUTH_ENABLED: googleEnabled,
			E2E_R2_ENABLED: r2Enabled,
			E2E_EMAIL_SIGNUP_ENABLED: emailSignupEnabled,
			E2E_EMAIL_REQUIRE_VERIFICATION: emailRequireVerification,
			E2E_EMAIL_USER_ACTION_COOLDOWN_SECONDS: emailUserActionCooldownSeconds,
			E2E_EMAIL_SIGNUP_DOMAIN_ALLOWLIST: emailSignupDomainAllowlist,
			E2E_EMAIL_RESEND_API_KEY: emailResendApiKey,
			E2E_SYSTEM_EMAIL: systemEmail,
			E2E_TURNSTILE_ENABLED: turnstileEnabled,
			E2E_PAYMENT_ENABLED: paymentEnabled,
			E2E_PAYMENT_PROVIDER: paymentProvider,
			E2E_PAYMENT_PRODUCTS: paymentProducts,
			E2E_PAYMENT_CREEM_WEBHOOK_SECRET: paymentCreemWebhookSecret,
			E2E_AFF_ENABLED: affEnabled,
			E2E_D1_SHARD_COUNT: d1ShardCount,
			E2E_CREDITS_DAILY_CHECKIN_ENABLED: creditsDailyCheckinEnabled
		}
	}
})

function resolveAppBaseUrl(appDomain: string, remote: boolean): string {
	const domain = appDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
	if (remote) {
		return `https://${domain}`
	}
	if (domain === 'localhost') {
		const port = readLocalVitePort()
		return `http://localhost:${port}`
	}
	return `http://${domain}`
}

function readLocalVitePort(): string {
	try {
		const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'))
		const devScript = packageJson?.scripts?.dev
		if (typeof devScript === 'string') {
			const match = devScript.match(/\bvite dev\b[^\n]*?\s--port\s+(\d+)/)
			if (match) {
				return match[1]
			}
		}
	} catch {}
	return '5173'
}

function readConfig(name: string): string | undefined {
	return process.env[name] ?? envValues[name]
}

function readEnvFiles(files: string[]): Record<string, string> {
	const values: Record<string, string> = {}
	for (const file of files) {
		if (!existsSync(file)) {
			continue
		}

		const content = readFileSync(file, 'utf-8')
		const lines = content.split('\n')
		for (const line of lines) {
			const trimmed = line.trim()
			if (trimmed === '' || trimmed.startsWith('#')) {
				continue
			}

			const index = trimmed.indexOf('=')
			if (index === -1) {
				continue
			}

			const key = trimmed.slice(0, index).trim()
			const value = trimmed.slice(index + 1).trim()
			values[key] = value
		}
	}
	return values
}
