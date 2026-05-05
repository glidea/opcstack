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
		data: { locale: SystemLocale; websiteJsonLd: string; supportEmail: string };
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
		<div class="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-4 gap-y-2">
			<a href="/terms" class="hover:text-foreground">Terms</a>
			<a href="/privacy" class="hover:text-foreground">Privacy</a>
			<a href="/refund-policy" class="hover:text-foreground">Refund Policy</a>
			<a
				href={`mailto:${data.supportEmail}`}
				class="hover:text-foreground"
			>
				Support
			</a>
		</div>
	</footer>
</div>
