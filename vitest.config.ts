import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const sharedPath: string = fileURLToPath(new URL('./src/shared', import.meta.url))
const frontendLibPath: string = fileURLToPath(new URL('./src/frontend/lib', import.meta.url))
const backendPath: string = fileURLToPath(new URL('./src/backend', import.meta.url))
const apiContractPath: string = fileURLToPath(new URL('./src/api-contract', import.meta.url))

export default defineConfig({
	resolve: {
		alias: {
			$shared: sharedPath,
			$frontend: frontendLibPath,
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
