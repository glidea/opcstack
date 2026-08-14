import type { SecretMutation } from '$apiContract/configuration'
import { ApiClientError } from '$apiContract/client'

export const CONFIGURATION_DOMAINS = [
	'general',
	'authentication',
	'email',
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
export type ConfigurationSave = () => Promise<boolean>
export type ConfigurationEditorStateDetail = {
	dirty: boolean
	save: ConfigurationSave
}
export type ConfigurationNavigationDecision =
	| { action: 'navigate' }
	| { action: 'confirm'; href: string }

export type AIRoutingPreset = 'balanced' | 'reliability' | 'speed' | 'cost' | 'custom'
export type AIRoutingWeights = {
	error: number
	latency: number
	price: number
}
export type CountryOption = {
	code: string
	name: string
}

const AI_ROUTING_PRESETS: Record<Exclude<AIRoutingPreset, 'custom'>, AIRoutingWeights> = {
	balanced: { error: 1, latency: 0.8, price: 0.2 },
	reliability: { error: 1, latency: 0.25, price: 0.1 },
	speed: { error: 0.25, latency: 1, price: 0.1 },
	cost: { error: 0.25, latency: 0.25, price: 1 }
}

export type AuthenticationFormValidationInput = {
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

export function getAIRoutingWeights(preset: AIRoutingPreset): AIRoutingWeights | null {
	if (preset === 'custom') return null
	return AI_ROUTING_PRESETS[preset]
}

export function getAIRoutingPreset(weights: AIRoutingWeights): AIRoutingPreset {
	const presets: Exclude<AIRoutingPreset, 'custom'>[] = ['balanced', 'reliability', 'speed', 'cost']
	for (const preset of presets) {
		if (JSON.stringify(AI_ROUTING_PRESETS[preset]) === JSON.stringify(weights)) return preset
	}
	return 'custom'
}

export function createCountryOptions(locale: string): CountryOption[] {
	const displayNames: Intl.DisplayNames = new Intl.DisplayNames([locale], { type: 'region' })
	const unknownRegionName: string | undefined = displayNames.of('ZZ')
	const options: CountryOption[] = []
	for (let first: number = 65; first <= 90; first += 1) {
		for (let second: number = 65; second <= 90; second += 1) {
			const code: string = String.fromCharCode(first, second)
			const name: string = displayNames.of(code) ?? code
			if (name !== code && name !== unknownRegionName) options.push({ code, name })
		}
	}
	return options.sort((left: CountryOption, right: CountryOption): number => left.name.localeCompare(right.name, locale))
}

export function isConfigurationDomain(value: string): value is ConfigurationDomain {
	return CONFIGURATION_DOMAINS.includes(value as ConfigurationDomain)
}

export function resolveConfigurationNavigation(
	dirty: boolean,
	currentPath: string,
	targetPath: string
): ConfigurationNavigationDecision {
	if (!dirty || currentPath === targetPath) return { action: 'navigate' }
	return { action: 'confirm', href: targetPath }
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
	validateProvider(errors, 'google', input.googleEnabled, input.googleClientId, input.googleSecretConfigured, input.googleSecretAction, input.googleSecretValue)
	validateProvider(errors, 'github', input.githubEnabled, input.githubClientId, input.githubSecretConfigured, input.githubSecretAction, input.githubSecretValue)
	validateProvider(errors, 'linuxdo', input.linuxdoEnabled, input.linuxdoClientId, input.linuxdoSecretConfigured, input.linuxdoSecretAction, input.linuxdoSecretValue)
	return errors
}

export function validateEmailForm(input: EmailFormValidationInput): Record<string, string> {
	const errors: Record<string, string> = {}
	if (input.provider === null) return errors
	if (
		input.provider === 'resend' &&
		!hasSecret(input.resendApiKeyConfigured, input.resendApiKeyAction, input.resendApiKeyValue)
	) {
		errors['resendApiKey'] = 'API key is required'
	}
	return errors
}

export function dispatchConfigurationEditorState(dirty: boolean, save: ConfigurationSave): void {
	if (typeof window === 'undefined') return
	const detail: ConfigurationEditorStateDetail = { dirty, save }
	window.dispatchEvent(new CustomEvent<ConfigurationEditorStateDetail>('configuration-editor-state', { detail }))
}

export function isConfigurationConflict(error: unknown): boolean {
	return error instanceof ApiClientError && error.body.code === 'CONFIG_CONFLICT'
}

export function focusFirstConfigurationError(): void {
	requestAnimationFrame((): void => {
		const field: HTMLElement | null = document.querySelector<HTMLElement>('[aria-invalid="true"]')
		field?.focus()
		field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
	})
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
	const configured: boolean = enabled || clientId.trim() !== '' || hasSecretValue(secretConfigured, secretAction, secretValue)
	if (!configured) return
	if (clientId.trim() === '') errors[`${provider}ClientId`] = 'Client ID is required'
	if (!hasSecret(secretConfigured, secretAction, secretValue)) {
		errors[`${provider}ClientSecret`] = 'Client secret is required'
	}
}

function hasSecretValue(configured: boolean, action: SecretAction, value: string): boolean {
	switch (action) {
		case 'keep':
			return configured
		case 'replace':
			return value.trim() !== ''
		case 'remove':
			return configured
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
