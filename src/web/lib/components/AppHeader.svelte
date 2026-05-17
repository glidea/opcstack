<script lang="ts">
	import type { Snippet } from 'svelte'
	import { defaultLocale, locale } from "$web/i18n";
	import { SidebarTrigger } from "$web/ui/sidebar";
	import ThemeSwitcher from "./ThemeSwitcher.svelte";
	import LocaleSwitcher from "./LocaleSwitcher.svelte";

	let {
		logoHref = "/",
		showSidebarTrigger = false,
		actions
	}: {
		logoHref?: string
		showSidebarTrigger?: boolean
		actions?: Snippet
	} = $props();
</script>

<header
	class="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md backdrop-saturate-[1.8]"
>
	<div class="flex h-11 w-full items-center gap-3 px-6">
		{#if showSidebarTrigger}
			<SidebarTrigger class="md:hidden" />
		{/if}
		<a href={logoHref} class="shrink-0">
			<img src="/logo.svg" alt="logo" class="block h-6 w-auto" />
		</a>
		<div class="ml-auto flex items-center gap-2">
			<LocaleSwitcher current={$locale ?? defaultLocale} />
			<ThemeSwitcher />
			{#if actions}
				{@render actions()}
			{/if}
		</div>
	</div>
</header>
