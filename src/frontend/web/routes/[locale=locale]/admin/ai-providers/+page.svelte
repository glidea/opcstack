<script lang="ts">
	import { onMount } from 'svelte'
	import type { AIConfig, AIProvider, AIProviderType } from '$apiContract/configuration'
	import { ApiClientError, client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import * as AlertDialog from '$frontend/ui/alert-dialog'
	import { Badge } from '$frontend/ui/badge'
	import { Button } from '$frontend/ui/button'
	import * as Empty from '$frontend/ui/empty'
	import { Skeleton } from '$frontend/ui/skeleton'
	import * as Table from '$frontend/ui/table'
	import * as ToggleGroup from '$frontend/ui/toggle-group'
	import BotIcon from '@lucide/svelte/icons/bot'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import Settings2Icon from '@lucide/svelte/icons/settings-2'
	import TrashIcon from '@lucide/svelte/icons/trash-2'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import AIProviderSheet from './AIProviderSheet.svelte'
	import { removeAIProvider, replaceAIProvider } from './ai-providers-page'

	type ProviderArea = 'all' | 'chat' | 'image' | 'tts' | 'realtime' | 'video'
	const providerAreas: ProviderArea[] = ['all', 'chat', 'image', 'tts', 'realtime', 'video']
	let { data }: { data: { locale: string } } = $props()
	let providers: AIProvider[] = $state([])
	let loaded: boolean = $state(false)
	let area: ProviderArea = $state('all')
	let error: string = $state('')
	let editorOpen: boolean = $state(false)
	let selectedProvider: AIProvider | null = $state(null)
	let deleteTarget: AIProvider | null = $state(null)
	let deleting: boolean = $state(false)
	const visibleProviders: AIProvider[] = $derived(providers.filter((provider: AIProvider): boolean => area === 'all' || provider.type.startsWith(`${area}_`)))

	onMount((): void => { void loadConfig() })

	async function loadConfig(): Promise<void> {
		error = ''
		try {
			const config: AIConfig = await client.api.getAIConfig()
			providers = config.providers
			loaded = true
		} catch (loadError) {
			error = loadError instanceof ApiClientError ? loadError.body.message : $_('admin.aiProviders.loadError')
		}
	}

	function openCreate(): void {
		selectedProvider = null
		editorOpen = true
	}

	function openEdit(provider: AIProvider): void {
		selectedProvider = provider
		editorOpen = true
	}

	function handleSaved(provider: AIProvider): void {
		providers = replaceAIProvider(providers, provider)
	}

	async function deleteProvider(): Promise<void> {
		if (deleteTarget === null) return
		deleting = true
		error = ''
		try {
			await client.api.deleteAIProvider({ id: deleteTarget.id, expected_version: deleteTarget.version })
			providers = removeAIProvider(providers, deleteTarget.id)
			deleteTarget = null
		} catch (deleteError) {
			error = deleteError instanceof ApiClientError ? deleteError.body.message : $_('admin.configuration.entity.deleteError')
		} finally {
			deleting = false
		}
	}

	function providerTypeLabel(type: AIProviderType): string {
		return $_(`admin.aiProviders.types.${type}`)
	}
</script>

<main class="admin-page">
	<header class="admin-page-header">
		<h1>{$_('admin.aiProviders.title')}</h1>
		<div class="admin-page-actions"><Button variant="outline" href={`/${data.locale}/admin/configuration/ai`}><Settings2Icon />{$_('admin.aiProviders.routingSettings')}</Button><Button onclick={openCreate}><PlusIcon />{$_('admin.aiProviders.create')}</Button></div>
	</header>

	{#if error !== ''}<Alert.Root variant="destructive"><TriangleAlertIcon /><Alert.Title>{$_('admin.aiProviders.loadError')}</Alert.Title><Alert.Description>{error}</Alert.Description><Alert.Action><Button variant="ghost" size="sm" onclick={loadConfig}>{$_('admin.aiProviders.retry')}</Button></Alert.Action></Alert.Root>{/if}
	{#if !loaded && error === ''}
		<Skeleton class="h-80 w-full" />
	{:else if loaded}
		<div class="admin-filter-bar flex items-center overflow-x-auto">
			<ToggleGroup.Root type="single" bind:value={area} variant="outline" spacing={0} aria-label={$_('admin.aiProviders.area')}>
				{#each providerAreas as option}<ToggleGroup.Item value={option}>{$_(`admin.aiProviders.areas.${option}`)}</ToggleGroup.Item>{/each}
			</ToggleGroup.Root>
		</div>
		{#if visibleProviders.length === 0}
			<Empty.Root class="min-h-72 border"><Empty.Media variant="icon"><BotIcon /></Empty.Media><Empty.Header><Empty.Title>{$_('admin.aiProviders.empty')}</Empty.Title><Empty.Description>{$_('admin.aiProviders.emptyDescription')}</Empty.Description></Empty.Header><Empty.Content><Button onclick={openCreate}><PlusIcon />{$_('admin.aiProviders.create')}</Button></Empty.Content></Empty.Root>
		{:else}
			<div class="admin-table-panel">
				<Table.Root class="min-w-[860px]"><Table.Header><Table.Row><Table.Head>{$_('admin.aiProviders.provider')}</Table.Head><Table.Head>{$_('admin.aiProviders.type')}</Table.Head><Table.Head>{$_('admin.aiProviders.models')}</Table.Head><Table.Head>{$_('admin.aiProviders.priceMultiplier')}</Table.Head><Table.Head>{$_('admin.configuration.payment.apiKey')}</Table.Head><Table.Head>{$_('admin.aiProviders.status')}</Table.Head><Table.Head class="text-right">{$_('admin.configuration.entity.actions')}</Table.Head></Table.Row></Table.Header><Table.Body>
					{#each visibleProviders as provider (provider.id)}
						<Table.Row><Table.Cell><div class="font-medium">{provider.name}</div><div class="font-mono text-xs text-muted-foreground">{provider.id}</div></Table.Cell><Table.Cell>{providerTypeLabel(provider.type)}</Table.Cell><Table.Cell class="max-w-72 truncate">{provider.models.join(', ')}</Table.Cell><Table.Cell>{provider.price_multiplier}</Table.Cell><Table.Cell><Badge variant="secondary">{$_('admin.configuration.secret.configured')}</Badge></Table.Cell><Table.Cell><Badge variant={provider.enabled ? 'default' : 'secondary'}>{provider.enabled ? $_('admin.aiProviders.enabled') : $_('admin.aiProviders.disabled')}</Badge></Table.Cell><Table.Cell><div class="flex justify-end gap-1"><Button size="icon-sm" variant="ghost" onclick={() => openEdit(provider)} aria-label={$_('admin.configuration.entity.edit')} title={$_('admin.configuration.entity.edit')}><PencilIcon /></Button><Button size="icon-sm" variant="ghost" onclick={() => (deleteTarget = provider)} aria-label={$_('admin.configuration.entity.delete')} title={$_('admin.configuration.entity.delete')}><TrashIcon /></Button></div></Table.Cell></Table.Row>
					{/each}
				</Table.Body></Table.Root>
			</div>
		{/if}
	{/if}
</main>

<AIProviderSheet bind:open={editorOpen} provider={selectedProvider} onSaved={handleSaved} onRefresh={loadConfig} />
<AlertDialog.Root open={deleteTarget !== null} onOpenChange={(open: boolean): void => { if (!open && !deleting) deleteTarget = null }}><AlertDialog.Content><AlertDialog.Header><AlertDialog.Title>{$_('admin.aiProviders.deleteTitle')}</AlertDialog.Title><AlertDialog.Description>{$_('admin.aiProviders.deleteDescription', { values: { id: deleteTarget?.id ?? '' } })}</AlertDialog.Description></AlertDialog.Header><AlertDialog.Footer><AlertDialog.Cancel disabled={deleting}>{$_('admin.configuration.entity.cancel')}</AlertDialog.Cancel><AlertDialog.Action variant="destructive" disabled={deleting} onclick={deleteProvider}>{deleting ? $_('admin.configuration.entity.deleting') : $_('admin.configuration.entity.delete')}</AlertDialog.Action></AlertDialog.Footer></AlertDialog.Content></AlertDialog.Root>
