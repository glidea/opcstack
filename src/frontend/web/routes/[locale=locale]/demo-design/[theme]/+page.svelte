<script lang="ts">
	import { page } from '$app/stores'
	import { onMount } from "svelte";
	import { _ } from "$frontend/i18n";
	import AppHeader from "$frontend/app-ui/shell/AppHeader.svelte";
	import { Button } from "$frontend/ui/button";

	import Foundations from "../_sections/Foundations.svelte";
	import Actions from "../_sections/Actions.svelte";
	import Forms from "../_sections/Forms.svelte";
	import Display from "../_sections/Display.svelte";
	import Navigation from "../_sections/Navigation.svelte";
	import Overlays from "../_sections/Overlays.svelte";
	import Disclosure from "../_sections/Disclosure.svelte";
	import AppComponents from "../_sections/AppComponents.svelte";

	let {
		data,
	}: {
		data: {
			locale: string;
			siteName: string;
			canonicalUrl: string;
		};
	} = $props();

	const theme: string = $derived($page.params.theme ?? '')
	const logoHref: string = $derived(`/${data.locale}/demo-design/${theme}`)

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
	<title>Design System: {theme} — {data.siteName}</title>
</svelte:head>

<AppHeader logoHref={logoHref}>
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

<section class="flex min-h-[60svh] flex-col items-center justify-center overflow-x-hidden bg-background px-6 py-24 text-center">
	<p class="text-fine-print mb-4 uppercase tracking-[0.12em] text-muted-foreground">Design Theme</p>
	<h1 class="text-hero-display max-w-3xl break-words">{theme}</h1>
	<p class="text-lead mt-6 max-w-2xl text-muted-foreground">
		Previewing the {theme} design system
	</p>
	<div class="mt-10 flex flex-wrap items-center justify-center gap-4">
		<Button href="#foundations">Explore Tokens</Button>
		<Button variant="outline" href="#app">App Components</Button>
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
