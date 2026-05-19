<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		title,
		description,
		span = 1,
		children,
	}: {
		title: string;
		description?: string;
		/** Column span on lg screens, used inside a 12-col grid. */
		span?: 1 | 2 | 3 | 4 | 6 | 12;
		children: Snippet;
	} = $props();

	const spanClass = $derived({
		1: "lg:col-span-3",
		2: "lg:col-span-6",
		3: "lg:col-span-9",
		4: "lg:col-span-12",
		6: "lg:col-span-12",
		12: "lg:col-span-12",
	}[span]);
</script>

<div class="col-span-12 md:col-span-6 {spanClass} flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-card p-6">
	<div class="flex flex-col gap-1">
		<div class="text-[13px] font-semibold tracking-[-0.13px] text-foreground">
			{title}
		</div>
		{#if description}
			<p class="text-caption text-muted-foreground">{description}</p>
		{/if}
	</div>
	<div class="flex flex-1 flex-wrap items-start gap-3">
		{@render children()}
	</div>
</div>
