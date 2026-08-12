<script lang="ts">
	import { onDestroy, onMount } from 'svelte'
	import type { PaymentConfig, PaymentProduct, PaymentProviderName } from '$apiContract/configuration'
	import { ApiClientError, client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import * as AlertDialog from '$frontend/ui/alert-dialog'
	import { Badge } from '$frontend/ui/badge'
	import { Button } from '$frontend/ui/button'
	import * as Empty from '$frontend/ui/empty'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import * as Select from '$frontend/ui/select'
	import { Skeleton } from '$frontend/ui/skeleton'
	import { Switch } from '$frontend/ui/switch'
	import * as Table from '$frontend/ui/table'
	import { Textarea } from '$frontend/ui/textarea'
	import PackageIcon from '@lucide/svelte/icons/package'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import TrashIcon from '@lucide/svelte/icons/trash-2'
	import ConfigurationActions from './ConfigurationActions.svelte'
	import ConfigurationLoadError from './ConfigurationLoadError.svelte'
	import ConfigurationSection from './ConfigurationSection.svelte'
	import PaymentProductDialog from './PaymentProductDialog.svelte'
	import SecretField from './SecretField.svelte'
	import {
		removeConfigurationEntity,
		replaceConfigurationEntity
	} from './configuration-collections'
	import {
		buildSecretMutation,
		dispatchConfigurationDirty,
		type SecretAction
	} from './configuration-page'

	type CountryOverride = { country: string; provider: PaymentProviderName }
	type SavedPaymentForm = {
		enabled: boolean
		defaultProvider: '' | PaymentProviderName
		countryOverrides: string
		dodoTestMode: boolean
		dodoApiKeyAction: SecretAction
		dodoApiKeyValue: string
		dodoWebhookSecretAction: SecretAction
		dodoWebhookSecretValue: string
		creemTestMode: boolean
		creemApiKeyAction: SecretAction
		creemApiKeyValue: string
		creemWebhookSecretAction: SecretAction
		creemWebhookSecretValue: string
	}

	let enabled: boolean = $state(false)
	let defaultProvider: '' | PaymentProviderName = $state('')
	let countryOverrides: string = $state('')
	let dodoTestMode: boolean = $state(false)
	let dodoApiKeyConfigured: boolean = $state(false)
	let dodoApiKeyAction: SecretAction = $state('keep')
	let dodoApiKeyValue: string = $state('')
	let dodoWebhookSecretConfigured: boolean = $state(false)
	let dodoWebhookSecretAction: SecretAction = $state('keep')
	let dodoWebhookSecretValue: string = $state('')
	let dodoWebhookUrl: string = $state('')
	let creemTestMode: boolean = $state(false)
	let creemApiKeyConfigured: boolean = $state(false)
	let creemApiKeyAction: SecretAction = $state('keep')
	let creemApiKeyValue: string = $state('')
	let creemWebhookSecretConfigured: boolean = $state(false)
	let creemWebhookSecretAction: SecretAction = $state('keep')
	let creemWebhookSecretValue: string = $state('')
	let creemWebhookUrl: string = $state('')
	let products: PaymentProduct[] = $state([])
	let version: number = $state(1)
	let loaded: boolean = $state(false)
	let saving: boolean = $state(false)
	let deleting: boolean = $state(false)
	let error: string = $state('')
	let errors: Record<string, string> = $state({})
	let savedSnapshot: string = $state('')
	let dirty: boolean = $state(false)
	let productDialogOpen: boolean = $state(false)
	let selectedProduct: PaymentProduct | null = $state(null)
	let deleteTarget: PaymentProduct | null = $state(null)

	function snapshot(): string {
		return JSON.stringify({ enabled, defaultProvider, countryOverrides, dodoTestMode, dodoApiKeyAction, dodoApiKeyValue, dodoWebhookSecretAction, dodoWebhookSecretValue, creemTestMode, creemApiKeyAction, creemApiKeyValue, creemWebhookSecretAction, creemWebhookSecretValue } satisfies SavedPaymentForm)
	}

	function applyConfig(config: PaymentConfig): void {
		enabled = config.enabled
		defaultProvider = config.default_provider ?? ''
		countryOverrides = config.country_provider_overrides.map((item: CountryOverride): string => `${item.country}:${item.provider}`).join('\n')
		dodoTestMode = config.dodo.test_mode
		dodoApiKeyConfigured = config.dodo.api_key_configured
		dodoApiKeyAction = 'keep'
		dodoApiKeyValue = ''
		dodoWebhookSecretConfigured = config.dodo.webhook_secret_configured
		dodoWebhookSecretAction = 'keep'
		dodoWebhookSecretValue = ''
		dodoWebhookUrl = config.dodo.webhook_url
		creemTestMode = config.creem.test_mode
		creemApiKeyConfigured = config.creem.api_key_configured
		creemApiKeyAction = 'keep'
		creemApiKeyValue = ''
		creemWebhookSecretConfigured = config.creem.webhook_secret_configured
		creemWebhookSecretAction = 'keep'
		creemWebhookSecretValue = ''
		creemWebhookUrl = config.creem.webhook_url
		products = config.products
		version = config.version
		errors = {}
		error = ''
		savedSnapshot = snapshot()
	}

	function parseCountryOverrides(): CountryOverride[] | null {
		const result: CountryOverride[] = []
		const lines: string[] = countryOverrides.split('\n').map((line: string): string => line.trim()).filter((line: string): boolean => line !== '')
		for (const line of lines) {
			const [country = '', provider = ''] = line.split(':')
			if (!/^[A-Za-z]{2}$/.test(country) || (provider !== 'dodo' && provider !== 'creem')) return null
			result.push({ country: country.toUpperCase(), provider })
		}
		return result
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
		const overrides: CountryOverride[] | null = parseCountryOverrides()
		if (enabled && defaultProvider === '') errors['defaultProvider'] = $_('admin.configuration.payment.errors.defaultProvider')
		if (overrides === null) errors['countryOverrides'] = $_('admin.configuration.payment.errors.countryOverrides')
		const activeProviders: Set<PaymentProviderName> = new Set()
		if (defaultProvider !== '') activeProviders.add(defaultProvider)
		for (const override of overrides ?? []) activeProviders.add(override.provider)
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

	async function loadConfig(): Promise<void> {
		loaded = false
		try {
			applyConfig(await client.api.getPaymentConfig())
			loaded = true
		} catch (loadError) {
			error = loadError instanceof ApiClientError ? loadError.body.message : $_('admin.configuration.loadError')
		}
	}

	async function saveConfig(): Promise<void> {
		const overrides: CountryOverride[] | null = validate()
		if (overrides === null) return
		saving = true
		error = ''
		try {
			applyConfig(await client.api.updatePaymentConfig({
				enabled,
				default_provider: defaultProvider === '' ? null : defaultProvider,
				country_provider_overrides: overrides,
				dodo_test_mode: dodoTestMode,
				dodo_api_key: buildSecretMutation(dodoApiKeyAction, dodoApiKeyValue),
				dodo_webhook_secret: buildSecretMutation(dodoWebhookSecretAction, dodoWebhookSecretValue),
				creem_test_mode: creemTestMode,
				creem_api_key: buildSecretMutation(creemApiKeyAction, creemApiKeyValue),
				creem_webhook_secret: buildSecretMutation(creemWebhookSecretAction, creemWebhookSecretValue),
				expected_version: version
			}))
		} catch (saveError) {
			error = saveError instanceof ApiClientError ? saveError.body.message : $_('admin.configuration.saveError')
		} finally {
			saving = false
		}
	}

	function discardChanges(): void {
		const value: SavedPaymentForm = JSON.parse(savedSnapshot) as SavedPaymentForm
		enabled = value.enabled
		defaultProvider = value.defaultProvider
		countryOverrides = value.countryOverrides
		dodoTestMode = value.dodoTestMode
		dodoApiKeyAction = value.dodoApiKeyAction
		dodoApiKeyValue = value.dodoApiKeyValue
		dodoWebhookSecretAction = value.dodoWebhookSecretAction
		dodoWebhookSecretValue = value.dodoWebhookSecretValue
		creemTestMode = value.creemTestMode
		creemApiKeyAction = value.creemApiKeyAction
		creemApiKeyValue = value.creemApiKeyValue
		creemWebhookSecretAction = value.creemWebhookSecretAction
		creemWebhookSecretValue = value.creemWebhookSecretValue
		errors = {}
		error = ''
	}

	function openCreateProduct(): void {
		selectedProduct = null
		productDialogOpen = true
	}

	function openEditProduct(product: PaymentProduct): void {
		selectedProduct = product
		productDialogOpen = true
	}

	function handleProductSaved(product: PaymentProduct): void {
		products = replaceConfigurationEntity(products, product, (item: PaymentProduct): string => item.product_id)
	}

	async function deleteProduct(): Promise<void> {
		if (deleteTarget === null) return
		deleting = true
		error = ''
		try {
			await client.api.deletePaymentProduct({ product_id: deleteTarget.product_id, expected_version: deleteTarget.version })
			products = removeConfigurationEntity(products, deleteTarget.product_id, (item: PaymentProduct): string => item.product_id)
			deleteTarget = null
		} catch (deleteError) {
			if (deleteError instanceof ApiClientError && deleteError.body.code === 'CONFIG_CONFLICT') {
				error = $_('admin.configuration.entity.conflict')
			} else {
				error = deleteError instanceof ApiClientError ? deleteError.body.message : $_('admin.configuration.entity.deleteError')
			}
		} finally {
			deleting = false
		}
	}

	$effect((): void => { dirty = loaded && snapshot() !== savedSnapshot; dispatchConfigurationDirty(dirty) })
	onMount((): void => { void loadConfig() })
	onDestroy((): void => dispatchConfigurationDirty(false))
</script>

{#if !loaded}
	{#if error === ''}<div class="space-y-4 py-8"><Skeleton class="h-96 w-full" /></div>{:else}<ConfigurationLoadError {error} onRetry={loadConfig} />{/if}
{:else}
	{#if error !== ''}<Alert.Root variant="destructive"><Alert.Description>{error}</Alert.Description><Alert.Action><Button variant="ghost" size="sm" onclick={loadConfig}>{$_('admin.configuration.entity.refresh')}</Button></Alert.Action></Alert.Root>{/if}
	<form onsubmit={(event: SubmitEvent): void => { event.preventDefault(); void saveConfig() }}>
		<ConfigurationSection title={$_('admin.configuration.payment.availability')}>
			<Field.Field orientation="horizontal"><Field.Label for="payment-enabled">{$_('admin.configuration.enabled')}</Field.Label><Switch id="payment-enabled" bind:checked={enabled} /></Field.Field>
			{#if enabled}
				<Field.Field data-invalid={errors['defaultProvider'] !== undefined}>
					<Field.Label for="payment-default-provider">{$_('admin.configuration.payment.defaultProvider')}</Field.Label>
					<Select.Root type="single" bind:value={defaultProvider}><Select.Trigger id="payment-default-provider" class="w-full" aria-invalid={errors['defaultProvider'] !== undefined}>{defaultProvider === '' ? $_('admin.configuration.select') : defaultProvider}</Select.Trigger><Select.Content><Select.Item value="dodo">Dodo Payments</Select.Item><Select.Item value="creem">Creem</Select.Item></Select.Content></Select.Root>
					<Field.Error>{errors['defaultProvider'] ?? ''}</Field.Error>
				</Field.Field>
				<Field.Field data-invalid={errors['countryOverrides'] !== undefined}><Field.Label for="payment-country-overrides">{$_('admin.configuration.payment.countryOverrides')}</Field.Label><Textarea id="payment-country-overrides" bind:value={countryOverrides} placeholder="US:dodo&#10;DE:creem" aria-invalid={errors['countryOverrides'] !== undefined} /><Field.Description>{$_('admin.configuration.payment.countryOverridesDescription')}</Field.Description><Field.Error>{errors['countryOverrides'] ?? ''}</Field.Error></Field.Field>
			{/if}
		</ConfigurationSection>
		{#if enabled}
			<ConfigurationSection title="Dodo Payments">
				<Field.Field orientation="horizontal"><Field.Label for="payment-dodo-test">{$_('admin.configuration.payment.testMode')}</Field.Label><Switch id="payment-dodo-test" bind:checked={dodoTestMode} /></Field.Field>
				<SecretField id="payment-dodo-api-key" label={$_('admin.configuration.payment.apiKey')} configured={dodoApiKeyConfigured} bind:action={dodoApiKeyAction} bind:value={dodoApiKeyValue} error={errors['dodoApiKey'] ?? ''} />
				<SecretField id="payment-dodo-webhook-secret" label={$_('admin.configuration.payment.webhookSecret')} configured={dodoWebhookSecretConfigured} bind:action={dodoWebhookSecretAction} bind:value={dodoWebhookSecretValue} error={errors['dodoWebhookSecret'] ?? ''} />
				<Field.Field><Field.Label for="payment-dodo-webhook-url">{$_('admin.configuration.payment.webhookUrl')}</Field.Label><Input id="payment-dodo-webhook-url" value={dodoWebhookUrl} readonly /></Field.Field>
			</ConfigurationSection>
			<ConfigurationSection title="Creem">
				<Field.Field orientation="horizontal"><Field.Label for="payment-creem-test">{$_('admin.configuration.payment.testMode')}</Field.Label><Switch id="payment-creem-test" bind:checked={creemTestMode} /></Field.Field>
				<SecretField id="payment-creem-api-key" label={$_('admin.configuration.payment.apiKey')} configured={creemApiKeyConfigured} bind:action={creemApiKeyAction} bind:value={creemApiKeyValue} error={errors['creemApiKey'] ?? ''} />
				<SecretField id="payment-creem-webhook-secret" label={$_('admin.configuration.payment.webhookSecret')} configured={creemWebhookSecretConfigured} bind:action={creemWebhookSecretAction} bind:value={creemWebhookSecretValue} error={errors['creemWebhookSecret'] ?? ''} />
				<Field.Field><Field.Label for="payment-creem-webhook-url">{$_('admin.configuration.payment.webhookUrl')}</Field.Label><Input id="payment-creem-webhook-url" value={creemWebhookUrl} readonly /></Field.Field>
			</ConfigurationSection>
		{/if}
		<ConfigurationActions {dirty} {saving} onSave={saveConfig} onDiscard={discardChanges} />
	</form>

	<section class="space-y-4 border-t pt-6">
		<div class="flex items-center justify-between gap-4"><h2 class="text-sm font-semibold">{$_('admin.configuration.payment.products.title')}</h2><Button size="sm" onclick={openCreateProduct}><PlusIcon />{$_('admin.configuration.payment.products.create')}</Button></div>
		{#if products.length === 0}
			<Empty.Root class="min-h-56 border"><Empty.Media variant="icon"><PackageIcon /></Empty.Media><Empty.Header><Empty.Title>{$_('admin.configuration.payment.products.empty')}</Empty.Title><Empty.Description>{$_('admin.configuration.payment.products.emptyDescription')}</Empty.Description></Empty.Header><Empty.Content><Button size="sm" onclick={openCreateProduct}><PlusIcon />{$_('admin.configuration.payment.products.create')}</Button></Empty.Content></Empty.Root>
		{:else}
			<div class="overflow-x-auto border"><Table.Root class="min-w-[760px]"><Table.Header><Table.Row><Table.Head>{$_('admin.configuration.payment.products.id')}</Table.Head><Table.Head>{$_('admin.configuration.payment.products.type')}</Table.Head><Table.Head>{$_('admin.configuration.payment.products.credits')}</Table.Head><Table.Head>{$_('admin.configuration.payment.products.providers')}</Table.Head><Table.Head class="text-right">{$_('admin.configuration.entity.actions')}</Table.Head></Table.Row></Table.Header><Table.Body>{#each products as product (product.product_id)}<Table.Row><Table.Cell class="font-mono text-xs">{product.product_id}</Table.Cell><Table.Cell><Badge variant="secondary">{$_(`admin.configuration.payment.products.types.${product.type}`)}</Badge></Table.Cell><Table.Cell>{product.type === 'one_time' ? product.credits_amount : product.period_credits_amount}</Table.Cell><Table.Cell>{[product.dodo_product_id === null ? '' : 'Dodo', product.creem_product_id === null ? '' : 'Creem'].filter(Boolean).join(', ')}</Table.Cell><Table.Cell><div class="flex justify-end gap-1"><Button size="icon-sm" variant="ghost" onclick={() => openEditProduct(product)} aria-label={$_('admin.configuration.entity.edit')} title={$_('admin.configuration.entity.edit')}><PencilIcon /></Button><Button size="icon-sm" variant="ghost" onclick={() => (deleteTarget = product)} aria-label={$_('admin.configuration.entity.delete')} title={$_('admin.configuration.entity.delete')}><TrashIcon /></Button></div></Table.Cell></Table.Row>{/each}</Table.Body></Table.Root></div>
		{/if}
	</section>

	<PaymentProductDialog bind:open={productDialogOpen} product={selectedProduct} onSaved={handleProductSaved} onRefresh={loadConfig} />
	<AlertDialog.Root open={deleteTarget !== null} onOpenChange={(open: boolean): void => { if (!open && !deleting) deleteTarget = null }}><AlertDialog.Content><AlertDialog.Header><AlertDialog.Title>{$_('admin.configuration.payment.products.deleteTitle')}</AlertDialog.Title><AlertDialog.Description>{$_('admin.configuration.payment.products.deleteDescription', { values: { id: deleteTarget?.product_id ?? '' } })}</AlertDialog.Description></AlertDialog.Header><AlertDialog.Footer><AlertDialog.Cancel disabled={deleting}>{$_('admin.configuration.entity.cancel')}</AlertDialog.Cancel><AlertDialog.Action variant="destructive" disabled={deleting} onclick={deleteProduct}>{deleting ? $_('admin.configuration.entity.deleting') : $_('admin.configuration.entity.delete')}</AlertDialog.Action></AlertDialog.Footer></AlertDialog.Content></AlertDialog.Root>
{/if}
