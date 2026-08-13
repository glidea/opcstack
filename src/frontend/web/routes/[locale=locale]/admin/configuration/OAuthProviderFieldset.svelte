<script lang="ts">
	import { _ } from '$frontend/i18n'
	import CopyIcon from '@lucide/svelte/icons/copy'
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
	import { Button } from '$frontend/ui/button'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import { Switch } from '$frontend/ui/switch'
	import { toast } from 'svelte-sonner'
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

	let expanded: boolean = $state(enabled)

	$effect((): void => {
		if (enabled) expanded = true
	})

	async function copyCallbackUrl(): Promise<void> {
		await navigator.clipboard.writeText(callbackUrl)
		toast.success($_('admin.configuration.copied'))
	}
</script>

<ConfigurationSection {title}>
	<div class="flex items-center justify-between gap-3">
		<Field.Field orientation="horizontal" class="flex-1">
			<Field.Label for={`${id}-enabled`}>{$_('admin.configuration.enabled')}</Field.Label>
			<Switch id={`${id}-enabled`} bind:checked={enabled} />
		</Field.Field>
		<Button type="button" size="icon-sm" variant="ghost" onclick={() => (expanded = !expanded)} aria-label={expanded ? $_('admin.configuration.collapse') : $_('admin.configuration.expand')} title={expanded ? $_('admin.configuration.collapse') : $_('admin.configuration.expand')}>
			<ChevronDownIcon class={expanded ? 'rotate-180' : ''} />
		</Button>
	</div>
	{#if expanded}
		<div class="space-y-2">
			<Field.Label for={`${id}-callback-copy`}>{$_('admin.configuration.authentication.callbackUrl')}</Field.Label>
			<div class="flex items-center gap-2">
				<span class="min-w-0 flex-1 break-all font-mono text-xs text-muted-foreground">{callbackUrl}</span>
				<Button id={`${id}-callback-copy`} type="button" size="icon-sm" variant="ghost" onclick={copyCallbackUrl} aria-label={$_('admin.configuration.copy')} title={$_('admin.configuration.copy')}><CopyIcon /></Button>
			</div>
		</div>
		<Field.Field data-invalid={clientIdError !== ''}>
			<Field.Label for={`${id}-client-id`}>{$_('admin.configuration.authentication.clientId')}</Field.Label>
			<Input id={`${id}-client-id`} autocomplete="off" bind:value={clientId} aria-invalid={clientIdError !== ''} />
			<Field.Error>{clientIdError}</Field.Error>
		</Field.Field>
		<SecretField id={`${id}-client-secret`} label={$_('admin.configuration.authentication.clientSecret')} configured={secretConfigured} bind:action={secretAction} bind:value={secretValue} error={secretError} />
	{/if}
</ConfigurationSection>
