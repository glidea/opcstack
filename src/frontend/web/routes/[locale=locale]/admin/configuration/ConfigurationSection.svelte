<script lang="ts">
	import type { Snippet } from 'svelte'

	let { title, description, children }: { title: string; description?: string; children: Snippet } = $props()
</script>

<section class="max-w-3xl border-b py-7 last:border-b-0">
	<header class="max-w-xl">
		<h2 class="text-sm font-semibold">{title}</h2>
		{#if description}<p class="mt-1 text-sm text-muted-foreground">{description}</p>{/if}
	</header>
	<div class="mt-6 max-w-2xl space-y-5">{@render children()}</div>
</section>
