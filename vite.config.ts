import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const sharedPath: string = fileURLToPath(new URL('./src/shared', import.meta.url))
const frontendLibPath: string = fileURLToPath(new URL('./src/frontend/lib', import.meta.url))
const backendPath: string = fileURLToPath(new URL('./src/backend', import.meta.url))
const apiContractPath: string = fileURLToPath(new URL('./src/api-contract', import.meta.url))

export default defineConfig({
	server: {
		proxy: {
			'/api': {
				target: 'http://127.0.0.1:8787',
				changeOrigin: false
			}
		}
	},
	resolve: {
		alias: {
			$shared: sharedPath,
			$frontend: frontendLibPath,
			$backend: backendPath,
			$apiContract: apiContractPath
		}
	},
	plugins: [tailwindcss(), sveltekit()]
})
