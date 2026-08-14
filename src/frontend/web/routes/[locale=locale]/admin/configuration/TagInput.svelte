<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x'

	let {
		id,
		value = $bindable([]),
		placeholder = ''
	}: {
		id: string
		value?: string[]
		placeholder?: string
	} = $props()

	let draft: string = $state('')

	function addDraft(): void {
		const item: string = draft.trim()
		if (item === '' || value.includes(item)) {
			draft = ''
			return
		}
		value = [...value, item]
		draft = ''
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter' && event.key !== ',') return
		event.preventDefault()
		addDraft()
	}

	function removeItem(item: string): void {
		value = value.filter((candidate: string): boolean => candidate !== item)
	}
</script>

<div class="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring/50">
	{#each value as item (item)}
		<span class="inline-flex h-7 items-center gap-1 rounded-md bg-muted px-2 text-sm">
			{item}
			<button type="button" class="text-muted-foreground hover:text-foreground" onclick={() => removeItem(item)} aria-label={`Remove ${item}`}>
				<XIcon class="size-3.5" />
			</button>
		</span>
	{/each}
	<input id={id} class="h-7 min-w-32 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground" bind:value={draft} {placeholder} onkeydown={handleKeydown} onblur={addDraft} />
</div>
