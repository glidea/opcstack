import { existsSync, readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

const isRemote = process.env.E2E_REMOTE === '1'
const envFile = isRemote ? '.env.prod' : '.env.dev'
const secretEnvFile = isRemote ? '.env.secret.prod' : '.env.secret.dev'
const envValues: Record<string, string> = readEnvFiles([envFile, secretEnvFile, '.env'])
const appDomain = readConfig('APP_DOMAIN') ?? 'localhost'
const appBaseUrl = resolveAppBaseUrl(appDomain, isRemote)
const r2Enabled = readConfig('R2_ENABLED') ?? 'false'
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? ''
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? ''
const paymentEnabled = readConfig('PAYMENT_ENABLED') ?? 'false'
const paymentProvider = readConfig('PAYMENT_PROVIDER') ?? ''
const paymentProducts = readConfig('PAYMENT_PRODUCTS') ?? ''
const paymentCreemWebhookSecret = readConfig('PAYMENT_CREEM_WEBHOOK_SECRET') ?? ''
const d1ShardCount = readConfig('D1_SHARD_COUNT') ?? '1'
const runAffiliateFlow = process.env.E2E_RUN_AFFILIATE_FLOW ?? 'false'
const runDailyCheckinFlow = process.env.E2E_RUN_DAILY_CHECKIN_FLOW ?? 'false'

export default defineConfig({
	test: {
		globals: true,
		include: ['e2e/**/*.test.ts'],
		testTimeout: 30_000,
		fileParallelism: false,
		env: {
			APP_BASE_URL: appBaseUrl,
			E2E_REMOTE: isRemote ? '1' : '0',
			E2E_R2_ENABLED: r2Enabled,
			E2E_ADMIN_EMAIL: adminEmail,
			E2E_ADMIN_PASSWORD: adminPassword,
			E2E_PAYMENT_ENABLED: paymentEnabled,
			E2E_PAYMENT_PROVIDER: paymentProvider,
			E2E_PAYMENT_PRODUCTS: paymentProducts,
			E2E_PAYMENT_CREEM_WEBHOOK_SECRET: paymentCreemWebhookSecret,
			E2E_RUN_AFFILIATE_FLOW: runAffiliateFlow,
			E2E_D1_SHARD_COUNT: d1ShardCount,
			E2E_RUN_DAILY_CHECKIN_FLOW: runDailyCheckinFlow
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
