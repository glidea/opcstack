<script lang="ts">
	import { onDestroy, onMount } from 'svelte'
	import type { AIConfig, AIProvider } from '$apiContract/configuration'
	import { ApiClientError, client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as AlertDialog from '$frontend/ui/alert-dialog'
	import { Badge } from '$frontend/ui/badge'
	import { Button } from '$frontend/ui/button'
	import * as Empty from '$frontend/ui/empty'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import { Skeleton } from '$frontend/ui/skeleton'
	import * as Table from '$frontend/ui/table'
	import BotIcon from '@lucide/svelte/icons/bot'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import TrashIcon from '@lucide/svelte/icons/trash-2'
	import { toast } from 'svelte-sonner'
	import AIProviderDialog from './AIProviderDialog.svelte'
	import ConfigurationActions from './ConfigurationActions.svelte'
	import ConfigurationLoadError from './ConfigurationLoadError.svelte'
	import ConfigurationSection from './ConfigurationSection.svelte'
	import ConfigurationSaveError from './ConfigurationSaveError.svelte'
	import { removeConfigurationEntity, replaceConfigurationEntity } from './configuration-collections'
	import { dispatchConfigurationEditorState, focusFirstConfigurationError, isConfigurationConflict } from './configuration-page'

	type SavedAIForm = {
		routingErrorWeight: string
		routingLatencyWeight: string
		routingPriceWeight: string
		taskRetentionDays: string
	}

	let routingErrorWeight: string = $state('')
	let routingLatencyWeight: string = $state('')
	let routingPriceWeight: string = $state('')
	let taskRetentionDays: string = $state('')
	let providers: AIProvider[] = $state([])
	let version: number = $state(1)
	let loaded: boolean = $state(false)
	let saving: boolean = $state(false)
	let deleting: boolean = $state(false)
	let error: string = $state('')
	let conflict: boolean = $state(false)
	let errors: Record<string, string> = $state({})
	let savedSnapshot: string = $state('')
	let dirty: boolean = $state(false)
	let providerDialogOpen: boolean = $state(false)
	let selectedProvider: AIProvider | null = $state(null)
	let deleteTarget: AIProvider | null = $state(null)

	function snapshot(): string {
		return JSON.stringify({
			routingErrorWeight,
			routingLatencyWeight,
			routingPriceWeight,
			taskRetentionDays
		} satisfies SavedAIForm)
	}

	function applyConfig(config: AIConfig): void {
		routingErrorWeight = String(config.routing_error_weight)
		routingLatencyWeight = String(config.routing_latency_weight)
		routingPriceWeight = String(config.routing_price_weight)
		taskRetentionDays = String(config.task_retention_days)
		providers = config.providers
		version = config.version
		errors = {}
		error = ''
		conflict = false
		savedSnapshot = snapshot()
	}

	function validate(): boolean {
		errors = {}
		const weights: number[] = [
			Number(routingErrorWeight),
			Number(routingLatencyWeight),
			Number(routingPriceWeight)
		]
		const totalWeight: number = weights.reduce(
			(sum: number, weight: number): number => sum + weight,
			0
		)
		if (weights.some((weight: number): boolean => !Number.isFinite(weight) || weight < 0) || totalWeight <= 0) {
			errors['routing'] = $_('admin.configuration.ai.errors.routing')
		}
		if (!Number.isInteger(Number(taskRetentionDays)) || Number(taskRetentionDays) <= 0) {
			errors['retention'] = $_('admin.configuration.ai.errors.retention')
		}
		return Object.keys(errors).length === 0
	}

	async function loadConfig(): Promise<void> {
		loaded = false
		try {
			const config: AIConfig = await client.api.getAIConfig()
			applyConfig(config)
			loaded = true
		} catch (loadError) {
			error = loadError instanceof ApiClientError
				? loadError.body.message
				: $_('admin.configuration.loadError')
		}
	}

	async function saveConfig(): Promise<boolean> {
		if (!validate()) {
			focusFirstConfigurationError()
			return false
		}
		saving = true
		error = ''
		try {
			const config: AIConfig = await client.api.updateAIConfig({
				routing_error_weight: Number(routingErrorWeight),
				routing_latency_weight: Number(routingLatencyWeight),
				routing_price_weight: Number(routingPriceWeight),
				task_retention_days: Number(taskRetentionDays),
				expected_version: version
			})
			applyConfig(config)
			toast.success($_('admin.configuration.saved'))
			return true
		} catch (saveError) {
			conflict = isConfigurationConflict(saveError)
			error = saveError instanceof ApiClientError
				? saveError.body.message
				: $_('admin.configuration.saveError')
			return false
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
		errors = {}
		error = ''
	}

	function openCreateProvider(): void {
		selectedProvider = null
		providerDialogOpen = true
	}

	function openEditProvider(provider: AIProvider): void {
		selectedProvider = provider
		providerDialogOpen = true
	}

	function handleProviderSaved(provider: AIProvider): void {
		providers = replaceConfigurationEntity(
			providers,
			provider,
			(item: AIProvider): string => item.id
		)
	}

	async function deleteProvider(): Promise<void> {
		if (deleteTarget === null) {
			return
		}
		deleting = true
		error = ''
		try {
			await client.api.deleteAIProvider({
				id: deleteTarget.id,
				expected_version: deleteTarget.version
			})
			providers = removeConfigurationEntity(
				providers,
				deleteTarget.id,
				(item: AIProvider): string => item.id
			)
			deleteTarget = null
		} catch (deleteError) {
			conflict = isConfigurationConflict(deleteError)
			error = deleteError instanceof ApiClientError && deleteError.body.code === 'CONFIG_CONFLICT'
				? $_('admin.configuration.entity.conflict')
				: deleteError instanceof ApiClientError
					? deleteError.body.message
					: $_('admin.configuration.entity.deleteError')
		} finally {
			deleting = false
		}
	}

	$effect((): void => {
		dirty = loaded && snapshot() !== savedSnapshot
		dispatchConfigurationEditorState(dirty, saveConfig)
	})
	onMount((): void => { void loadConfig() })
	onDestroy((): void => dispatchConfigurationEditorState(false, saveConfig))
</script>

{#if !loaded}
	{#if error === ''}
		<div class="space-y-4 py-8"><Skeleton class="h-96 w-full" /></div>
	{:else}
		<ConfigurationLoadError {error} onRetry={loadConfig} />
	{/if}
{:else}
	{#if error !== ''}<ConfigurationSaveError {error} {conflict} onRefresh={loadConfig} />{/if}
	<form onsubmit={(event: SubmitEvent): void => { event.preventDefault(); void saveConfig() }}>
		<ConfigurationSection title={$_('admin.configuration.ai.routing')}>
			<div class="grid gap-4 sm:grid-cols-3">
				<Field.Field data-invalid={errors['routing'] !== undefined}>
					<Field.Label for="ai-routing-error">{$_('admin.configuration.ai.errorWeight')}</Field.Label>
					<Input id="ai-routing-error" bind:value={routingErrorWeight} inputmode="decimal" autocomplete="off" aria-invalid={errors['routing'] !== undefined} />
				</Field.Field>
				<Field.Field data-invalid={errors['routing'] !== undefined}>
					<Field.Label for="ai-routing-latency">{$_('admin.configuration.ai.latencyWeight')}</Field.Label>
					<Input id="ai-routing-latency" bind:value={routingLatencyWeight} inputmode="decimal" autocomplete="off" aria-invalid={errors['routing'] !== undefined} />
				</Field.Field>
				<Field.Field data-invalid={errors['routing'] !== undefined}>
					<Field.Label for="ai-routing-price">{$_('admin.configuration.ai.priceWeight')}</Field.Label>
					<Input id="ai-routing-price" bind:value={routingPriceWeight} inputmode="decimal" autocomplete="off" aria-invalid={errors['routing'] !== undefined} />
					<Field.Error>{errors['routing'] ?? ''}</Field.Error>
				</Field.Field>
			</div>
			<Field.Field data-invalid={errors['retention'] !== undefined}>
				<Field.Label for="ai-task-retention">{$_('admin.configuration.ai.retention')}</Field.Label>
				<Input id="ai-task-retention" bind:value={taskRetentionDays} inputmode="numeric" autocomplete="off" aria-invalid={errors['retention'] !== undefined} />
				<Field.Error>{errors['retention'] ?? ''}</Field.Error>
			</Field.Field>
		</ConfigurationSection>
		<ConfigurationActions {dirty} {saving} onSave={saveConfig} onDiscard={discardChanges} />
	</form>

	<section class="space-y-4 border-t pt-6">
		<div class="flex items-center justify-between gap-4">
			<h2 class="text-sm font-semibold">{$_('admin.configuration.ai.providers.title')}</h2>
			<Button size="sm" onclick={openCreateProvider}><PlusIcon />{$_('admin.configuration.ai.providers.create')}</Button>
		</div>
		{#if providers.length === 0}
			<Empty.Root class="min-h-56 border">
				<Empty.Media variant="icon"><BotIcon /></Empty.Media>
				<Empty.Header>
					<Empty.Title>{$_('admin.configuration.ai.providers.empty')}</Empty.Title>
					<Empty.Description>{$_('admin.configuration.ai.providers.emptyDescription')}</Empty.Description>
				</Empty.Header>
				<Empty.Content><Button size="sm" onclick={openCreateProvider}><PlusIcon />{$_('admin.configuration.ai.providers.create')}</Button></Empty.Content>
			</Empty.Root>
		{:else}
			<div class="overflow-x-auto border">
				<Table.Root class="min-w-[820px]">
					<Table.Header><Table.Row>
						<Table.Head>{$_('admin.configuration.ai.providers.name')}</Table.Head>
						<Table.Head>{$_('admin.configuration.ai.providers.type')}</Table.Head>
						<Table.Head>{$_('admin.configuration.ai.providers.models')}</Table.Head>
						<Table.Head>{$_('admin.configuration.payment.apiKey')}</Table.Head>
						<Table.Head>{$_('admin.configuration.enabled')}</Table.Head>
						<Table.Head class="text-right">{$_('admin.configuration.entity.actions')}</Table.Head>
					</Table.Row></Table.Header>
					<Table.Body>
						{#each providers as provider (provider.id)}
							<Table.Row>
								<Table.Cell><div>{provider.name}</div><div class="font-mono text-xs text-muted-foreground">{provider.id}</div></Table.Cell>
								<Table.Cell>{provider.type}</Table.Cell>
								<Table.Cell class="max-w-64 truncate">{provider.models.join(', ')}</Table.Cell>
								<Table.Cell><Badge variant="secondary">{provider.api_key_configured ? $_('admin.configuration.secret.configured') : $_('admin.configuration.secret.notConfigured')}</Badge></Table.Cell>
								<Table.Cell><Badge variant={provider.enabled ? 'default' : 'secondary'}>{provider.enabled ? $_('admin.configuration.enabled') : $_('admin.configuration.ai.providers.disabled')}</Badge></Table.Cell>
								<Table.Cell><div class="flex justify-end gap-1">
									<Button size="icon-sm" variant="ghost" onclick={() => openEditProvider(provider)} aria-label={$_('admin.configuration.entity.edit')} title={$_('admin.configuration.entity.edit')}><PencilIcon /></Button>
									<Button size="icon-sm" variant="ghost" onclick={() => (deleteTarget = provider)} aria-label={$_('admin.configuration.entity.delete')} title={$_('admin.configuration.entity.delete')}><TrashIcon /></Button>
								</div></Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
		{/if}
	</section>

	<AIProviderDialog bind:open={providerDialogOpen} provider={selectedProvider} onSaved={handleProviderSaved} onRefresh={loadConfig} />
	<AlertDialog.Root open={deleteTarget !== null} onOpenChange={(open: boolean): void => { if (!open && !deleting) deleteTarget = null }}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>{$_('admin.configuration.ai.providers.deleteTitle')}</AlertDialog.Title>
				<AlertDialog.Description>{$_('admin.configuration.ai.providers.deleteDescription', { values: { id: deleteTarget?.id ?? '' } })}</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel disabled={deleting}>{$_('admin.configuration.entity.cancel')}</AlertDialog.Cancel>
				<AlertDialog.Action variant="destructive" disabled={deleting} onclick={deleteProvider}>{deleting ? $_('admin.configuration.entity.deleting') : $_('admin.configuration.entity.delete')}</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
{/if}
