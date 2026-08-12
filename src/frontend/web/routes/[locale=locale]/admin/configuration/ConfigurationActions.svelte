<script lang="ts">
	import SaveIcon from '@lucide/svelte/icons/save'
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw'
	import { _ } from '$frontend/i18n'
	import { Button } from '$frontend/ui/button'

	let { dirty, saving, onSave, onDiscard }: { dirty: boolean; saving: boolean; onSave: () => void; onDiscard: () => void } = $props()
</script>

<div class="flex items-center justify-end gap-2 border-t pt-5">
	<Button type="button" variant="outline" disabled={!dirty || saving} onclick={onDiscard}>
		<RotateCcwIcon />
		{$_('admin.configuration.discard')}
	</Button>
	<Button type="button" disabled={!dirty || saving} onclick={onSave}>
		<SaveIcon />
		{saving ? $_('admin.configuration.saving') : $_('admin.configuration.save')}
	</Button>
</div>
