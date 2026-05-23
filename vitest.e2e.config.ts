import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

const isRemote = process.env.E2E_REMOTE === '1'
const envFile = isRemote ? '.env.prod' : '.env.dev'
const envContent = readFileSync(envFile, 'utf-8')
const appDomain = readConfig('APP_DOMAIN') ?? 'localhost'
const appBaseUrl = resolveAppBaseUrl(appDomain, isRemote)
const adminSecret = readConfig('ADMIN_SECRET') ?? 'admin-secret'
const betterAuthSecret = readConfig('BETTER_AUTH_SECRET') ?? ''
const betaEnabled = readConfig('BETA_CODE_ENABLED') ?? 'true'
const googleEnabled = readConfig('GOOGLE_AUTH_ENABLED') ?? 'true'
const r2Enabled = readConfig('R2_ENABLED') ?? 'false'
const emailEnabled = readConfig('EMAIL_ENABLED') ?? 'false'
const emailSignupEnabled = readConfig('EMAIL_SIGNUP_ENABLED') ?? 'false'
const emailRequireVerification = readConfig('EMAIL_REQUIRE_VERIFICATION') ?? 'true'
const emailUserActionCooldownSeconds =
	readConfig('EMAIL_USER_ACTION_COOLDOWN_SECONDS') ?? '50'
const emailSignupDomainAllowlist = readConfig('EMAIL_SIGNUP_DOMAIN_ALLOWLIST') ?? ''
const emailResendApiKey = readConfig('EMAIL_RESEND_API_KEY') ?? ''
const emailFrom = readConfig('EMAIL_FROM') ?? ''
const paymentEnabled = readConfig('PAYMENT_ENABLED') ?? 'false'
const paymentProvider = readConfig('PAYMENT_PROVIDER') ?? ''
const paymentProducts = readConfig('PAYMENT_PRODUCTS') ?? ''
const paymentCreemWebhookSecret = readConfig('PAYMENT_CREEM_WEBHOOK_SECRET') ?? ''
const affEnabled = readConfig('AFF_ENABLED') ?? 'false'
const d1ShardCount = readConfig('D1_SHARD_COUNT') ?? '1'

export default defineConfig({
	test: {
		globals: true,
		include: ['e2e/**/*.test.ts'],
		testTimeout: 30_000,
		fileParallelism: false,
		env: {
			APP_BASE_URL: appBaseUrl,
			E2E_REMOTE: isRemote ? '1' : '0',
			E2E_ADMIN_SECRET: adminSecret,
			E2E_BETTER_AUTH_SECRET: betterAuthSecret,
			E2E_BETA_CODE_ENABLED: betaEnabled,
			E2E_GOOGLE_AUTH_ENABLED: googleEnabled,
			E2E_R2_ENABLED: r2Enabled,
			E2E_EMAIL_ENABLED: emailEnabled,
			E2E_EMAIL_SIGNUP_ENABLED: emailSignupEnabled,
			E2E_EMAIL_REQUIRE_VERIFICATION: emailRequireVerification,
			E2E_EMAIL_USER_ACTION_COOLDOWN_SECONDS: emailUserActionCooldownSeconds,
			E2E_EMAIL_SIGNUP_DOMAIN_ALLOWLIST: emailSignupDomainAllowlist,
			E2E_EMAIL_RESEND_API_KEY: emailResendApiKey,
			E2E_EMAIL_FROM: emailFrom,
			E2E_PAYMENT_ENABLED: paymentEnabled,
			E2E_PAYMENT_PROVIDER: paymentProvider,
			E2E_PAYMENT_PRODUCTS: paymentProducts,
			E2E_PAYMENT_CREEM_WEBHOOK_SECRET: paymentCreemWebhookSecret,
			E2E_AFF_ENABLED: affEnabled,
			E2E_D1_SHARD_COUNT: d1ShardCount
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
	return process.env[name] ?? readEnv(envContent, name)
}

function readEnv(content: string, name: string): string | undefined {
	const line = content
		.split('\n')
		.find((item) => item.startsWith(`${name}=`))
	return line?.slice(name.length + 1).trim()
}
