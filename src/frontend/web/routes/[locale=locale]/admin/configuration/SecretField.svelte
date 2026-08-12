<script lang="ts">
	import type { SecretAction } from './configuration-page'
	import { _ } from '$frontend/i18n'
	import { Badge } from '$frontend/ui/badge'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import * as Select from '$frontend/ui/select'

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
</script>

<Field.Field data-invalid={error !== ''}>
	<div class="flex items-center justify-between gap-3">
		<Field.Label for={`${id}-action`}>{label}</Field.Label>
		<Badge variant="secondary">{configured ? $_('admin.configuration.secret.configured') : $_('admin.configuration.secret.notConfigured')}</Badge>
	</div>
	<Select.Root type="single" bind:value={action}>
		<Select.Trigger id={`${id}-action`} class="w-full" aria-invalid={error !== ''}>
			{$_(`admin.configuration.secret.${action}`)}
		</Select.Trigger>
		<Select.Content>
			<Select.Item value="keep">{$_('admin.configuration.secret.keep')}</Select.Item>
			<Select.Item value="replace">{$_('admin.configuration.secret.replace')}</Select.Item>
			<Select.Item value="remove">{$_('admin.configuration.secret.remove')}</Select.Item>
		</Select.Content>
	</Select.Root>
	{#if action === 'replace'}
		<Input id={id} type="password" autocomplete="new-password" bind:value aria-invalid={error !== ''} />
	{/if}
	<Field.Error>{error}</Field.Error>
</Field.Field>
