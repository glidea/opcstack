import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const sharedPath: string = fileURLToPath(new URL('./src/shared', import.meta.url))
const webLibPath: string = fileURLToPath(new URL('./src/web/lib', import.meta.url))

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
			$web: webLibPath
		}
	},
	plugins: [tailwindcss(), sveltekit()]
})
