<script lang="ts">
	import { onDestroy, onMount } from 'svelte'
	import type { AIConfig } from '$apiContract/configuration'
	import { ApiClientError, client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import { Skeleton } from '$frontend/ui/skeleton'
	import * as ToggleGroup from '$frontend/ui/toggle-group'
	import { toast } from 'svelte-sonner'
	import ConfigurationActions from './ConfigurationActions.svelte'
	import ConfigurationLoadError from './ConfigurationLoadError.svelte'
	import ConfigurationSection from './ConfigurationSection.svelte'
	import ConfigurationSaveError from './ConfigurationSaveError.svelte'
	import { dispatchConfigurationEditorState, focusFirstConfigurationError, getAIRoutingPreset, getAIRoutingWeights, isConfigurationConflict, resolveConfigurationSaveError, type AIRoutingPreset, type AIRoutingWeights } from './configuration-page'

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
	let routingPreset: AIRoutingPreset = $state('balanced')
	let version: number = $state(1)
	let loaded: boolean = $state(false)
	let saving: boolean = $state(false)
	let error: string = $state('')
	let conflict: boolean = $state(false)
	let errors: Record<string, string> = $state({})
	let savedSnapshot: string = $state('')
	let dirty: boolean = $state(false)

	function snapshot(): string {
		return JSON.stringify({ routingErrorWeight, routingLatencyWeight, routingPriceWeight, taskRetentionDays } satisfies SavedAIForm)
	}

	function applyConfig(config: AIConfig): void {
		routingErrorWeight = String(config.routing_error_weight)
		routingLatencyWeight = String(config.routing_latency_weight)
		routingPriceWeight = String(config.routing_price_weight)
		routingPreset = getAIRoutingPreset({ error: config.routing_error_weight, latency: config.routing_latency_weight, price: config.routing_price_weight })
		taskRetentionDays = String(config.task_retention_days)
		version = config.version
		errors = {}
		error = ''
		conflict = false
		savedSnapshot = snapshot()
	}

	function selectRoutingPreset(preset: AIRoutingPreset): void {
		routingPreset = preset
		const weights: AIRoutingWeights | null = getAIRoutingWeights(preset)
		if (weights === null) return
		routingErrorWeight = String(weights.error)
		routingLatencyWeight = String(weights.latency)
		routingPriceWeight = String(weights.price)
	}

	function validate(): boolean {
		errors = {}
		const weights: number[] = [Number(routingErrorWeight), Number(routingLatencyWeight), Number(routingPriceWeight)]
		const totalWeight: number = weights.reduce((sum: number, weight: number): number => sum + weight, 0)
		if (weights.some((weight: number): boolean => !Number.isFinite(weight) || weight < 0) || totalWeight <= 0) errors['routing'] = $_('admin.configuration.ai.errors.routing')
		if (!Number.isInteger(Number(taskRetentionDays)) || Number(taskRetentionDays) <= 0) errors['retention'] = $_('admin.configuration.ai.errors.retention')
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

	async function saveConfig(): Promise<boolean> {
		if (!validate()) { focusFirstConfigurationError(); return false }
		saving = true
		error = ''
		try {
			applyConfig(await client.api.updateAIConfig({
				routing_error_weight: Number(routingErrorWeight),
				routing_latency_weight: Number(routingLatencyWeight),
				routing_price_weight: Number(routingPriceWeight),
				task_retention_days: Number(taskRetentionDays),
				expected_version: version
			}))
			toast.success($_('admin.configuration.saved'))
			return true
		} catch (saveError) {
			conflict = isConfigurationConflict(saveError)
			error = resolveConfigurationSaveError(saveError, $_('admin.configuration.conflict'), $_('admin.configuration.saveError'))
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

	$effect((): void => { dirty = loaded && snapshot() !== savedSnapshot; dispatchConfigurationEditorState(dirty, saveConfig) })
	onMount((): void => { void loadConfig() })
	onDestroy((): void => dispatchConfigurationEditorState(false, saveConfig))
</script>

{#if !loaded}
	{#if error === ''}<div class="space-y-4 py-8"><Skeleton class="h-72 w-full" /></div>{:else}<ConfigurationLoadError {error} onRetry={loadConfig} />{/if}
{:else}
	{#if error !== ''}<ConfigurationSaveError {error} {conflict} onRefresh={loadConfig} />{/if}
	<form onsubmit={(event: SubmitEvent): void => { event.preventDefault(); void saveConfig() }}>
		<ConfigurationSection title={$_('admin.configuration.ai.routing')} description={$_('admin.configuration.ai.routingDescription')}>
			<Field.Field>
				<Field.Label>{$_('admin.configuration.ai.routingPreset')}</Field.Label>
				<ToggleGroup.Root type="single" value={routingPreset} variant="outline" class="grid w-full grid-cols-2 sm:grid-cols-5">
					{#each ['balanced', 'reliability', 'speed', 'cost', 'custom'] as preset}
						<ToggleGroup.Item id={`ai-routing-${preset}`} value={preset} class="min-w-0" onclick={() => selectRoutingPreset(preset as AIRoutingPreset)}>{$_(`admin.configuration.ai.presets.${preset}`)}</ToggleGroup.Item>
					{/each}
				</ToggleGroup.Root>
				<Field.Description>{$_(`admin.configuration.ai.presetDescriptions.${routingPreset}`)}</Field.Description>
			</Field.Field>
			{#if routingPreset === 'custom'}
			<Field.Field data-invalid={errors['routing'] !== undefined}>
				<Field.Label>{$_('admin.configuration.ai.routingWeights')}</Field.Label>
				<div class="grid max-w-lg gap-3 sm:grid-cols-3">
					<div class="space-y-1.5"><label class="text-xs text-muted-foreground" for="ai-routing-error">{$_('admin.configuration.ai.errorWeight')}</label><Input id="ai-routing-error" bind:value={routingErrorWeight} inputmode="decimal" autocomplete="off" aria-invalid={errors['routing'] !== undefined} /></div>
					<div class="space-y-1.5"><label class="text-xs text-muted-foreground" for="ai-routing-latency">{$_('admin.configuration.ai.latencyWeight')}</label><Input id="ai-routing-latency" bind:value={routingLatencyWeight} inputmode="decimal" autocomplete="off" aria-invalid={errors['routing'] !== undefined} /></div>
					<div class="space-y-1.5"><label class="text-xs text-muted-foreground" for="ai-routing-price">{$_('admin.configuration.ai.priceWeight')}</label><Input id="ai-routing-price" bind:value={routingPriceWeight} inputmode="decimal" autocomplete="off" aria-invalid={errors['routing'] !== undefined} /></div>
				</div>
				<Field.Error>{errors['routing'] ?? ''}</Field.Error>
			</Field.Field>
			{/if}
		</ConfigurationSection>
		<ConfigurationSection title={$_('admin.configuration.ai.taskHistory')} description={$_('admin.configuration.ai.retentionDescription')}>
			<Field.Field data-invalid={errors['retention'] !== undefined}><Field.Label for="ai-task-retention">{$_('admin.configuration.ai.retention')}</Field.Label><Input id="ai-task-retention" class="max-w-48" bind:value={taskRetentionDays} inputmode="numeric" autocomplete="off" aria-invalid={errors['retention'] !== undefined} /><Field.Error>{errors['retention'] ?? ''}</Field.Error></Field.Field>
		</ConfigurationSection>
	</form>
	<ConfigurationActions {dirty} {saving} onSave={saveConfig} onDiscard={discardChanges} />
{/if}
