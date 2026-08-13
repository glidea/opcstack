<script lang="ts">
	import { untrack } from "svelte";
	import { page } from "$app/stores";
	import type { PublicRuntimeConfig } from "$backend/config";
	import { locale as localeStore } from "$frontend/i18n";
	import type { SystemLocale } from "$frontend/i18n/locales";
	import "$frontend/styles/app.css";
	import "$frontend/i18n";
	import { Toaster } from "$frontend/ui/sonner";

	const REGISTRATION_UTM_SOURCE_COOKIE = 'registration_utm_source';
	const REGISTRATION_UTM_SOURCE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

	let {
		data,
		children,
	}: {
		data: { locale: SystemLocale; websiteJsonLd: string; supportEmail: string; publicRuntimeConfig: PublicRuntimeConfig };
		children: import("svelte").Snippet;
	} = $props();

	localeStore.set(untrack(() => data.locale));

	$effect(() => {
		if (typeof document !== "undefined") {
			document.documentElement.lang = data.locale;
			const themeParam = $page.params.theme;
			document.documentElement.dataset['design'] = themeParam || data.publicRuntimeConfig.design_system;
			persistRegistrationUtmSource($page.url.searchParams);
		}
	});

	function persistRegistrationUtmSource(searchParams: URLSearchParams): void {
		if (readCookie(REGISTRATION_UTM_SOURCE_COOKIE) !== '') {
			return;
		}

		const utmSource = searchParams.get('utm_source') ?? '';
		if (utmSource === '') {
			return;
		}

		document.cookie = `${REGISTRATION_UTM_SOURCE_COOKIE}=${encodeURIComponent(utmSource)}; Path=/; Max-Age=${REGISTRATION_UTM_SOURCE_MAX_AGE_SECONDS}; SameSite=Lax`;
	}

	function readCookie(name: string): string {
		const pairs = document.cookie.split(';');
		for (const pair of pairs) {
			const [rawName, rawValue] = pair.trim().split('=');
			if (rawName === name) {
				return rawValue ?? '';
			}
		}
		return '';
	}
</script>

<svelte:head>
	<script type="application/ld+json">
		{@html data.websiteJsonLd}
	</script>
</svelte:head>

<div class="min-h-svh">
	<Toaster />
	{@render children()}
	{#if $page.route.id?.startsWith('/[locale=locale]/admin') !== true}
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
	{/if}
</div>
