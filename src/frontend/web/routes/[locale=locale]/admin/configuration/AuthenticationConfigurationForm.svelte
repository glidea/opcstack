<script lang="ts">
	import { onDestroy, onMount } from 'svelte'
	import type { AuthenticationConfig } from '$apiContract/configuration'
	import { ApiClientError, client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import { Skeleton } from '$frontend/ui/skeleton'
	import { Switch } from '$frontend/ui/switch'
	import { Textarea } from '$frontend/ui/textarea'
	import ConfigurationActions from './ConfigurationActions.svelte'
	import ConfigurationLoadError from './ConfigurationLoadError.svelte'
	import ConfigurationSection from './ConfigurationSection.svelte'
	import OAuthProviderFieldset from './OAuthProviderFieldset.svelte'
	import SecretField from './SecretField.svelte'
	import {
		buildSecretMutation,
		dispatchConfigurationDirty,
		validateAuthenticationForm,
		type SecretAction
	} from './configuration-page'

	type AuthenticationFields = {
		betaCodeEnabled: boolean
		emailSignupEnabled: boolean
		emailDomainAllowlist: string
		emailRequireVerification: boolean
		emailCooldownSeconds: string
		turnstileEnabled: boolean
		turnstileSiteKey: string
		turnstileSecretAction: SecretAction
		turnstileSecretValue: string
		googleEnabled: boolean
		googleClientId: string
		googleSecretAction: SecretAction
		googleSecretValue: string
		githubEnabled: boolean
		githubClientId: string
		githubSecretAction: SecretAction
		githubSecretValue: string
		linuxdoEnabled: boolean
		linuxdoClientId: string
		linuxdoSecretAction: SecretAction
		linuxdoSecretValue: string
	}

	let betaCodeEnabled: boolean = $state(false)
	let emailSignupEnabled: boolean = $state(false)
	let emailDomainAllowlist: string = $state('')
	let emailRequireVerification: boolean = $state(false)
	let emailCooldownSeconds: string = $state('60')
	let turnstileEnabled: boolean = $state(false)
	let turnstileSiteKey: string = $state('')
	let turnstileSecretConfigured: boolean = $state(false)
	let turnstileSecretAction: SecretAction = $state('keep')
	let turnstileSecretValue: string = $state('')
	let googleEnabled: boolean = $state(false)
	let googleClientId: string = $state('')
	let googleSecretConfigured: boolean = $state(false)
	let googleSecretAction: SecretAction = $state('keep')
	let googleSecretValue: string = $state('')
	let googleCallbackUrl: string = $state('')
	let githubEnabled: boolean = $state(false)
	let githubClientId: string = $state('')
	let githubSecretConfigured: boolean = $state(false)
	let githubSecretAction: SecretAction = $state('keep')
	let githubSecretValue: string = $state('')
	let githubCallbackUrl: string = $state('')
	let linuxdoEnabled: boolean = $state(false)
	let linuxdoClientId: string = $state('')
	let linuxdoSecretConfigured: boolean = $state(false)
	let linuxdoSecretAction: SecretAction = $state('keep')
	let linuxdoSecretValue: string = $state('')
	let linuxdoCallbackUrl: string = $state('')
	let version: number = $state(1)
	let savedSnapshot: string = $state('')
	let loaded: boolean = $state(false)
	let saving: boolean = $state(false)
	let error: string = $state('')
	let errors: Record<string, string> = $state({})
	let dirty: boolean = $state(false)

	function fields(): AuthenticationFields {
		return {
			betaCodeEnabled, emailSignupEnabled, emailDomainAllowlist, emailRequireVerification,
			emailCooldownSeconds, turnstileEnabled, turnstileSiteKey, turnstileSecretAction,
			turnstileSecretValue, googleEnabled, googleClientId, googleSecretAction,
			googleSecretValue, githubEnabled, githubClientId, githubSecretAction,
			githubSecretValue, linuxdoEnabled, linuxdoClientId, linuxdoSecretAction,
			linuxdoSecretValue
		}
	}

	function snapshot(): string { return JSON.stringify(fields()) }

	function applyConfig(config: AuthenticationConfig): void {
		betaCodeEnabled = config.beta_code_enabled
		emailSignupEnabled = config.email_signup_enabled
		emailDomainAllowlist = config.email_signup_domain_allowlist.join('\n')
		emailRequireVerification = config.email_require_verification
		emailCooldownSeconds = String(config.email_user_action_cooldown_seconds)
		turnstileEnabled = config.turnstile_enabled
		turnstileSiteKey = config.turnstile_site_key ?? ''
		turnstileSecretConfigured = config.turnstile_secret_key_configured
		turnstileSecretAction = 'keep'
		turnstileSecretValue = ''
		googleEnabled = config.google_auth_enabled
		googleClientId = config.google_client_id ?? ''
		googleSecretConfigured = config.google_client_secret_configured
		googleSecretAction = 'keep'
		googleSecretValue = ''
		googleCallbackUrl = config.google_callback_url
		githubEnabled = config.github_auth_enabled
		githubClientId = config.github_client_id ?? ''
		githubSecretConfigured = config.github_client_secret_configured
		githubSecretAction = 'keep'
		githubSecretValue = ''
		githubCallbackUrl = config.github_callback_url
		linuxdoEnabled = config.linuxdo_auth_enabled
		linuxdoClientId = config.linuxdo_client_id ?? ''
		linuxdoSecretConfigured = config.linuxdo_client_secret_configured
		linuxdoSecretAction = 'keep'
		linuxdoSecretValue = ''
		linuxdoCallbackUrl = config.linuxdo_callback_url
		version = config.version
		savedSnapshot = snapshot()
		errors = {}
		error = ''
	}

	function fieldError(name: string): string {
		return errors[name] === undefined ? '' : $_(`admin.configuration.errors.${name}`)
	}

	function validate(): boolean {
		errors = validateAuthenticationForm({
			turnstileEnabled, turnstileSiteKey, turnstileSecretConfigured, turnstileSecretAction,
			turnstileSecretValue, googleEnabled, googleClientId, googleSecretConfigured,
			googleSecretAction, googleSecretValue, githubEnabled, githubClientId,
			githubSecretConfigured, githubSecretAction, githubSecretValue, linuxdoEnabled,
			linuxdoClientId, linuxdoSecretConfigured, linuxdoSecretAction, linuxdoSecretValue
		})
		const cooldown: number = Number(emailCooldownSeconds)
		if (!Number.isInteger(cooldown) || cooldown <= 0) errors['emailCooldownSeconds'] = 'Invalid cooldown'
		return Object.keys(errors).length === 0
	}

	async function loadConfig(): Promise<void> {
		loaded = false
		try { applyConfig(await client.api.getAuthenticationConfig()); loaded = true }
		catch (loadError) { error = loadError instanceof ApiClientError ? loadError.body.message : $_('admin.configuration.loadError') }
	}

	async function saveConfig(): Promise<void> {
		if (!validate()) return
		saving = true
		error = ''
		try {
			applyConfig(await client.api.updateAuthenticationConfig({
				beta_code_enabled: betaCodeEnabled,
				email_signup_enabled: emailSignupEnabled,
				email_signup_domain_allowlist: emailDomainAllowlist.split(/[\n,]/).map((value: string): string => value.trim()).filter((value: string): boolean => value !== ''),
				email_require_verification: emailRequireVerification,
				email_user_action_cooldown_seconds: Number(emailCooldownSeconds),
				turnstile_enabled: turnstileEnabled,
				turnstile_site_key: turnstileSiteKey.trim() === '' ? null : turnstileSiteKey.trim(),
				turnstile_secret_key: buildSecretMutation(turnstileSecretAction, turnstileSecretValue),
				google_auth_enabled: googleEnabled,
				google_client_id: googleClientId.trim() === '' ? null : googleClientId.trim(),
				google_client_secret: buildSecretMutation(googleSecretAction, googleSecretValue),
				github_auth_enabled: githubEnabled,
				github_client_id: githubClientId.trim() === '' ? null : githubClientId.trim(),
				github_client_secret: buildSecretMutation(githubSecretAction, githubSecretValue),
				linuxdo_auth_enabled: linuxdoEnabled,
				linuxdo_client_id: linuxdoClientId.trim() === '' ? null : linuxdoClientId.trim(),
				linuxdo_client_secret: buildSecretMutation(linuxdoSecretAction, linuxdoSecretValue),
				expected_version: version
			}))
		} catch (saveError) { error = saveError instanceof ApiClientError ? saveError.body.message : $_('admin.configuration.saveError') }
		finally { saving = false }
	}

	function discardChanges(): void {
		const value: AuthenticationFields = JSON.parse(savedSnapshot)
		betaCodeEnabled = value.betaCodeEnabled
		emailSignupEnabled = value.emailSignupEnabled
		emailDomainAllowlist = value.emailDomainAllowlist
		emailRequireVerification = value.emailRequireVerification
		emailCooldownSeconds = value.emailCooldownSeconds
		turnstileEnabled = value.turnstileEnabled
		turnstileSiteKey = value.turnstileSiteKey
		turnstileSecretAction = value.turnstileSecretAction
		turnstileSecretValue = value.turnstileSecretValue
		googleEnabled = value.googleEnabled
		googleClientId = value.googleClientId
		googleSecretAction = value.googleSecretAction
		googleSecretValue = value.googleSecretValue
		githubEnabled = value.githubEnabled
		githubClientId = value.githubClientId
		githubSecretAction = value.githubSecretAction
		githubSecretValue = value.githubSecretValue
		linuxdoEnabled = value.linuxdoEnabled
		linuxdoClientId = value.linuxdoClientId
		linuxdoSecretAction = value.linuxdoSecretAction
		linuxdoSecretValue = value.linuxdoSecretValue
		errors = {}
		error = ''
	}

	$effect(() => { dirty = loaded && snapshot() !== savedSnapshot; dispatchConfigurationDirty(dirty) })
	onMount((): void => { void loadConfig() })
	onDestroy((): void => dispatchConfigurationDirty(false))
</script>

{#if !loaded}
	{#if error === ''}<div class="space-y-4 py-8"><Skeleton class="h-48 w-full" /><Skeleton class="h-48 w-full" /></div>{:else}<ConfigurationLoadError {error} onRetry={loadConfig} />{/if}
{:else}
	{#if error !== ''}<Alert.Root variant="destructive"><Alert.Description>{error}</Alert.Description></Alert.Root>{/if}
	<form onsubmit={(event: SubmitEvent): void => { event.preventDefault(); void saveConfig() }}>
		<ConfigurationSection title={$_('admin.configuration.authentication.access')}>
			<Field.Field orientation="horizontal"><Field.Label for="auth-beta-code">{$_('admin.configuration.authentication.betaCode')}</Field.Label><Switch id="auth-beta-code" bind:checked={betaCodeEnabled} /></Field.Field>
			<Field.Field orientation="horizontal"><Field.Label for="auth-email-signup">{$_('admin.configuration.authentication.emailSignup')}</Field.Label><Switch id="auth-email-signup" bind:checked={emailSignupEnabled} /></Field.Field>
			{#if emailSignupEnabled}
				<Field.Field><Field.Label for="auth-email-allowlist">{$_('admin.configuration.authentication.domainAllowlist')}</Field.Label><Textarea id="auth-email-allowlist" bind:value={emailDomainAllowlist} /><Field.Description>{$_('admin.configuration.authentication.domainAllowlistDescription')}</Field.Description></Field.Field>
				<Field.Field orientation="horizontal"><Field.Label for="auth-email-verification">{$_('admin.configuration.authentication.requireVerification')}</Field.Label><Switch id="auth-email-verification" bind:checked={emailRequireVerification} /></Field.Field>
				<Field.Field data-invalid={fieldError('emailCooldownSeconds') !== ''}><Field.Label for="auth-email-cooldown">{$_('admin.configuration.authentication.cooldown')}</Field.Label><Input id="auth-email-cooldown" type="number" min="1" inputmode="numeric" bind:value={emailCooldownSeconds} aria-invalid={fieldError('emailCooldownSeconds') !== ''} /><Field.Error>{fieldError('emailCooldownSeconds')}</Field.Error></Field.Field>
			{/if}
		</ConfigurationSection>
		<ConfigurationSection title={$_('admin.configuration.authentication.turnstile')}>
			<Field.Field orientation="horizontal"><Field.Label for="auth-turnstile-enabled">{$_('admin.configuration.enabled')}</Field.Label><Switch id="auth-turnstile-enabled" bind:checked={turnstileEnabled} /></Field.Field>
			{#if turnstileEnabled}
				<Field.Field data-invalid={fieldError('turnstileSiteKey') !== ''}><Field.Label for="auth-turnstile-site-key">{$_('admin.configuration.authentication.siteKey')}</Field.Label><Input id="auth-turnstile-site-key" autocomplete="off" bind:value={turnstileSiteKey} aria-invalid={fieldError('turnstileSiteKey') !== ''} /><Field.Error>{fieldError('turnstileSiteKey')}</Field.Error></Field.Field>
				<SecretField id="auth-turnstile-secret" label={$_('admin.configuration.authentication.secretKey')} configured={turnstileSecretConfigured} bind:action={turnstileSecretAction} bind:value={turnstileSecretValue} error={fieldError('turnstileSecretKey')} />
			{/if}
		</ConfigurationSection>
		<OAuthProviderFieldset id="auth-google" title="Google" bind:enabled={googleEnabled} bind:clientId={googleClientId} secretConfigured={googleSecretConfigured} bind:secretAction={googleSecretAction} bind:secretValue={googleSecretValue} callbackUrl={googleCallbackUrl} clientIdError={fieldError('googleClientId')} secretError={fieldError('googleClientSecret')} />
		<OAuthProviderFieldset id="auth-github" title="GitHub" bind:enabled={githubEnabled} bind:clientId={githubClientId} secretConfigured={githubSecretConfigured} bind:secretAction={githubSecretAction} bind:secretValue={githubSecretValue} callbackUrl={githubCallbackUrl} clientIdError={fieldError('githubClientId')} secretError={fieldError('githubClientSecret')} />
		<OAuthProviderFieldset id="auth-linuxdo" title="LinuxDO" bind:enabled={linuxdoEnabled} bind:clientId={linuxdoClientId} secretConfigured={linuxdoSecretConfigured} bind:secretAction={linuxdoSecretAction} bind:secretValue={linuxdoSecretValue} callbackUrl={linuxdoCallbackUrl} clientIdError={fieldError('linuxdoClientId')} secretError={fieldError('linuxdoClientSecret')} />
		<ConfigurationActions {dirty} {saving} onSave={saveConfig} onDiscard={discardChanges} />
	</form>
{/if}
