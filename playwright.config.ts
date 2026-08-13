import { defineConfig, type PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = defineConfig({
	testDir: './e2e-browser',
	timeout: 60_000,
	expect: {
		timeout: 15_000
	},
	fullyParallel: false,
	workers: 1,
	reporter: 'line',
	use: {
		baseURL: process.env['APP_BASE_URL'] ?? 'http://localhost:5173',
		trace: 'off',
		video: 'off',
		screenshot: 'off'
	}
})

export default config
