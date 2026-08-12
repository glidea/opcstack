import type { SecretMutation } from '$apiContract/configuration'

export const CONFIGURATION_DOMAINS = [
	'general',
	'authentication',
	'email',
	'storage',
	'credits',
	'affiliate',
	'payment',
	'ai'
] as const

export type ConfigurationDomain = (typeof CONFIGURATION_DOMAINS)[number]
export type ConfigurationNavigationItem = {
	id: ConfigurationDomain
	href: string
}
export type EditorState<TValue> = {
	value: TValue
	savedValue: TValue
	dirty: boolean
}
export type SecretAction = SecretMutation['action']

export type AuthenticationFormValidationInput = {
	turnstileEnabled: boolean
	turnstileSiteKey: string
	turnstileSecretConfigured: boolean
	turnstileSecretAction: SecretAction
	turnstileSecretValue: string
	googleEnabled: boolean
	googleClientId: string
	googleSecretConfigured: boolean
	googleSecretAction: SecretAction
	googleSecretValue: string
	githubEnabled: boolean
	githubClientId: string
	githubSecretConfigured: boolean
	githubSecretAction: SecretAction
	githubSecretValue: string
	linuxdoEnabled: boolean
	linuxdoClientId: string
	linuxdoSecretConfigured: boolean
	linuxdoSecretAction: SecretAction
	linuxdoSecretValue: string
}

export type EmailFormValidationInput = {
	enabled: boolean
	provider: 'cloudflare' | 'resend' | null
	resendApiKeyConfigured: boolean
	resendApiKeyAction: SecretAction
	resendApiKeyValue: string
}

export function createConfigurationNavigation(locale: string): ConfigurationNavigationItem[] {
	return CONFIGURATION_DOMAINS.map((domain: ConfigurationDomain): ConfigurationNavigationItem => {
		return { id: domain, href: `/${locale}/admin/configuration/${domain}` }
	})
}

export function isConfigurationDomain(value: string): value is ConfigurationDomain {
	return CONFIGURATION_DOMAINS.includes(value as ConfigurationDomain)
}

export function createEditorState<TValue>(value: TValue): EditorState<TValue> {
	return { value, savedValue: value, dirty: false }
}

export function setEditorValue<TValue>(state: EditorState<TValue>, value: TValue): EditorState<TValue> {
	return {
		value,
		savedValue: state.savedValue,
		dirty: JSON.stringify(value) !== JSON.stringify(state.savedValue)
	}
}

export function markEditorSaved<TValue>(
	_state: EditorState<TValue>,
	value: TValue
): EditorState<TValue> {
	return { value, savedValue: value, dirty: false }
}

export function buildSecretMutation(action: SecretAction, value: string): SecretMutation {
	switch (action) {
		case 'keep':
			return { action: 'keep' }
		case 'replace':
			return { action: 'replace', value }
		case 'remove':
			return { action: 'remove' }
	}
}

export function validateAuthenticationForm(
	input: AuthenticationFormValidationInput
): Record<string, string> {
	const errors: Record<string, string> = {}
	if (input.turnstileEnabled) {
		if (input.turnstileSiteKey.trim() === '') errors['turnstileSiteKey'] = 'Site key is required'
		if (!hasSecret(input.turnstileSecretConfigured, input.turnstileSecretAction, input.turnstileSecretValue)) {
			errors['turnstileSecretKey'] = 'Secret key is required'
		}
	}
	validateProvider(errors, 'google', input.googleEnabled, input.googleClientId, input.googleSecretConfigured, input.googleSecretAction, input.googleSecretValue)
	validateProvider(errors, 'github', input.githubEnabled, input.githubClientId, input.githubSecretConfigured, input.githubSecretAction, input.githubSecretValue)
	validateProvider(errors, 'linuxdo', input.linuxdoEnabled, input.linuxdoClientId, input.linuxdoSecretConfigured, input.linuxdoSecretAction, input.linuxdoSecretValue)
	return errors
}

export function validateEmailForm(input: EmailFormValidationInput): Record<string, string> {
	const errors: Record<string, string> = {}
	if (input.enabled && input.provider === null) errors['provider'] = 'Provider is required'
	if (
		input.enabled &&
		input.provider === 'resend' &&
		!hasSecret(input.resendApiKeyConfigured, input.resendApiKeyAction, input.resendApiKeyValue)
	) {
		errors['resendApiKey'] = 'API key is required'
	}
	return errors
}

export function dispatchConfigurationDirty(dirty: boolean): void {
	window.dispatchEvent(new CustomEvent<boolean>('configuration-editor-dirty', { detail: dirty }))
}

function validateProvider(
	errors: Record<string, string>,
	provider: 'google' | 'github' | 'linuxdo',
	enabled: boolean,
	clientId: string,
	secretConfigured: boolean,
	secretAction: SecretAction,
	secretValue: string
): void {
	if (!enabled) return
	if (clientId.trim() === '') errors[`${provider}ClientId`] = 'Client ID is required'
	if (!hasSecret(secretConfigured, secretAction, secretValue)) {
		errors[`${provider}ClientSecret`] = 'Client secret is required'
	}
}

function hasSecret(configured: boolean, action: SecretAction, value: string): boolean {
	switch (action) {
		case 'keep':
			return configured
		case 'replace':
			return value.trim() !== ''
		case 'remove':
			return false
	}
}
