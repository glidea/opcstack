<script lang="ts">
	import SaveIcon from '@lucide/svelte/icons/save'
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw'
	import { _ } from '$frontend/i18n'
	import { Button } from '$frontend/ui/button'

	let {
		dirty,
		saving,
		onSave,
		onDiscard
	}: {
		dirty: boolean
		saving: boolean
		onSave: () => Promise<boolean>
		onDiscard: () => void
	} = $props()
</script>

{#if dirty}
	<div class="h-20" aria-hidden="true"></div>
	<div class="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-lg backdrop-blur-sm">
		<div class="mx-auto flex max-w-6xl items-center justify-between gap-4">
			<p class="text-sm font-medium">{$_('admin.configuration.unsaved.label')}</p>
			<div class="flex items-center gap-2">
				<Button type="button" variant="outline" disabled={saving} onclick={onDiscard}>
					<RotateCcwIcon />
					{$_('admin.configuration.discard')}
				</Button>
				<Button type="button" disabled={saving} onclick={onSave}>
					<SaveIcon />
					{saving ? $_('admin.configuration.saving') : $_('admin.configuration.save')}
				</Button>
			</div>
		</div>
	</div>
{/if}
