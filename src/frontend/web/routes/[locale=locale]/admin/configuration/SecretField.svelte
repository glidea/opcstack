<script lang="ts">
	import type { SecretAction } from './configuration-page'
	import { _ } from '$frontend/i18n'
	import { Badge } from '$frontend/ui/badge'
	import { Button } from '$frontend/ui/button'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'

	let {
		id,
		label,
		configured,
		action = $bindable('keep'),
		value = $bindable(''),
		error = ''
	}: {
		id: string
		label: string
		configured: boolean
		action?: SecretAction
		value?: string
		error?: string
		} = $props()

	function replaceSecret(): void {
		action = 'replace'
		value = ''
	}

	function removeSecret(): void {
		action = 'remove'
		value = ''
	}

	function undoSecretChange(): void {
		action = 'keep'
		value = ''
	}
</script>

<Field.Field data-invalid={error !== ''}>
	<div class="flex items-center justify-between gap-3">
		<Field.Label for={`${id}-action`}>{label}</Field.Label>
		<Badge variant="secondary">{configured ? $_('admin.configuration.secret.configured') : $_('admin.configuration.secret.notConfigured')}</Badge>
	</div>
	{#if action === 'keep'}
		<div class="flex flex-wrap gap-2">
			<Button type="button" size="sm" variant="outline" onclick={replaceSecret}>{$_('admin.configuration.secret.replace')}</Button>
			{#if configured}<Button type="button" size="sm" variant="ghost" onclick={removeSecret}>{$_('admin.configuration.secret.remove')}</Button>{/if}
		</div>
	{:else if action === 'remove'}
		<div class="flex items-center justify-between gap-3 border border-destructive/40 bg-destructive/5 px-3 py-2">
			<span class="text-sm text-destructive">{$_('admin.configuration.secret.pendingRemoval')}</span>
			<Button type="button" size="sm" variant="ghost" onclick={undoSecretChange}>{$_('admin.configuration.secret.undo')}</Button>
		</div>
	{:else}
		<div class="flex justify-end">
			<Button type="button" size="sm" variant="ghost" onclick={undoSecretChange}>{$_('admin.configuration.secret.undo')}</Button>
		</div>
	{/if}
	{#if action === 'replace'}
		<Input id={id} type="password" autocomplete="new-password" bind:value aria-invalid={error !== ''} autofocus />
	{/if}
	<Field.Error>{error}</Field.Error>
</Field.Field>
