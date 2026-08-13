<script lang="ts">
	import { onDestroy, onMount } from 'svelte'
	import type { StorageConfig } from '$apiContract/configuration'
	import { ApiClientError, client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import { Skeleton } from '$frontend/ui/skeleton'
	import { Textarea } from '$frontend/ui/textarea'
	import { toast } from 'svelte-sonner'
	import ConfigurationActions from './ConfigurationActions.svelte'
	import ConfigurationLoadError from './ConfigurationLoadError.svelte'
	import ConfigurationSection from './ConfigurationSection.svelte'
	import ConfigurationSaveError from './ConfigurationSaveError.svelte'
	import { dispatchConfigurationEditorState, focusFirstConfigurationError, isConfigurationConflict } from './configuration-page'

	let contentTypes: string = $state('')
	let maxUploadMb: string = $state('')
	let version: number = $state(1)
	let savedSnapshot: string = $state('')
	let loaded: boolean = $state(false)
	let saving: boolean = $state(false)
	let error: string = $state('')
	let conflict: boolean = $state(false)
	let contentTypesError: string = $state('')
	let maxUploadError: string = $state('')
	let dirty: boolean = $state(false)

	function snapshot(): string { return JSON.stringify({ contentTypes, maxUploadMb }) }

	function applyConfig(config: StorageConfig): void {
		contentTypes = config.allowed_content_types.join('\n')
		maxUploadMb = String(config.max_upload_bytes / 1024 / 1024)
		version = config.version
		savedSnapshot = snapshot()
		error = ''
		conflict = false
	}

	function parseContentTypes(): string[] {
		return contentTypes.split(/[\n,]/).map((value: string): string => value.trim()).filter((value: string): boolean => value !== '')
	}

	function validate(): boolean {
		const types: string[] = parseContentTypes()
		const mb: number = Number(maxUploadMb)
		contentTypesError = types.length === 0 ? $_('admin.configuration.storage.contentTypesRequired') : ''
		maxUploadError = Number.isFinite(mb) && mb > 0 ? '' : $_('admin.configuration.storage.maxUploadRequired')
		return contentTypesError === '' && maxUploadError === ''
	}

	async function loadConfig(): Promise<void> {
		loaded = false
		try { applyConfig(await client.api.getStorageConfig()); loaded = true }
		catch (loadError) { error = loadError instanceof ApiClientError ? loadError.body.message : $_('admin.configuration.loadError') }
	}

	async function saveConfig(): Promise<boolean> {
		if (!validate()) { focusFirstConfigurationError(); return false }
		saving = true
		error = ''
		try {
			applyConfig(await client.api.updateStorageConfig({
				allowed_content_types: parseContentTypes(),
				max_upload_bytes: Math.round(Number(maxUploadMb) * 1024 * 1024),
				expected_version: version
			}))
			toast.success($_('admin.configuration.saved'))
			return true
		} catch (saveError) { conflict = isConfigurationConflict(saveError); error = saveError instanceof ApiClientError ? saveError.body.message : $_('admin.configuration.saveError'); return false }
		finally { saving = false }
	}

	function discardChanges(): void {
		const value: { contentTypes: string; maxUploadMb: string } = JSON.parse(savedSnapshot)
		contentTypes = value.contentTypes
		maxUploadMb = value.maxUploadMb
		contentTypesError = ''
		maxUploadError = ''
		error = ''
	}

	$effect(() => { dirty = loaded && snapshot() !== savedSnapshot; dispatchConfigurationEditorState(dirty, saveConfig) })
	onMount((): void => { void loadConfig() })
	onDestroy((): void => dispatchConfigurationEditorState(false, saveConfig))
</script>

{#if !loaded}
	{#if error === ''}<div class="space-y-4 py-8"><Skeleton class="h-36 w-full" /><Skeleton class="h-28 w-full" /></div>{:else}<ConfigurationLoadError {error} onRetry={loadConfig} />{/if}
{:else}
	{#if error !== ''}<ConfigurationSaveError {error} {conflict} onRefresh={loadConfig} />{/if}
	<form onsubmit={(event: SubmitEvent): void => { event.preventDefault(); void saveConfig() }}>
		<ConfigurationSection title={$_('admin.configuration.storage.uploads')}>
			<Field.Field data-invalid={contentTypesError !== ''}>
				<Field.Label for="configuration-content-types">{$_('admin.configuration.storage.contentTypes')}</Field.Label>
				<Textarea id="configuration-content-types" rows={5} bind:value={contentTypes} aria-invalid={contentTypesError !== ''} />
				<Field.Description>{$_('admin.configuration.storage.contentTypesDescription')}</Field.Description>
				<Field.Error>{contentTypesError}</Field.Error>
			</Field.Field>
			<Field.Field data-invalid={maxUploadError !== ''}>
				<Field.Label for="configuration-max-upload">{$_('admin.configuration.storage.maxUpload')}</Field.Label>
				<Input id="configuration-max-upload" type="number" min="0.01" step="0.01" inputmode="decimal" bind:value={maxUploadMb} aria-invalid={maxUploadError !== ''} />
				<Field.Error>{maxUploadError}</Field.Error>
			</Field.Field>
		</ConfigurationSection>
		<ConfigurationActions {dirty} {saving} onSave={saveConfig} onDiscard={discardChanges} />
	</form>
{/if}
