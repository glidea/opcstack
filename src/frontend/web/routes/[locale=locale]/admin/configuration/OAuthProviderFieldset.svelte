<script lang="ts">
	import { _ } from '$frontend/i18n'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import { Switch } from '$frontend/ui/switch'
	import ConfigurationSection from './ConfigurationSection.svelte'
	import SecretField from './SecretField.svelte'
	import type { SecretAction } from './configuration-page'

	let {
		id,
		title,
		enabled = $bindable(false),
		clientId = $bindable(''),
		secretConfigured,
		secretAction = $bindable('keep'),
		secretValue = $bindable(''),
		callbackUrl,
		clientIdError = '',
		secretError = ''
	}: {
		id: string
		title: string
		enabled?: boolean
		clientId?: string
		secretConfigured: boolean
		secretAction?: SecretAction
		secretValue?: string
		callbackUrl: string
		clientIdError?: string
		secretError?: string
	} = $props()
</script>

<ConfigurationSection {title}>
	<Field.Field orientation="horizontal">
		<Field.Label for={`${id}-enabled`}>{$_('admin.configuration.enabled')}</Field.Label>
		<Switch id={`${id}-enabled`} bind:checked={enabled} />
	</Field.Field>
	{#if enabled}
		<Field.Field data-invalid={clientIdError !== ''}>
			<Field.Label for={`${id}-client-id`}>{$_('admin.configuration.authentication.clientId')}</Field.Label>
			<Input id={`${id}-client-id`} autocomplete="off" bind:value={clientId} aria-invalid={clientIdError !== ''} />
			<Field.Error>{clientIdError}</Field.Error>
		</Field.Field>
		<SecretField id={`${id}-client-secret`} label={$_('admin.configuration.authentication.clientSecret')} configured={secretConfigured} bind:action={secretAction} bind:value={secretValue} error={secretError} />
		<Field.Field>
			<Field.Label for={`${id}-callback-url`}>{$_('admin.configuration.authentication.callbackUrl')}</Field.Label>
			<Input id={`${id}-callback-url`} value={callbackUrl} readonly />
		</Field.Field>
	{/if}
</ConfigurationSection>
