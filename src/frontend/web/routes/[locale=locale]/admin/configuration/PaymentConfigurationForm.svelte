<script lang="ts">
	import { onDestroy, onMount } from 'svelte'
	import type { PaymentConfig, PaymentProviderName } from '$apiContract/configuration'
	import { ApiClientError, client } from '$apiContract/client'
	import { _, locale } from '$frontend/i18n'
	import { Button } from '$frontend/ui/button'
	import * as Field from '$frontend/ui/field'
	import * as Select from '$frontend/ui/select'
	import { Skeleton } from '$frontend/ui/skeleton'
	import { Switch } from '$frontend/ui/switch'
	import CopyIcon from '@lucide/svelte/icons/copy'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import TrashIcon from '@lucide/svelte/icons/trash-2'
	import { get } from 'svelte/store'
	import { toast } from 'svelte-sonner'
	import ConfigurationActions from './ConfigurationActions.svelte'
	import ConfigurationLoadError from './ConfigurationLoadError.svelte'
	import ConfigurationSection from './ConfigurationSection.svelte'
	import ConfigurationSaveError from './ConfigurationSaveError.svelte'
	import CountryPicker from './CountryPicker.svelte'
	import SecretField from './SecretField.svelte'
	import {
		buildSecretMutation,
		dispatchConfigurationEditorState,
		focusFirstConfigurationError,
		isConfigurationConflict,
		type SecretAction
	} from './configuration-page'

	type CountryOverride = { country: string; provider: PaymentProviderName }
	type SavedPaymentForm = {
		enabled: boolean
		defaultProvider: '' | PaymentProviderName
		countryOverrides: CountryOverride[]
		dodoApiKeyAction: SecretAction
		dodoApiKeyValue: string
		dodoWebhookSecretAction: SecretAction
		dodoWebhookSecretValue: string
		creemApiKeyAction: SecretAction
		creemApiKeyValue: string
		creemWebhookSecretAction: SecretAction
		creemWebhookSecretValue: string
	}

	let enabled: boolean = $state(false)
	let defaultProvider: '' | PaymentProviderName = $state('')
	let countryOverrides: CountryOverride[] = $state([])
	let dodoApiKeyConfigured: boolean = $state(false)
	let dodoApiKeyAction: SecretAction = $state('keep')
	let dodoApiKeyValue: string = $state('')
	let dodoWebhookSecretConfigured: boolean = $state(false)
	let dodoWebhookSecretAction: SecretAction = $state('keep')
	let dodoWebhookSecretValue: string = $state('')
	let dodoWebhookUrl: string = $state('')
	let creemApiKeyConfigured: boolean = $state(false)
	let creemApiKeyAction: SecretAction = $state('keep')
	let creemApiKeyValue: string = $state('')
	let creemWebhookSecretConfigured: boolean = $state(false)
	let creemWebhookSecretAction: SecretAction = $state('keep')
	let creemWebhookSecretValue: string = $state('')
	let creemWebhookUrl: string = $state('')
	let version: number = $state(1)
	let loaded: boolean = $state(false)
	let saving: boolean = $state(false)
	let error: string = $state('')
	let conflict: boolean = $state(false)
	let errors: Record<string, string> = $state({})
	let savedSnapshot: string = $state('')
	let dirty: boolean = $state(false)
	let currentLocale: string = get(locale) ?? 'en'
	let availableProviders: PaymentProviderName[] = $derived([
		...(secretAvailable(dodoApiKeyConfigured, dodoApiKeyAction, dodoApiKeyValue) && secretAvailable(dodoWebhookSecretConfigured, dodoWebhookSecretAction, dodoWebhookSecretValue) ? ['dodo' as const] : []),
		...(secretAvailable(creemApiKeyConfigured, creemApiKeyAction, creemApiKeyValue) && secretAvailable(creemWebhookSecretConfigured, creemWebhookSecretAction, creemWebhookSecretValue) ? ['creem' as const] : [])
	])

	function snapshot(): string {
		return JSON.stringify({ enabled, defaultProvider, countryOverrides, dodoApiKeyAction, dodoApiKeyValue, dodoWebhookSecretAction, dodoWebhookSecretValue, creemApiKeyAction, creemApiKeyValue, creemWebhookSecretAction, creemWebhookSecretValue } satisfies SavedPaymentForm)
	}

	function applyConfig(config: PaymentConfig): void {
		enabled = config.enabled
		defaultProvider = config.default_provider ?? ''
		countryOverrides = config.country_provider_overrides.map((item: CountryOverride): CountryOverride => ({ ...item }))
		dodoApiKeyConfigured = config.dodo.api_key_configured
		dodoApiKeyAction = 'keep'
		dodoApiKeyValue = ''
		dodoWebhookSecretConfigured = config.dodo.webhook_secret_configured
		dodoWebhookSecretAction = 'keep'
		dodoWebhookSecretValue = ''
		dodoWebhookUrl = config.dodo.webhook_url
		creemApiKeyConfigured = config.creem.api_key_configured
		creemApiKeyAction = 'keep'
		creemApiKeyValue = ''
		creemWebhookSecretConfigured = config.creem.webhook_secret_configured
		creemWebhookSecretAction = 'keep'
		creemWebhookSecretValue = ''
		creemWebhookUrl = config.creem.webhook_url
		version = config.version
		errors = {}
		error = ''
		conflict = false
		savedSnapshot = snapshot()
	}

	function secretAvailable(configured: boolean, action: SecretAction, value: string): boolean {
		switch (action) {
			case 'keep': return configured
			case 'replace': return value.trim() !== ''
			case 'remove': return false
		}
	}

	function validate(): CountryOverride[] | null {
		errors = {}
		const overrides: CountryOverride[] = countryOverrides.map((override: CountryOverride): CountryOverride => ({ country: override.country.trim().toUpperCase(), provider: override.provider }))
		if (enabled && (defaultProvider === '' || !availableProviders.includes(defaultProvider))) errors['defaultProvider'] = $_('admin.configuration.payment.errors.defaultProvider')
		if (overrides.some((override: CountryOverride): boolean => !/^[A-Z]{2}$/.test(override.country))) errors['countryOverrides'] = $_('admin.configuration.payment.errors.countryOverrides')
		if (overrides.some((override: CountryOverride): boolean => !availableProviders.includes(override.provider))) errors['countryOverrides'] = $_('admin.configuration.payment.errors.unavailableProvider')
		const activeProviders: Set<PaymentProviderName> = new Set()
		if (defaultProvider !== '') activeProviders.add(defaultProvider)
		for (const override of overrides) activeProviders.add(override.provider)
		if (enabled && activeProviders.has('dodo')) {
			if (!secretAvailable(dodoApiKeyConfigured, dodoApiKeyAction, dodoApiKeyValue)) errors['dodoApiKey'] = $_('admin.configuration.payment.errors.apiKey')
			if (!secretAvailable(dodoWebhookSecretConfigured, dodoWebhookSecretAction, dodoWebhookSecretValue)) errors['dodoWebhookSecret'] = $_('admin.configuration.payment.errors.webhookSecret')
		}
		if (enabled && activeProviders.has('creem')) {
			if (!secretAvailable(creemApiKeyConfigured, creemApiKeyAction, creemApiKeyValue)) errors['creemApiKey'] = $_('admin.configuration.payment.errors.apiKey')
			if (!secretAvailable(creemWebhookSecretConfigured, creemWebhookSecretAction, creemWebhookSecretValue)) errors['creemWebhookSecret'] = $_('admin.configuration.payment.errors.webhookSecret')
		}
		return Object.keys(errors).length === 0 ? overrides : null
	}

	function addCountryOverride(): void {
		const provider: PaymentProviderName | undefined = availableProviders[0]
		if (provider === undefined) return
		countryOverrides = [...countryOverrides, { country: '', provider }]
	}

	function removeCountryOverride(index: number): void {
		countryOverrides = countryOverrides.filter((_override: CountryOverride, itemIndex: number): boolean => itemIndex !== index)
	}

	async function copyWebhookUrl(url: string): Promise<void> {
		await navigator.clipboard.writeText(url)
		toast.success($_('admin.configuration.copied'))
	}

	async function loadConfig(): Promise<void> {
		loaded = false
		try {
			applyConfig(await client.api.getPaymentConfig())
			loaded = true
		} catch (loadError) {
			error = loadError instanceof ApiClientError ? loadError.body.message : $_('admin.configuration.loadError')
		}
	}

	async function saveConfig(): Promise<boolean> {
		const overrides: CountryOverride[] | null = validate()
		if (overrides === null) { focusFirstConfigurationError(); return false }
		saving = true
		error = ''
		try {
			applyConfig(await client.api.updatePaymentConfig({
				enabled,
				default_provider: defaultProvider === '' ? null : defaultProvider,
				country_provider_overrides: overrides,
				dodo_api_key: buildSecretMutation(dodoApiKeyAction, dodoApiKeyValue),
				dodo_webhook_secret: buildSecretMutation(dodoWebhookSecretAction, dodoWebhookSecretValue),
				creem_api_key: buildSecretMutation(creemApiKeyAction, creemApiKeyValue),
				creem_webhook_secret: buildSecretMutation(creemWebhookSecretAction, creemWebhookSecretValue),
				expected_version: version
				}))
			toast.success($_('admin.configuration.saved'))
			return true
		} catch (saveError) {
			conflict = isConfigurationConflict(saveError)
			error = saveError instanceof ApiClientError ? saveError.body.message : $_('admin.configuration.saveError')
			return false
		} finally {
			saving = false
		}
	}

	function discardChanges(): void {
		const value: SavedPaymentForm = JSON.parse(savedSnapshot) as SavedPaymentForm
		enabled = value.enabled
		defaultProvider = value.defaultProvider
		countryOverrides = value.countryOverrides.map((item: CountryOverride): CountryOverride => ({ ...item }))
		dodoApiKeyAction = value.dodoApiKeyAction
		dodoApiKeyValue = value.dodoApiKeyValue
		dodoWebhookSecretAction = value.dodoWebhookSecretAction
		dodoWebhookSecretValue = value.dodoWebhookSecretValue
		creemApiKeyAction = value.creemApiKeyAction
		creemApiKeyValue = value.creemApiKeyValue
		creemWebhookSecretAction = value.creemWebhookSecretAction
		creemWebhookSecretValue = value.creemWebhookSecretValue
		errors = {}
		error = ''
	}

	$effect((): void => { dirty = loaded && snapshot() !== savedSnapshot; dispatchConfigurationEditorState(dirty, saveConfig) })
	onMount((): void => { void loadConfig() })
	onDestroy((): void => dispatchConfigurationEditorState(false, saveConfig))
</script>

{#if !loaded}
	{#if error === ''}<div class="space-y-4 py-8"><Skeleton class="h-96 w-full" /></div>{:else}<ConfigurationLoadError {error} onRetry={loadConfig} />{/if}
{:else}
	{#if error !== ''}<ConfigurationSaveError {error} {conflict} onRefresh={loadConfig} />{/if}
	<form onsubmit={(event: SubmitEvent): void => { event.preventDefault(); void saveConfig() }}>
		<ConfigurationSection title={$_('admin.configuration.payment.availability')} description={$_('admin.configuration.payment.availabilityDescription')}>
			<Field.Field orientation="horizontal"><Field.Label for="payment-enabled">{$_('admin.configuration.payment.enableAction')}</Field.Label><Switch id="payment-enabled" bind:checked={enabled} /></Field.Field>
			{#if enabled}
				<Field.Field data-invalid={errors['defaultProvider'] !== undefined}>
					<Field.Label for="payment-default-provider">{$_('admin.configuration.payment.defaultProvider')}</Field.Label>
					<Select.Root type="single" bind:value={defaultProvider}><Select.Trigger id="payment-default-provider" class="max-w-sm" aria-invalid={errors['defaultProvider'] !== undefined}>{defaultProvider === '' ? $_('admin.configuration.select') : defaultProvider === 'dodo' ? 'Dodo Payments' : 'Creem'}</Select.Trigger><Select.Content>{#each availableProviders as provider}<Select.Item value={provider}>{provider === 'dodo' ? 'Dodo Payments' : 'Creem'}</Select.Item>{/each}</Select.Content></Select.Root>
					{#if availableProviders.length === 0}<Field.Description>{$_('admin.configuration.payment.noProvider')}</Field.Description>{/if}
					<Field.Error>{errors['defaultProvider'] ?? ''}</Field.Error>
				</Field.Field>
				<Field.Field data-invalid={errors['countryOverrides'] !== undefined}>
					<div class="flex items-center justify-between gap-3"><div><Field.Label>{$_('admin.configuration.payment.countryOverrides')}</Field.Label><Field.Description>{$_('admin.configuration.payment.countryOverridesDescription')}</Field.Description></div><Button type="button" size="sm" variant="outline" disabled={availableProviders.length === 0} onclick={addCountryOverride}><PlusIcon />{$_('admin.configuration.payment.addCountryOverride')}</Button></div>
					{#if countryOverrides.length > 0}
						<div class="space-y-2">{#each countryOverrides as override, index}<div class="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_180px_36px]"><CountryPicker id={`payment-country-${index}`} locale={currentLocale} bind:value={override.country} /><Select.Root type="single" bind:value={override.provider}><Select.Trigger class="w-full">{override.provider === 'dodo' ? 'Dodo Payments' : 'Creem'}</Select.Trigger><Select.Content>{#each availableProviders as provider}<Select.Item value={provider}>{provider === 'dodo' ? 'Dodo Payments' : 'Creem'}</Select.Item>{/each}</Select.Content></Select.Root><Button type="button" size="icon-sm" variant="ghost" onclick={() => removeCountryOverride(index)} aria-label={$_('admin.configuration.entity.delete')} title={$_('admin.configuration.entity.delete')}><TrashIcon /></Button></div>{/each}</div>
					{/if}
					<Field.Error>{errors['countryOverrides'] ?? ''}</Field.Error>
				</Field.Field>
			{/if}
		</ConfigurationSection>
		<ConfigurationSection title="Dodo Payments" description={$_('admin.configuration.payment.dodoDescription')}>
				<Field.Description>{$_('admin.configuration.payment.environmentFromKey')}</Field.Description>
				<SecretField id="payment-dodo-api-key" label={$_('admin.configuration.payment.apiKey')} configured={dodoApiKeyConfigured} bind:action={dodoApiKeyAction} bind:value={dodoApiKeyValue} error={errors['dodoApiKey'] ?? ''} />
				<SecretField id="payment-dodo-webhook-secret" label={$_('admin.configuration.payment.webhookSecret')} configured={dodoWebhookSecretConfigured} bind:action={dodoWebhookSecretAction} bind:value={dodoWebhookSecretValue} error={errors['dodoWebhookSecret'] ?? ''} />
				<Field.Field><Field.Label for="payment-dodo-webhook-url">{$_('admin.configuration.payment.webhookUrl')}</Field.Label><div class="flex max-w-md items-center gap-2"><code id="payment-dodo-webhook-url" class="min-w-0 flex-1 break-all rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{dodoWebhookUrl}</code><Button type="button" size="icon-sm" variant="ghost" onclick={() => copyWebhookUrl(dodoWebhookUrl)} aria-label={$_('admin.configuration.copy')} title={$_('admin.configuration.copy')}><CopyIcon /></Button></div></Field.Field>
			</ConfigurationSection>
			<ConfigurationSection title="Creem" description={$_('admin.configuration.payment.creemDescription')}>
				<Field.Description>{$_('admin.configuration.payment.environmentFromKey')}</Field.Description>
				<SecretField id="payment-creem-api-key" label={$_('admin.configuration.payment.apiKey')} configured={creemApiKeyConfigured} bind:action={creemApiKeyAction} bind:value={creemApiKeyValue} error={errors['creemApiKey'] ?? ''} />
				<SecretField id="payment-creem-webhook-secret" label={$_('admin.configuration.payment.webhookSecret')} configured={creemWebhookSecretConfigured} bind:action={creemWebhookSecretAction} bind:value={creemWebhookSecretValue} error={errors['creemWebhookSecret'] ?? ''} />
				<Field.Field><Field.Label for="payment-creem-webhook-url">{$_('admin.configuration.payment.webhookUrl')}</Field.Label><div class="flex max-w-md items-center gap-2"><code id="payment-creem-webhook-url" class="min-w-0 flex-1 break-all rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{creemWebhookUrl}</code><Button type="button" size="icon-sm" variant="ghost" onclick={() => copyWebhookUrl(creemWebhookUrl)} aria-label={$_('admin.configuration.copy')} title={$_('admin.configuration.copy')}><CopyIcon /></Button></div></Field.Field>
			</ConfigurationSection>
	</form>
	<ConfigurationActions {dirty} {saving} onSave={saveConfig} onDiscard={discardChanges} />
{/if}
