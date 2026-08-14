<script lang="ts">
	import { onDestroy, onMount } from 'svelte'
	import type { AffiliateConfig } from '$apiContract/configuration'
	import { ApiClientError, client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import { Skeleton } from '$frontend/ui/skeleton'
	import { Switch } from '$frontend/ui/switch'
	import { toast } from 'svelte-sonner'
	import ConfigurationActions from './ConfigurationActions.svelte'
	import ConfigurationLoadError from './ConfigurationLoadError.svelte'
	import ConfigurationSection from './ConfigurationSection.svelte'
	import ConfigurationSaveError from './ConfigurationSaveError.svelte'
	import { dispatchConfigurationEditorState, focusFirstConfigurationError, isConfigurationConflict, resolveConfigurationSaveError } from './configuration-page'

	let enabled: boolean = $state(false)
	let inviterAmount: string = $state('0')
	let inviteeAmount: string = $state('0')
	let version: number = $state(1)
	let savedSnapshot: string = $state('')
	let loaded: boolean = $state(false)
	let saving: boolean = $state(false)
	let error: string = $state('')
	let conflict: boolean = $state(false)
	let inviterError: string = $state('')
	let inviteeError: string = $state('')
	let dirty: boolean = $state(false)

	function snapshot(): string { return JSON.stringify({ enabled, inviterAmount, inviteeAmount }) }
	function applyConfig(config: AffiliateConfig): void {
		enabled = config.enabled
		inviterAmount = config.inviter_credit_amount
		inviteeAmount = config.invitee_credit_amount
		version = config.version
		savedSnapshot = snapshot()
		error = ''
		conflict = false
	}
	function validate(): boolean {
		const pattern: RegExp = /^\d+(?:\.\d{1,6})?$/
		inviterError = enabled && !pattern.test(inviterAmount) ? $_('admin.configuration.credits.amountRequired') : ''
		inviteeError = enabled && !pattern.test(inviteeAmount) ? $_('admin.configuration.credits.amountRequired') : ''
		return inviterError === '' && inviteeError === ''
	}
	async function loadConfig(): Promise<void> {
		loaded = false
		try { applyConfig(await client.api.getAffiliateConfig()); loaded = true }
		catch (loadError) { error = loadError instanceof ApiClientError ? loadError.body.message : $_('admin.configuration.loadError') }
	}
	async function saveConfig(): Promise<boolean> {
		if (!validate()) { focusFirstConfigurationError(); return false }
		saving = true
		error = ''
		try { applyConfig(await client.api.updateAffiliateConfig({ enabled, inviter_credit_amount: inviterAmount, invitee_credit_amount: inviteeAmount, expected_version: version })); toast.success($_('admin.configuration.saved')); return true }
		catch (saveError) { conflict = isConfigurationConflict(saveError); error = resolveConfigurationSaveError(saveError, $_('admin.configuration.conflict'), $_('admin.configuration.saveError')); return false }
		finally { saving = false }
	}
	function discardChanges(): void {
		const value: { enabled: boolean; inviterAmount: string; inviteeAmount: string } = JSON.parse(savedSnapshot)
		enabled = value.enabled
		inviterAmount = value.inviterAmount
		inviteeAmount = value.inviteeAmount
		inviterError = ''
		inviteeError = ''
		error = ''
	}
	$effect(() => { dirty = loaded && snapshot() !== savedSnapshot; dispatchConfigurationEditorState(dirty, saveConfig) })
	onMount((): void => { void loadConfig() })
	onDestroy((): void => dispatchConfigurationEditorState(false, saveConfig))
</script>

{#if !loaded}
	{#if error === ''}<div class="space-y-4 py-8"><Skeleton class="h-48 w-full" /></div>{:else}<ConfigurationLoadError {error} onRetry={loadConfig} />{/if}
{:else}
	{#if error !== ''}<ConfigurationSaveError {error} {conflict} onRefresh={loadConfig} />{/if}
	<form onsubmit={(event: SubmitEvent): void => { event.preventDefault(); void saveConfig() }}>
		<ConfigurationSection title={$_('admin.configuration.affiliate.referrals')} description={$_('admin.configuration.affiliate.description')}>
			<Field.Field orientation="horizontal"><Field.Label for="affiliate-enabled">{$_('admin.configuration.affiliate.action')}</Field.Label><Switch id="affiliate-enabled" bind:checked={enabled} /></Field.Field>
			{#if enabled}
				<Field.Field data-invalid={inviterError !== ''}><Field.Label for="affiliate-inviter">{$_('admin.configuration.affiliate.inviterAmount')}</Field.Label><Input id="affiliate-inviter" class="max-w-48" inputmode="decimal" bind:value={inviterAmount} aria-invalid={inviterError !== ''} /><Field.Error>{inviterError}</Field.Error></Field.Field>
				<Field.Field data-invalid={inviteeError !== ''}><Field.Label for="affiliate-invitee">{$_('admin.configuration.affiliate.inviteeAmount')}</Field.Label><Input id="affiliate-invitee" class="max-w-48" inputmode="decimal" bind:value={inviteeAmount} aria-invalid={inviteeError !== ''} /><Field.Error>{inviteeError}</Field.Error></Field.Field>
			{/if}
		</ConfigurationSection>
		<ConfigurationActions {dirty} {saving} onSave={saveConfig} onDiscard={discardChanges} />
	</form>
{/if}
