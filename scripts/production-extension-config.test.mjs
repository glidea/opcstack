import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import extensionConfig from '../src/frontend/extension/wxt.config.ts'

describe('production extension configuration', () => {
	it('grants the packaged extension access to the production app', () => {
		const env = readFileSync('.env.prod', 'utf8')
		expect(env).toContain('EXTENSION_HOST_PERMISSIONS=https://opcstack.glidea.app/*')
		expect(env).toContain('DESIGN_SYSTEM=apple-saas')
		expect(env).not.toContain('EXTENSION_HOST_PERMISSIONS=http://localhost:5173/*')
	})

	it('resolves every shared popup import', () => {
		const viteConfig = extensionConfig.vite()
		expect(Object.keys(viteConfig.resolve.alias).sort()).toEqual(['$apiContract', '$frontend'])
	})
})
