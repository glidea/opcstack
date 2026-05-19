<script lang="ts">
	import { untrack } from "svelte";
	import { locale as localeStore } from "$web/i18n";
	import type { SystemLocale } from "$web/i18n/locales";
	import type { PublicConfig } from "$web/config/client";
	import "../app.css";
	import "$web/i18n";

	let {
		data,
		children,
	}: {
		data: { locale: SystemLocale; websiteJsonLd: string; supportEmail: string; publicConfig: PublicConfig };
		children: import("svelte").Snippet;
	} = $props();

	localeStore.set(untrack(() => data.locale));

	$effect(() => {
		if (typeof document !== "undefined") {
			document.documentElement.lang = data.locale;
			document.documentElement.dataset.design = data.publicConfig.design_system;
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
		class="border-t border-border/50 bg-muted px-6 py-10"
	>
		<div class="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center">
			<div class="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-fine-print text-muted-foreground">
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
			<a
				href="https://opcstack.glidea.app/"
				target="_blank"
				rel="noopener"
				class="text-fine-print inline-flex items-center gap-2 rounded-full px-3 py-1 text-muted-foreground hover:text-foreground"
			>
				<img src="/logo.svg" alt="OPCStack" class="size-4" />
				<span>Powered by OPCStack</span>
			</a>
		</div>
	</footer>
</div>
