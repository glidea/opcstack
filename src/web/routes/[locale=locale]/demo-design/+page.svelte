<script lang="ts">
	import { onMount } from "svelte";
	import { _ } from "$web/i18n";
	import AppHeader from "$web/components/AppHeader.svelte";
	import { Button } from "$web/ui/button";

	import Foundations from "./_sections/Foundations.svelte";
	import Actions from "./_sections/Actions.svelte";
	import Forms from "./_sections/Forms.svelte";
	import Display from "./_sections/Display.svelte";
	import Navigation from "./_sections/Navigation.svelte";
	import Overlays from "./_sections/Overlays.svelte";
	import Disclosure from "./_sections/Disclosure.svelte";
	import AppComponents from "./_sections/AppComponents.svelte";

	let {
		data,
	}: {
		data: {
			siteName: string;
			canonicalUrl: string;
		};
	} = $props();

	const navItems = [
		{ href: "#foundations", label: "Foundations" },
		{ href: "#actions", label: "Actions" },
		{ href: "#forms", label: "Forms" },
		{ href: "#display", label: "Display" },
		{ href: "#navigation", label: "Navigation" },
		{ href: "#overlays", label: "Overlays" },
		{ href: "#disclosure", label: "Disclosure" },
		{ href: "#app", label: "App" },
	];

	let activeHash = $state("#foundations");

	onMount(() => {
		const ids = navItems.map((i) => i.href.slice(1));
		const sections = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						activeHash = `#${entry.target.id}`;
					}
				}
			},
			{ rootMargin: "-20% 0px -60% 0px" }
		);

		for (const el of sections) observer.observe(el);
		return () => observer.disconnect();
	});
</script>

<svelte:head>
	<title>{$_("designSystem.title")} — {data.siteName}</title>
	<meta name="description" content={$_("designSystem.description")} />
	<link rel="canonical" href={data.canonicalUrl} />
</svelte:head>

<AppHeader logoHref="/">
	{#snippet center()}
		<nav class="hidden items-center gap-1 md:flex">
			{#each navItems as item (item.href)}
				<a
					href={item.href}
					class="rounded-[8px] px-2.5 py-1 text-[12px] transition-colors {activeHash === item.href ? 'text-foreground bg-accent' : 'text-muted-foreground hover:text-foreground'}"
				>{item.label}</a>
			{/each}
		</nav>
	{/snippet}
</AppHeader>

<!-- Hero -->
<section class="flex min-h-[60svh] flex-col items-center justify-center overflow-x-hidden bg-background px-6 py-24 text-center">
	<p class="text-fine-print mb-4 uppercase tracking-[0.12em] text-muted-foreground">OPC Stack</p>
	<h1 class="text-hero-display max-w-3xl break-words">{$_("designSystem.title")}</h1>
	<p class="text-lead mt-6 max-w-2xl text-muted-foreground">
		{$_("designSystem.description")}
	</p>
	<div class="mt-10 flex flex-wrap items-center justify-center gap-4">
		<Button href="#foundations">{$_("designSystem.exploreTokens")}</Button>
		<Button variant="outline" href="#app">{$_("designSystem.appComponents")}</Button>
	</div>
</section>

<Foundations />
<Actions />
<Forms />
<Display />
<Navigation />
<Overlays />
<Disclosure />
<AppComponents />
