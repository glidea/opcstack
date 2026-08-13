import { describe, expect, it } from 'vitest'
import {
	buildSecretMutation,
	createConfigurationNavigation,
	createEditorState,
	dispatchConfigurationEditorState,
	isConfigurationConflict,
	markEditorSaved,
	resolveConfigurationNavigation,
	setEditorValue,
	validateAuthenticationForm,
	validateEmailForm
} from './configuration-page'
import { ApiClientError } from '$apiContract/client'

describe('configuration navigation', () => {
	it('defines stable business domain routes', () => {
		expect(createConfigurationNavigation('en')).toEqual([
			{ id: 'general', href: '/en/admin/configuration/general' },
			{ id: 'authentication', href: '/en/admin/configuration/authentication' },
			{ id: 'email', href: '/en/admin/configuration/email' },
			{ id: 'credits', href: '/en/admin/configuration/credits' },
			{ id: 'affiliate', href: '/en/admin/configuration/affiliate' },
			{ id: 'payment', href: '/en/admin/configuration/payment' },
			{ id: 'ai', href: '/en/admin/configuration/ai' }
		])
	})

	it('allows clean navigation and confirms dirty navigation to another domain', () => {
		expect(resolveConfigurationNavigation(false, '/en/admin/configuration/general', '/en/admin/configuration/email')).toEqual({ action: 'navigate' })
		expect(resolveConfigurationNavigation(true, '/en/admin/configuration/general', '/en/admin/configuration/general')).toEqual({ action: 'navigate' })
		expect(resolveConfigurationNavigation(true, '/en/admin/configuration/general', '/en/admin/configuration/email')).toEqual({
			action: 'confirm',
			href: '/en/admin/configuration/email'
		})
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

	it('does not dispatch browser events during server rendering', () => {
		const save: () => Promise<boolean> = async (): Promise<boolean> => true
		expect((): void => dispatchConfigurationEditorState(true, save)).not.toThrow()
	})

	it('recognizes stale singleton updates without treating other failures as conflicts', () => {
		expect(isConfigurationConflict(new ApiClientError(409, { code: 'CONFIG_CONFLICT', message: 'changed' }))).toBe(true)
		expect(isConfigurationConflict(new ApiClientError(500, { code: 'CONFIG_UNAVAILABLE', message: 'failed' }))).toBe(false)
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

	it('rejects a partially configured disabled authentication provider', () => {
		expect(validateAuthenticationForm({
			googleEnabled: false,
			googleClientId: 'client-id',
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
		})).toEqual({ googleClientSecret: 'Client secret is required' })
	})

	it('requires the Resend key when Resend is configured', () => {
		expect(validateEmailForm({
			provider: 'resend',
			resendApiKeyConfigured: false,
			resendApiKeyAction: 'keep',
			resendApiKeyValue: ''
		})).toEqual({ resendApiKey: 'API key is required' })
		expect(validateEmailForm({
			provider: null,
			resendApiKeyConfigured: false,
			resendApiKeyAction: 'keep',
			resendApiKeyValue: ''
		})).toEqual({})
	})

	it('rejects an incomplete Email provider', () => {
		expect(validateEmailForm({
			provider: 'resend',
			resendApiKeyConfigured: false,
			resendApiKeyAction: 'keep',
			resendApiKeyValue: ''
		})).toEqual({ resendApiKey: 'API key is required' })
	})

	it('allows removing the Email provider when a Resend key is stored', (): void => {
		expect(validateEmailForm({
			provider: null,
			resendApiKeyConfigured: true,
			resendApiKeyAction: 'keep',
			resendApiKeyValue: ''
		})).toEqual({})
	})
})
