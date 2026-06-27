<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		id,
		eyebrow,
		title,
		description,
		surface = "light",
		container = "wide",
		children,
	}: {
		id: string;
		eyebrow?: string;
		title: string;
		description?: string;
		surface?: "light" | "parchment" | "dark";
		container?: "narrow" | "wide";
		children: Snippet;
	} = $props();

	const surfaceClass = $derived({
		light: "bg-background text-foreground",
		parchment: "bg-secondary text-foreground",
		dark: "bg-foreground text-background",
	}[surface]);

	const widthClass = $derived(container === "narrow" ? "max-w-3xl" : "max-w-6xl");
</script>

<section {id} class="scroll-mt-24 overflow-x-hidden px-6 py-20 md:py-24 {surfaceClass}">
	<div class="mx-auto w-full {widthClass}">
		<header class="mb-12 flex max-w-3xl flex-col gap-3">
			{#if eyebrow}
				<span class="text-fine-print uppercase tracking-[0.12em] {surface === 'dark' ? 'text-background/60' : 'text-muted-foreground'}">
					{eyebrow}
				</span>
			{/if}
			<h2 class="text-display-lg">{title}</h2>
			{#if description}
				<p class="text-lead {surface === 'dark' ? 'text-background/70' : 'text-muted-foreground'}">
					{description}
				</p>
			{/if}
		</header>

		<div class="grid grid-cols-12 gap-4">
			{@render children()}
		</div>
	</div>
</section>
