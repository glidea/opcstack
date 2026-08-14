<script lang="ts">
	import type { SecretAction } from './configuration-page'
	import { _ } from '$frontend/i18n'
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

<Field.Field class="max-w-md" data-invalid={error !== ''}>
	<Field.Label for={`${id}-action`}>{label}</Field.Label>
	{#if action === 'keep'}
		<div class="flex min-h-9 flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-1.5">
			<span class="text-sm text-muted-foreground">{configured ? $_('admin.configuration.secret.configured') : $_('admin.configuration.secret.notConfigured')}</span>
			<div class="flex items-center gap-1"><Button type="button" size="sm" variant="ghost" onclick={replaceSecret}>{configured ? $_('admin.configuration.secret.replace') : $_('admin.configuration.secret.add')}</Button>
			{#if configured}<Button type="button" size="sm" variant="ghost" onclick={removeSecret}>{$_('admin.configuration.secret.remove')}</Button>{/if}
			</div>
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
