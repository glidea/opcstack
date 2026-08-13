import { existsSync, readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

const isRemote = process.env.E2E_REMOTE === '1'
const envFile = isRemote ? '.env.prod' : '.env.dev'
const envValues: Record<string, string> = readEnvFiles([envFile, '.env'])
const appDomain = readConfig('APP_DOMAIN') ?? 'localhost'
const appBaseUrl = resolveAppBaseUrl(appDomain, isRemote)
const r2Enabled = readConfig('R2_ENABLED') ?? 'false'
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? ''
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? ''
const secondAppBaseUrl = process.env.E2E_SECOND_APP_BASE_URL ?? ''
const secondAdminEmail = process.env.E2E_SECOND_ADMIN_EMAIL ?? ''
const secondAdminPassword = process.env.E2E_SECOND_ADMIN_PASSWORD ?? ''
const d1ShardCount = String(readD1ShardCount(readConfig('D1_SHARDS') ?? 'apac:1'))
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
			E2E_SECOND_APP_BASE_URL: secondAppBaseUrl,
			E2E_SECOND_ADMIN_EMAIL: secondAdminEmail,
			E2E_SECOND_ADMIN_PASSWORD: secondAdminPassword,
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

function readD1ShardCount(value: string): number {
	return value
		.split(';')
		.map((item: string): string => item.trim())
		.filter((item: string): boolean => item !== '')
		.reduce((total: number, item: string): number => {
			const separator: number = item.lastIndexOf(':')
			return total + Number(item.slice(separator + 1))
		}, 0)
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
