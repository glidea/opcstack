import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const sharedPath: string = fileURLToPath(new URL('./src/shared', import.meta.url))
const webLibPath: string = fileURLToPath(new URL('./src/apps/lib', import.meta.url))
const backendPath: string = fileURLToPath(new URL('./src/backend', import.meta.url))
const apiContractPath: string = fileURLToPath(new URL('./src/api-contract', import.meta.url))

export default defineConfig({
	resolve: {
		alias: {
			$shared: sharedPath,
			$web: webLibPath,
			$backend: backendPath,
			$apiContract: apiContractPath
		}
	},
	test: {
		globals: true,
		include: ['src/**/*.test.ts'],
		exclude: ['e2e/**']
	}
})
