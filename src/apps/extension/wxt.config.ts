import { fileURLToPath } from 'node:url'
import { defineConfig } from 'wxt'
import { clientConfig } from '../../generated/client-config'

const appsLibPath: string = fileURLToPath(new URL('../lib', import.meta.url))

export default defineConfig({
	publicDir: 'public',
	modules: ['@wxt-dev/module-svelte'],
	manifest: {
		name: clientConfig.appName,
		version: '0.0.1',
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
					$web: appsLibPath
				}
			}
		}
	}
})
