import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
	buildSecretMutation,
	createConfigurationNavigation,
	createEditorState,
	markEditorSaved,
	setEditorValue,
	validateAuthenticationForm,
	validateEmailForm
} from './configuration-page'

const routeDirectory: string = fileURLToPath(new URL('.', import.meta.url))

describe('configuration navigation', () => {
	it('defines stable business domain routes', () => {
		expect(createConfigurationNavigation('en')).toEqual([
			{ id: 'general', href: '/en/admin/configuration/general' },
			{ id: 'authentication', href: '/en/admin/configuration/authentication' },
			{ id: 'email', href: '/en/admin/configuration/email' },
			{ id: 'storage', href: '/en/admin/configuration/storage' },
			{ id: 'credits', href: '/en/admin/configuration/credits' },
			{ id: 'affiliate', href: '/en/admin/configuration/affiliate' },
			{ id: 'payment', href: '/en/admin/configuration/payment' },
			{ id: 'ai', href: '/en/admin/configuration/ai' }
		])
	})

	it('renders horizontal tabs and intercepts navigation while dirty', () => {
		const source: string = readFileSync(`${routeDirectory}+layout.svelte`, 'utf8')
		expect(source).toContain('orientation="horizontal"')
		expect(source).toContain('beforeNavigate')
		expect(source).toContain('configuration-editor-dirty')
		expect(source).toContain('AlertDialog')
	})
})

describe('configuration editor state', () => {
	it('becomes dirty after editing and clean after an explicit save', () => {
		const initial = createEditorState({ docs_enabled: false, version: 1 })
		const edited = setEditorValue(initial, { docs_enabled: true, version: 1 })
		const saved = markEditorSaved(edited, { docs_enabled: true, version: 2 })

		expect(edited.dirty).toBe(true)
		expect(saved).toEqual({
			value: { docs_enabled: true, version: 2 },
			savedValue: { docs_enabled: true, version: 2 },
			dirty: false
		})
	})

	it('creates all three explicit secret operations', () => {
		expect(buildSecretMutation('keep', '')).toEqual({ action: 'keep' })
		expect(buildSecretMutation('replace', 'new-secret')).toEqual({
			action: 'replace',
			value: 'new-secret'
		})
		expect(buildSecretMutation('remove', '')).toEqual({ action: 'remove' })
	})
})

describe('configuration validation', () => {
	it('requires expanded authentication provider fields', () => {
		expect(validateAuthenticationForm({
			turnstileEnabled: false,
			turnstileSiteKey: '',
			turnstileSecretConfigured: false,
			turnstileSecretAction: 'keep',
			turnstileSecretValue: '',
			googleEnabled: true,
			googleClientId: '',
			googleSecretConfigured: false,
			googleSecretAction: 'keep',
			googleSecretValue: '',
			githubEnabled: false,
			githubClientId: '',
			githubSecretConfigured: false,
			githubSecretAction: 'keep',
			githubSecretValue: '',
			linuxdoEnabled: false,
			linuxdoClientId: '',
			linuxdoSecretConfigured: false,
			linuxdoSecretAction: 'keep',
			linuxdoSecretValue: ''
		})).toEqual({
			googleClientId: 'Client ID is required',
			googleClientSecret: 'Client secret is required'
		})
	})

	it('requires the Resend key only while Resend delivery is enabled', () => {
		expect(validateEmailForm({
			enabled: true,
			provider: 'resend',
			resendApiKeyConfigured: false,
			resendApiKeyAction: 'keep',
			resendApiKeyValue: ''
		})).toEqual({ resendApiKey: 'API key is required' })
		expect(validateEmailForm({
			enabled: false,
			provider: null,
			resendApiKeyConfigured: false,
			resendApiKeyAction: 'keep',
			resendApiKeyValue: ''
		})).toEqual({})
	})
})
