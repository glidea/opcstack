<script lang="ts">
	import type { Snippet } from 'svelte'

	let { title, description, children }: { title: string; description?: string; children: Snippet } = $props()
</script>

<section class="grid gap-6 border-b py-6 last:border-b-0 lg:grid-cols-[240px_minmax(0,560px)]">
	<div>
		<h2 class="text-sm font-semibold">{title}</h2>
		{#if description}<p class="mt-1 text-sm text-muted-foreground">{description}</p>{/if}
	</div>
	<div class="space-y-5">{@render children()}</div>
</section>
