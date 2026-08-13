<script lang="ts">
	import { onDestroy, onMount } from 'svelte'
	import type { EmailConfig } from '$apiContract/configuration'
	import { ApiClientError, client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
	import { Button } from '$frontend/ui/button'
	import * as Field from '$frontend/ui/field'
	import * as Select from '$frontend/ui/select'
	import { Skeleton } from '$frontend/ui/skeleton'
	import { Switch } from '$frontend/ui/switch'
	import { toast } from 'svelte-sonner'
	import ConfigurationActions from './ConfigurationActions.svelte'
	import ConfigurationLoadError from './ConfigurationLoadError.svelte'
	import ConfigurationSection from './ConfigurationSection.svelte'
	import ConfigurationSaveError from './ConfigurationSaveError.svelte'
	import SecretField from './SecretField.svelte'
	import {
		buildSecretMutation,
		dispatchConfigurationEditorState,
		focusFirstConfigurationError,
		isConfigurationConflict,
		validateEmailForm,
		type SecretAction
	} from './configuration-page'

	let enabled: boolean = $state(false)
	let provider: '' | 'cloudflare' | 'resend' = $state('')
	let resendApiKeyConfigured: boolean = $state(false)
	let resendApiKeyAction: SecretAction = $state('keep')
	let resendApiKeyValue: string = $state('')
	let version: number = $state(1)
	let savedSnapshot: string = $state('')
	let loaded: boolean = $state(false)
	let saving: boolean = $state(false)
	let error: string = $state('')
	let conflict: boolean = $state(false)
	let errors: Record<string, string> = $state({})
	let dirty: boolean = $state(false)
	let expanded: boolean = $state(false)

	function snapshot(): string { return JSON.stringify({ enabled, provider, resendApiKeyAction, resendApiKeyValue }) }
	function applyConfig(config: EmailConfig): void {
		enabled = config.enabled
		provider = config.provider ?? ''
		resendApiKeyConfigured = config.resend_api_key_configured
		resendApiKeyAction = 'keep'
		resendApiKeyValue = ''
		version = config.version
		savedSnapshot = snapshot()
		errors = {}
		error = ''
		conflict = false
		expanded = config.enabled
	}
	function validate(): boolean {
		errors = validateEmailForm({ enabled, provider: provider === '' ? null : provider, resendApiKeyConfigured, resendApiKeyAction, resendApiKeyValue })
		return Object.keys(errors).length === 0
	}
	function fieldError(name: string): string {
		return errors[name] === undefined ? '' : $_(`admin.configuration.errors.${name}`)
	}
	async function loadConfig(): Promise<void> {
		loaded = false
		try { applyConfig(await client.api.getEmailConfig()); loaded = true }
		catch (loadError) { error = loadError instanceof ApiClientError ? loadError.body.message : $_('admin.configuration.loadError') }
	}
	async function saveConfig(): Promise<boolean> {
		if (!validate()) { focusFirstConfigurationError(); return false }
		saving = true
		error = ''
		try { applyConfig(await client.api.updateEmailConfig({ enabled, provider: provider === '' ? null : provider, resend_api_key: buildSecretMutation(resendApiKeyAction, resendApiKeyValue), expected_version: version })); toast.success($_('admin.configuration.saved')); return true }
		catch (saveError) { conflict = isConfigurationConflict(saveError); error = saveError instanceof ApiClientError ? saveError.body.message : $_('admin.configuration.saveError'); return false }
		finally { saving = false }
	}
	function discardChanges(): void {
		const value: { enabled: boolean; provider: '' | 'cloudflare' | 'resend'; resendApiKeyAction: SecretAction; resendApiKeyValue: string } = JSON.parse(savedSnapshot)
		enabled = value.enabled
		provider = value.provider
		resendApiKeyAction = value.resendApiKeyAction
		resendApiKeyValue = value.resendApiKeyValue
		errors = {}
		error = ''
	}
	$effect(() => { dirty = loaded && snapshot() !== savedSnapshot; dispatchConfigurationEditorState(dirty, saveConfig) })
	onMount((): void => { void loadConfig() })
	onDestroy((): void => dispatchConfigurationEditorState(false, saveConfig))
</script>

{#if !loaded}
	{#if error === ''}<div class="space-y-4 py-8"><Skeleton class="h-56 w-full" /></div>{:else}<ConfigurationLoadError {error} onRetry={loadConfig} />{/if}
{:else}
	{#if error !== ''}<ConfigurationSaveError {error} {conflict} onRefresh={loadConfig} />{/if}
	<form onsubmit={(event: SubmitEvent): void => { event.preventDefault(); void saveConfig() }}>
		<ConfigurationSection title={$_('admin.configuration.email.delivery')}>
			<div class="flex items-center justify-between gap-3"><Field.Field orientation="horizontal" class="flex-1"><Field.Label for="email-enabled">{$_('admin.configuration.enabled')}</Field.Label><Switch id="email-enabled" bind:checked={enabled} /></Field.Field><Button type="button" size="icon-sm" variant="ghost" onclick={() => (expanded = !expanded)} aria-label={expanded ? $_('admin.configuration.collapse') : $_('admin.configuration.expand')} title={expanded ? $_('admin.configuration.collapse') : $_('admin.configuration.expand')}><ChevronDownIcon class={expanded ? 'rotate-180' : ''} /></Button></div>
			{#if enabled || expanded}
				<Field.Field data-invalid={fieldError('provider') !== ''}>
					<Field.Label for="email-provider">{$_('admin.configuration.email.provider')}</Field.Label>
					<Select.Root type="single" bind:value={provider}>
						<Select.Trigger id="email-provider" class="w-full" aria-invalid={fieldError('provider') !== ''}><span>{provider === '' ? $_('admin.configuration.select') : $_(`admin.configuration.email.providers.${provider}`)}</span></Select.Trigger>
						<Select.Content><Select.Item value="cloudflare">{$_('admin.configuration.email.providers.cloudflare')}</Select.Item><Select.Item value="resend">Resend</Select.Item></Select.Content>
					</Select.Root>
					<Field.Error>{fieldError('provider')}</Field.Error>
				</Field.Field>
				{#if provider === 'resend'}
					<SecretField id="email-resend-api-key" label={$_('admin.configuration.email.apiKey')} configured={resendApiKeyConfigured} bind:action={resendApiKeyAction} bind:value={resendApiKeyValue} error={fieldError('resendApiKey')} />
				{/if}
			{/if}
		</ConfigurationSection>
		<ConfigurationActions {dirty} {saving} onSave={saveConfig} onDiscard={discardChanges} />
	</form>
{/if}
