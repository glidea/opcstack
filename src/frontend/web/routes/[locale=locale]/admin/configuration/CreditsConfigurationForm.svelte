<script lang="ts">
	import { onDestroy, onMount } from 'svelte'
	import type { CreditsConfig } from '$apiContract/configuration'
	import { ApiClientError, client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import { Skeleton } from '$frontend/ui/skeleton'
	import { Switch } from '$frontend/ui/switch'
	import ConfigurationActions from './ConfigurationActions.svelte'
	import ConfigurationLoadError from './ConfigurationLoadError.svelte'
	import ConfigurationSection from './ConfigurationSection.svelte'
	import { dispatchConfigurationDirty } from './configuration-page'

	type CreditsFields = {
		signupEnabled: boolean
		signupAmount: string
		dailyCheckinEnabled: boolean
		dailyCheckinAmount: string
		historyRetentionDays: string
	}

	let signupEnabled: boolean = $state(false)
	let signupAmount: string = $state('0')
	let dailyCheckinEnabled: boolean = $state(false)
	let dailyCheckinAmount: string = $state('0')
	let historyRetentionDays: string = $state('365')
	let version: number = $state(1)
	let savedSnapshot: string = $state('')
	let loaded: boolean = $state(false)
	let saving: boolean = $state(false)
	let error: string = $state('')
	let signupAmountError: string = $state('')
	let dailyCheckinAmountError: string = $state('')
	let retentionError: string = $state('')
	let dirty: boolean = $state(false)

	function snapshot(): string {
		return JSON.stringify({ signupEnabled, signupAmount, dailyCheckinEnabled, dailyCheckinAmount, historyRetentionDays })
	}

	function applyConfig(config: CreditsConfig): void {
		signupEnabled = config.signup_enabled
		signupAmount = config.signup_amount
		dailyCheckinEnabled = config.daily_checkin_enabled
		dailyCheckinAmount = config.daily_checkin_amount
		historyRetentionDays = String(config.history_retention_days)
		version = config.version
		savedSnapshot = snapshot()
		error = ''
	}

	function validCreditAmount(value: string): boolean {
		return /^\d+(?:\.\d{1,6})?$/.test(value)
	}

	function validate(): boolean {
		signupAmountError = signupEnabled && !validCreditAmount(signupAmount) ? $_('admin.configuration.credits.amountRequired') : ''
		dailyCheckinAmountError = dailyCheckinEnabled && !validCreditAmount(dailyCheckinAmount) ? $_('admin.configuration.credits.amountRequired') : ''
		const retention: number = Number(historyRetentionDays)
		retentionError = Number.isInteger(retention) && retention > 0 ? '' : $_('admin.configuration.credits.retentionRequired')
		return signupAmountError === '' && dailyCheckinAmountError === '' && retentionError === ''
	}

	async function loadConfig(): Promise<void> {
		loaded = false
		try { applyConfig(await client.api.getCreditsConfig()); loaded = true }
		catch (loadError) { error = loadError instanceof ApiClientError ? loadError.body.message : $_('admin.configuration.loadError') }
	}

	async function saveConfig(): Promise<void> {
		if (!validate()) return
		saving = true
		error = ''
		try {
			applyConfig(await client.api.updateCreditsConfig({
				signup_enabled: signupEnabled,
				signup_amount: signupAmount,
				daily_checkin_enabled: dailyCheckinEnabled,
				daily_checkin_amount: dailyCheckinAmount,
				history_retention_days: Number(historyRetentionDays),
				expected_version: version
			}))
		} catch (saveError) { error = saveError instanceof ApiClientError ? saveError.body.message : $_('admin.configuration.saveError') }
		finally { saving = false }
	}

	function discardChanges(): void {
		const value: CreditsFields = JSON.parse(savedSnapshot)
		signupEnabled = value.signupEnabled
		signupAmount = value.signupAmount
		dailyCheckinEnabled = value.dailyCheckinEnabled
		dailyCheckinAmount = value.dailyCheckinAmount
		historyRetentionDays = value.historyRetentionDays
		signupAmountError = ''
		dailyCheckinAmountError = ''
		retentionError = ''
		error = ''
	}

	$effect(() => { dirty = loaded && snapshot() !== savedSnapshot; dispatchConfigurationDirty(dirty) })
	onMount((): void => { void loadConfig() })
	onDestroy((): void => dispatchConfigurationDirty(false))
</script>

{#if !loaded}
	{#if error === ''}<div class="space-y-4 py-8"><Skeleton class="h-44 w-full" /><Skeleton class="h-44 w-full" /></div>{:else}<ConfigurationLoadError {error} onRetry={loadConfig} />{/if}
{:else}
	{#if error !== ''}<Alert.Root variant="destructive"><Alert.Description>{error}</Alert.Description></Alert.Root>{/if}
	<form onsubmit={(event: SubmitEvent): void => { event.preventDefault(); void saveConfig() }}>
		<ConfigurationSection title={$_('admin.configuration.credits.signup')}>
			<Field.Field orientation="horizontal"><Field.Label for="credits-signup-enabled">{$_('admin.configuration.enabled')}</Field.Label><Switch id="credits-signup-enabled" bind:checked={signupEnabled} /></Field.Field>
			{#if signupEnabled}
				<Field.Field data-invalid={signupAmountError !== ''}><Field.Label for="credits-signup-amount">{$_('admin.configuration.credits.amount')}</Field.Label><Input id="credits-signup-amount" inputmode="decimal" bind:value={signupAmount} aria-invalid={signupAmountError !== ''} /><Field.Error>{signupAmountError}</Field.Error></Field.Field>
			{/if}
		</ConfigurationSection>
		<ConfigurationSection title={$_('admin.configuration.credits.dailyCheckin')}>
			<Field.Field orientation="horizontal"><Field.Label for="credits-checkin-enabled">{$_('admin.configuration.enabled')}</Field.Label><Switch id="credits-checkin-enabled" bind:checked={dailyCheckinEnabled} /></Field.Field>
			{#if dailyCheckinEnabled}
				<Field.Field data-invalid={dailyCheckinAmountError !== ''}><Field.Label for="credits-checkin-amount">{$_('admin.configuration.credits.amount')}</Field.Label><Input id="credits-checkin-amount" inputmode="decimal" bind:value={dailyCheckinAmount} aria-invalid={dailyCheckinAmountError !== ''} /><Field.Error>{dailyCheckinAmountError}</Field.Error></Field.Field>
			{/if}
		</ConfigurationSection>
		<ConfigurationSection title={$_('admin.configuration.credits.history')}>
			<Field.Field data-invalid={retentionError !== ''}><Field.Label for="credits-retention">{$_('admin.configuration.credits.retention')}</Field.Label><Input id="credits-retention" type="number" min="1" inputmode="numeric" bind:value={historyRetentionDays} aria-invalid={retentionError !== ''} /><Field.Error>{retentionError}</Field.Error></Field.Field>
		</ConfigurationSection>
		<ConfigurationActions {dirty} {saving} onSave={saveConfig} onDiscard={discardChanges} />
	</form>
{/if}
