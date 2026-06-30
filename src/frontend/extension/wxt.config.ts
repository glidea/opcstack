import { fileURLToPath } from 'node:url'
import { defineConfig } from 'wxt'
import { clientConfig } from '../lib/config/client'

const frontendLibPath: string = fileURLToPath(new URL('../lib', import.meta.url))

export default defineConfig({
	publicDir: 'public',
	modules: ['@wxt-dev/module-svelte'],
	manifest: {
		name: clientConfig.appName,
		version: clientConfig.appVersion,
		description: `${clientConfig.appName} browser extension`,
		permissions: ['storage', 'tabs', 'activeTab'],
		host_permissions: clientConfig.extension.hostPermissions,
		icons: {
			16: '/icons/icon-16.png',
			32: '/icons/icon-32.png',
			48: '/icons/icon-48.png',
			128: '/icons/icon-128.png'
		}
	},
	vite: () => {
		return {
			resolve: {
				alias: {
					$frontend: frontendLibPath
				}
			}
		}
	}
})
