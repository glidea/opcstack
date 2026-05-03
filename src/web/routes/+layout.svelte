<script lang="ts">
	import { untrack } from "svelte";
	import { locale as localeStore } from "$web/i18n";
	import type { SystemLocale } from "$web/i18n/locales";
	import "../app.css";
	import "$web/i18n";

	let {
		data,
		children,
	}: {
		data: { locale: SystemLocale; websiteJsonLd: string };
		children: import("svelte").Snippet;
	} = $props();

	localeStore.set(untrack(() => data.locale));

	$effect(() => {
		if (typeof document !== "undefined") {
			document.documentElement.lang = data.locale;
		}
	});
</script>

<svelte:head>
	<script type="application/ld+json">
		{@html data.websiteJsonLd}
	</script>
</svelte:head>

<div class="min-h-svh">
	{@render children()}
	<footer
		class="border-t border-border px-6 py-4 text-center text-sm text-muted-foreground"
	>
		<a
			href="https://opcstack.glidea.app/"
			target="_blank"
			rel="noopener"
			class="hover:text-foreground"
		>
			Powered by OPCStack
		</a>
	</footer>
</div>
