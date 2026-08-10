<script lang="ts">
	import type { Snippet } from 'svelte'
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal'
	import { Badge } from '$frontend/ui/badge'
	import { cn } from '$frontend/ui/utils'

	let {
		open = $bindable(false),
		count,
		label,
		contentClass = '',
		children
	}: {
		open?: boolean
		count: number
		label: string
		contentClass?: string
		children: Snippet
	} = $props()
</script>

<details bind:open class="group">
	<summary
		class="inline-flex h-11 cursor-pointer list-none items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9 [&::-webkit-details-marker]:hidden"
	>
		<SlidersHorizontalIcon class="size-4" />
		<span>{label}</span>
		{#if count > 0}<Badge variant="secondary">{count}</Badge>{/if}
		<ChevronDownIcon class="size-4 transition-transform group-open:rotate-180" />
	</summary>
	<div class={cn('mt-3 grid gap-3', contentClass)}>
		{@render children()}
	</div>
</details>
