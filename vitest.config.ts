import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const sharedPath: string = fileURLToPath(new URL('./src/shared', import.meta.url))
const webLibPath: string = fileURLToPath(new URL('./src/web/lib', import.meta.url))

export default defineConfig({
	resolve: {
		alias: {
			$shared: sharedPath,
			$web: webLibPath
		}
	},
	test: {
		globals: true,
		include: ['src/**/*.test.ts'],
		exclude: ['e2e/**']
	}
})
