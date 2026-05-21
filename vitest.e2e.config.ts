import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

const isRemote = process.env.E2E_REMOTE === '1'
const envFile = isRemote ? '.env.prod' : '.env.dev'
const envContent = readFileSync(envFile, 'utf-8')
const appDomain = readEnv(envContent, 'APP_DOMAIN') ?? 'localhost'
const appBaseUrl = resolveAppBaseUrl(appDomain, isRemote)
const adminSecret = readEnv(envContent, 'ADMIN_SECRET') ?? 'admin-secret'
const betterAuthSecret = readEnv(envContent, 'BETTER_AUTH_SECRET') ?? ''
const betaEnabled = readEnv(envContent, 'BETA_CODE_ENABLED') ?? 'true'
const googleEnabled = readEnv(envContent, 'GOOGLE_AUTH_ENABLED') ?? 'true'
const r2Enabled = readEnv(envContent, 'R2_ENABLED') ?? 'false'
const emailEnabled = readEnv(envContent, 'EMAIL_ENABLED') ?? 'false'
const emailSignupEnabled = readEnv(envContent, 'EMAIL_SIGNUP_ENABLED') ?? 'false'
const emailRequireVerification = readEnv(envContent, 'EMAIL_REQUIRE_VERIFICATION') ?? 'true'
const emailUserActionCooldownSeconds =
	readEnv(envContent, 'EMAIL_USER_ACTION_COOLDOWN_SECONDS') ?? '50'
const emailSignupDomainAllowlist = readEnv(envContent, 'EMAIL_SIGNUP_DOMAIN_ALLOWLIST') ?? ''
const emailResendApiKey = readEnv(envContent, 'EMAIL_RESEND_API_KEY') ?? ''
const emailFrom = readEnv(envContent, 'EMAIL_FROM') ?? ''
const paymentEnabled = readEnv(envContent, 'PAYMENT_ENABLED') ?? 'false'
const paymentProviders = readEnv(envContent, 'PAYMENT_PROVIDERS') ?? ''
const paymentDefaultProvider = readEnv(envContent, 'PAYMENT_DEFAULT_PROVIDER') ?? ''
const paymentProducts = readEnv(envContent, 'PAYMENT_PRODUCTS') ?? ''
const affEnabled = readEnv(envContent, 'AFF_ENABLED') ?? 'false'

export default defineConfig({
	test: {
		globals: true,
		include: ['e2e/**/*.test.ts'],
		testTimeout: 30_000,
		env: {
			APP_BASE_URL: appBaseUrl,
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
			E2E_PAYMENT_PROVIDERS: paymentProviders,
			E2E_PAYMENT_DEFAULT_PROVIDER: paymentDefaultProvider,
			E2E_PAYMENT_PRODUCTS: paymentProducts,
			E2E_AFF_ENABLED: affEnabled
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

function readEnv(content: string, name: string): string | undefined {
	const line = content
		.split('\n')
		.find((item) => item.startsWith(`${name}=`))
	return line?.slice(name.length + 1).trim()
}
