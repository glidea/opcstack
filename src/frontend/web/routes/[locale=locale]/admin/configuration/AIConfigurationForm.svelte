<script lang="ts">
	import { onDestroy, onMount } from 'svelte'
	import type { AIChannel, AIConfig, AIProviderConfig, AIProviderId } from '$apiContract/configuration'
	import { ApiClientError, client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import * as AlertDialog from '$frontend/ui/alert-dialog'
	import { Badge } from '$frontend/ui/badge'
	import { Button } from '$frontend/ui/button'
	import * as Empty from '$frontend/ui/empty'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import { Skeleton } from '$frontend/ui/skeleton'
	import { Switch } from '$frontend/ui/switch'
	import * as Table from '$frontend/ui/table'
	import BotIcon from '@lucide/svelte/icons/bot'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import TrashIcon from '@lucide/svelte/icons/trash-2'
	import AIChannelDialog from './AIChannelDialog.svelte'
	import ConfigurationActions from './ConfigurationActions.svelte'
	import ConfigurationLoadError from './ConfigurationLoadError.svelte'
	import ConfigurationSection from './ConfigurationSection.svelte'
	import SecretField from './SecretField.svelte'
	import { removeConfigurationEntity, replaceConfigurationEntity } from './configuration-collections'
	import { buildSecretMutation, dispatchConfigurationDirty, type SecretAction } from './configuration-page'

	type AIProviderForm = {
		id: AIProviderId
		area: AIProviderConfig['area']
		provider: string
		enabled: boolean
		baseUrl: string
		defaultModel: string
		apiKeyConfigured: boolean
		apiKeyAction: SecretAction
		apiKeyValue: string
	}
	type SavedAIForm = {
		routingErrorWeight: string
		routingLatencyWeight: string
		routingPriceWeight: string
		taskRetentionDays: string
		providers: AIProviderForm[]
	}

	let routingErrorWeight: string = $state('')
	let routingLatencyWeight: string = $state('')
	let routingPriceWeight: string = $state('')
	let taskRetentionDays: string = $state('')
	let providers: AIProviderForm[] = $state([])
	let channels: AIChannel[] = $state([])
	let version: number = $state(1)
	let loaded: boolean = $state(false)
	let saving: boolean = $state(false)
	let deleting: boolean = $state(false)
	let error: string = $state('')
	let errors: Record<string, string> = $state({})
	let savedSnapshot: string = $state('')
	let dirty: boolean = $state(false)
	let channelDialogOpen: boolean = $state(false)
	let selectedChannel: AIChannel | null = $state(null)
	let deleteTarget: AIChannel | null = $state(null)

	function snapshot(): string {
		return JSON.stringify({ routingErrorWeight, routingLatencyWeight, routingPriceWeight, taskRetentionDays, providers } satisfies SavedAIForm)
	}

	function applyConfig(config: AIConfig): void {
		routingErrorWeight = String(config.routing_error_weight)
		routingLatencyWeight = String(config.routing_latency_weight)
		routingPriceWeight = String(config.routing_price_weight)
		taskRetentionDays = String(config.task_retention_days)
		providers = config.providers.map((provider: AIProviderConfig): AIProviderForm => ({
			id: provider.id,
			area: provider.area,
			provider: provider.provider,
			enabled: provider.enabled,
			baseUrl: provider.base_url ?? '',
			defaultModel: provider.default_model ?? '',
			apiKeyConfigured: provider.api_key_configured,
			apiKeyAction: 'keep',
			apiKeyValue: ''
		}))
		channels = config.channels
		version = config.version
		errors = {}
		error = ''
		savedSnapshot = snapshot()
	}

	function validate(): boolean {
		errors = {}
		const weights: number[] = [Number(routingErrorWeight), Number(routingLatencyWeight), Number(routingPriceWeight)]
		if (weights.some((weight: number): boolean => !Number.isFinite(weight) || weight < 0) || weights.reduce((sum: number, weight: number): number => sum + weight, 0) <= 0) {
			errors['routing'] = $_('admin.configuration.ai.errors.routing')
		}
		if (!Number.isInteger(Number(taskRetentionDays)) || Number(taskRetentionDays) <= 0) errors['retention'] = $_('admin.configuration.ai.errors.retention')
		for (const provider of providers) {
			if (!provider.enabled) continue
			if (provider.baseUrl.trim() === '') errors[`${provider.id}.baseUrl`] = $_('admin.configuration.ai.errors.baseUrl')
			if (provider.defaultModel.trim() === '') errors[`${provider.id}.defaultModel`] = $_('admin.configuration.ai.errors.defaultModel')
			const hasApiKey: boolean = provider.apiKeyAction === 'keep' ? provider.apiKeyConfigured : provider.apiKeyAction === 'replace' && provider.apiKeyValue.trim() !== ''
			if (!hasApiKey) errors[`${provider.id}.apiKey`] = $_('admin.configuration.ai.errors.apiKey')
		}
		return Object.keys(errors).length === 0
	}

	async function loadConfig(): Promise<void> {
		loaded = false
		try {
			applyConfig(await client.api.getAIConfig())
			loaded = true
		} catch (loadError) {
			error = loadError instanceof ApiClientError ? loadError.body.message : $_('admin.configuration.loadError')
		}
	}

	async function saveConfig(): Promise<void> {
		if (!validate()) return
		saving = true
		error = ''
		try {
			applyConfig(await client.api.updateAIConfig({
				routing_error_weight: Number(routingErrorWeight),
				routing_latency_weight: Number(routingLatencyWeight),
				routing_price_weight: Number(routingPriceWeight),
				task_retention_days: Number(taskRetentionDays),
				providers: providers.map((provider: AIProviderForm) => ({
					id: provider.id,
					enabled: provider.enabled,
					base_url: provider.baseUrl.trim() === '' ? null : provider.baseUrl.trim(),
					default_model: provider.defaultModel.trim() === '' ? null : provider.defaultModel.trim(),
					api_key: buildSecretMutation(provider.apiKeyAction, provider.apiKeyValue)
				})),
				expected_version: version
			}))
		} catch (saveError) {
			error = saveError instanceof ApiClientError ? saveError.body.message : $_('admin.configuration.saveError')
		} finally {
			saving = false
		}
	}

	function discardChanges(): void {
		const value: SavedAIForm = JSON.parse(savedSnapshot) as SavedAIForm
		routingErrorWeight = value.routingErrorWeight
		routingLatencyWeight = value.routingLatencyWeight
		routingPriceWeight = value.routingPriceWeight
		taskRetentionDays = value.taskRetentionDays
		providers = value.providers
		errors = {}
		error = ''
	}

	function openCreateChannel(): void {
		selectedChannel = null
		channelDialogOpen = true
	}

	function openEditChannel(channel: AIChannel): void {
		selectedChannel = channel
		channelDialogOpen = true
	}

	function handleChannelSaved(channel: AIChannel): void {
		channels = replaceConfigurationEntity(channels, channel, (item: AIChannel): string => item.id)
	}

	async function deleteChannel(): Promise<void> {
		if (deleteTarget === null) return
		deleting = true
		error = ''
		try {
			await client.api.deleteAIChannel({ id: deleteTarget.id, expected_version: deleteTarget.version })
			channels = removeConfigurationEntity(channels, deleteTarget.id, (item: AIChannel): string => item.id)
			deleteTarget = null
		} catch (deleteError) {
			error = deleteError instanceof ApiClientError && deleteError.body.code === 'CONFIG_CONFLICT'
				? $_('admin.configuration.entity.conflict')
				: deleteError instanceof ApiClientError ? deleteError.body.message : $_('admin.configuration.entity.deleteError')
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
		<ConfigurationSection title={$_('admin.configuration.ai.routing')}>
			<div class="grid gap-4 sm:grid-cols-3">
				<Field.Field data-invalid={errors['routing'] !== undefined}><Field.Label for="ai-routing-error">{$_('admin.configuration.ai.errorWeight')}</Field.Label><Input id="ai-routing-error" bind:value={routingErrorWeight} inputmode="decimal" autocomplete="off" aria-invalid={errors['routing'] !== undefined} /></Field.Field>
				<Field.Field data-invalid={errors['routing'] !== undefined}><Field.Label for="ai-routing-latency">{$_('admin.configuration.ai.latencyWeight')}</Field.Label><Input id="ai-routing-latency" bind:value={routingLatencyWeight} inputmode="decimal" autocomplete="off" aria-invalid={errors['routing'] !== undefined} /></Field.Field>
				<Field.Field data-invalid={errors['routing'] !== undefined}><Field.Label for="ai-routing-price">{$_('admin.configuration.ai.priceWeight')}</Field.Label><Input id="ai-routing-price" bind:value={routingPriceWeight} inputmode="decimal" autocomplete="off" aria-invalid={errors['routing'] !== undefined} /><Field.Error>{errors['routing'] ?? ''}</Field.Error></Field.Field>
			</div>
			<Field.Field data-invalid={errors['retention'] !== undefined}><Field.Label for="ai-task-retention">{$_('admin.configuration.ai.retention')}</Field.Label><Input id="ai-task-retention" bind:value={taskRetentionDays} inputmode="numeric" autocomplete="off" aria-invalid={errors['retention'] !== undefined} /><Field.Error>{errors['retention'] ?? ''}</Field.Error></Field.Field>
		</ConfigurationSection>
		{#each providers as provider, index (provider.id)}
			<ConfigurationSection title={$_(`admin.configuration.ai.providers.names.${provider.id}`)} description={`${provider.area} / ${provider.provider}`}>
				<Field.Field orientation="horizontal"><Field.Label for={`ai-provider-${provider.id}-enabled`}>{$_('admin.configuration.enabled')}</Field.Label><Switch id={`ai-provider-${provider.id}-enabled`} bind:checked={provider.enabled} /></Field.Field>
				{#if provider.enabled}
					<Field.Field data-invalid={errors[`${provider.id}.baseUrl`] !== undefined}><Field.Label for={`ai-provider-${provider.id}-base-url`}>{$_('admin.configuration.ai.providers.baseUrl')}</Field.Label><Input id={`ai-provider-${provider.id}-base-url`} bind:value={provider.baseUrl} type="url" autocomplete="url" aria-invalid={errors[`${provider.id}.baseUrl`] !== undefined} /><Field.Error>{errors[`${provider.id}.baseUrl`] ?? ''}</Field.Error></Field.Field>
					<Field.Field data-invalid={errors[`${provider.id}.defaultModel`] !== undefined}><Field.Label for={`ai-provider-${provider.id}-model`}>{$_('admin.configuration.ai.providers.defaultModel')}</Field.Label><Input id={`ai-provider-${provider.id}-model`} bind:value={provider.defaultModel} autocomplete="off" aria-invalid={errors[`${provider.id}.defaultModel`] !== undefined} /><Field.Error>{errors[`${provider.id}.defaultModel`] ?? ''}</Field.Error></Field.Field>
					<SecretField id={`ai-provider-${provider.id}-api-key`} label={$_('admin.configuration.payment.apiKey')} configured={provider.apiKeyConfigured} bind:action={provider.apiKeyAction} bind:value={provider.apiKeyValue} error={errors[`${provider.id}.apiKey`] ?? ''} />
				{/if}
			</ConfigurationSection>
		{/each}
		<ConfigurationActions {dirty} {saving} onSave={saveConfig} onDiscard={discardChanges} />
	</form>

	<section class="space-y-4 border-t pt-6">
		<div class="flex items-center justify-between gap-4"><h2 class="text-sm font-semibold">{$_('admin.configuration.ai.channels.title')}</h2><Button size="sm" onclick={openCreateChannel}><PlusIcon />{$_('admin.configuration.ai.channels.create')}</Button></div>
		{#if channels.length === 0}
			<Empty.Root class="min-h-56 border"><Empty.Media variant="icon"><BotIcon /></Empty.Media><Empty.Header><Empty.Title>{$_('admin.configuration.ai.channels.empty')}</Empty.Title><Empty.Description>{$_('admin.configuration.ai.channels.emptyDescription')}</Empty.Description></Empty.Header><Empty.Content><Button size="sm" onclick={openCreateChannel}><PlusIcon />{$_('admin.configuration.ai.channels.create')}</Button></Empty.Content></Empty.Root>
		{:else}
			<div class="overflow-x-auto border"><Table.Root class="min-w-[820px]"><Table.Header><Table.Row><Table.Head>{$_('admin.configuration.ai.channels.name')}</Table.Head><Table.Head>{$_('admin.configuration.ai.channels.area')}</Table.Head><Table.Head>{$_('admin.configuration.ai.channels.models')}</Table.Head><Table.Head>{$_('admin.configuration.payment.apiKey')}</Table.Head><Table.Head>{$_('admin.configuration.enabled')}</Table.Head><Table.Head class="text-right">{$_('admin.configuration.entity.actions')}</Table.Head></Table.Row></Table.Header><Table.Body>{#each channels as channel (channel.id)}<Table.Row><Table.Cell><div>{channel.name}</div><div class="font-mono text-xs text-muted-foreground">{channel.id}</div></Table.Cell><Table.Cell>{channel.area} / {channel.provider}</Table.Cell><Table.Cell class="max-w-64 truncate">{channel.models.join(', ')}</Table.Cell><Table.Cell><Badge variant="secondary">{channel.api_key_configured ? $_('admin.configuration.secret.configured') : $_('admin.configuration.secret.notConfigured')}</Badge></Table.Cell><Table.Cell><Badge variant={channel.enabled ? 'default' : 'secondary'}>{channel.enabled ? $_('admin.configuration.enabled') : $_('admin.configuration.ai.channels.disabled')}</Badge></Table.Cell><Table.Cell><div class="flex justify-end gap-1"><Button size="icon-sm" variant="ghost" onclick={() => openEditChannel(channel)} aria-label={$_('admin.configuration.entity.edit')} title={$_('admin.configuration.entity.edit')}><PencilIcon /></Button><Button size="icon-sm" variant="ghost" onclick={() => (deleteTarget = channel)} aria-label={$_('admin.configuration.entity.delete')} title={$_('admin.configuration.entity.delete')}><TrashIcon /></Button></div></Table.Cell></Table.Row>{/each}</Table.Body></Table.Root></div>
		{/if}
	</section>

	<AIChannelDialog bind:open={channelDialogOpen} channel={selectedChannel} onSaved={handleChannelSaved} onRefresh={loadConfig} />
	<AlertDialog.Root open={deleteTarget !== null} onOpenChange={(open: boolean): void => { if (!open && !deleting) deleteTarget = null }}><AlertDialog.Content><AlertDialog.Header><AlertDialog.Title>{$_('admin.configuration.ai.channels.deleteTitle')}</AlertDialog.Title><AlertDialog.Description>{$_('admin.configuration.ai.channels.deleteDescription', { values: { id: deleteTarget?.id ?? '' } })}</AlertDialog.Description></AlertDialog.Header><AlertDialog.Footer><AlertDialog.Cancel disabled={deleting}>{$_('admin.configuration.entity.cancel')}</AlertDialog.Cancel><AlertDialog.Action variant="destructive" disabled={deleting} onclick={deleteChannel}>{deleting ? $_('admin.configuration.entity.deleting') : $_('admin.configuration.entity.delete')}</AlertDialog.Action></AlertDialog.Footer></AlertDialog.Content></AlertDialog.Root>
{/if}
