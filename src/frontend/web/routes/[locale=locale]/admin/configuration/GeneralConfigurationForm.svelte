<script lang="ts">
	import { onDestroy, onMount } from 'svelte'
	import type { DesignSystem, GeneralConfig } from '$apiContract/configuration'
	import { ApiClientError, client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as Field from '$frontend/ui/field'
	import * as Select from '$frontend/ui/select'
	import { Skeleton } from '$frontend/ui/skeleton'
	import { Switch } from '$frontend/ui/switch'
	import { toast } from 'svelte-sonner'
	import ConfigurationActions from './ConfigurationActions.svelte'
	import ConfigurationLoadError from './ConfigurationLoadError.svelte'
	import ConfigurationSection from './ConfigurationSection.svelte'
	import ConfigurationSaveError from './ConfigurationSaveError.svelte'
	import { dispatchConfigurationEditorState, isConfigurationConflict } from './configuration-page'

	let designSystem: DesignSystem = $state('apple-saas')
	let docsEnabled: boolean = $state(false)
	let version: number = $state(1)
	let savedSnapshot: string = $state('')
	let loaded: boolean = $state(false)
	let saving: boolean = $state(false)
	let error: string = $state('')
	let conflict: boolean = $state(false)
	let dirty: boolean = $state(false)

	function snapshot(): string {
		return JSON.stringify({ designSystem, docsEnabled })
	}

	function applyConfig(config: GeneralConfig): void {
		designSystem = config.design_system
		docsEnabled = config.docs_enabled
		version = config.version
		savedSnapshot = snapshot()
		error = ''
		conflict = false
	}

	async function loadConfig(): Promise<void> {
		loaded = false
		try {
			applyConfig(await client.api.getGeneralConfig())
			loaded = true
		} catch (loadError) {
			error = loadError instanceof ApiClientError ? loadError.body.message : $_('admin.configuration.loadError')
		}
	}

	async function saveConfig(): Promise<boolean> {
		saving = true
		error = ''
		try {
			applyConfig(await client.api.updateGeneralConfig({
				design_system: designSystem,
				docs_enabled: docsEnabled,
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
		const value: { designSystem: DesignSystem; docsEnabled: boolean } = JSON.parse(savedSnapshot)
		designSystem = value.designSystem
		docsEnabled = value.docsEnabled
		error = ''
	}

	$effect(() => {
		dirty = loaded && snapshot() !== savedSnapshot
		dispatchConfigurationEditorState(dirty, saveConfig)
	})

	onMount((): void => { void loadConfig() })
	onDestroy((): void => dispatchConfigurationEditorState(false, saveConfig))
</script>

{#if !loaded}
	{#if error === ''}<div class="space-y-4 py-8"><Skeleton class="h-28 w-full" /><Skeleton class="h-28 w-full" /></div>{:else}<ConfigurationLoadError {error} onRetry={loadConfig} />{/if}
{:else}
	{#if error !== ''}<ConfigurationSaveError {error} {conflict} onRefresh={loadConfig} />{/if}
	<form onsubmit={(event: SubmitEvent): void => { event.preventDefault(); void saveConfig() }}>
		<ConfigurationSection title={$_('admin.configuration.general.appearance')}>
			<Field.Field>
				<Field.Label for="configuration-design-system">{$_('admin.configuration.general.designSystem')}</Field.Label>
				<Select.Root type="single" bind:value={designSystem}>
					<Select.Trigger id="configuration-design-system" class="w-full"><span>{$_(`admin.configuration.general.designSystems.${designSystem}`)}</span></Select.Trigger>
					<Select.Content>
						<Select.Item value="apple-saas">{$_('admin.configuration.general.designSystems.apple-saas')}</Select.Item>
						<Select.Item value="brutalism">{$_('admin.configuration.general.designSystems.brutalism')}</Select.Item>
					</Select.Content>
				</Select.Root>
			</Field.Field>
		</ConfigurationSection>
		<ConfigurationSection title={$_('admin.configuration.general.documentation')}>
			<Field.Field orientation="horizontal">
				<div><Field.Label for="configuration-docs-enabled">{$_('admin.configuration.general.docsEnabled')}</Field.Label></div>
				<Switch id="configuration-docs-enabled" bind:checked={docsEnabled} />
			</Field.Field>
		</ConfigurationSection>
		<ConfigurationActions {dirty} {saving} onSave={saveConfig} onDiscard={discardChanges} />
	</form>
{/if}
