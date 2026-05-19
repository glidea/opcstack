<script lang="ts">
	import type { Snippet } from 'svelte'
	import { defaultLocale, locale } from "$web/i18n";
	import { SidebarTrigger } from "$web/ui/sidebar";
	import ThemeSwitcher from "./ThemeSwitcher.svelte";
	import LocaleSwitcher from "./LocaleSwitcher.svelte";

	let {
		logoHref = "/",
		showSidebarTrigger = false,
		center,
		actions
	}: {
		logoHref?: string
		showSidebarTrigger?: boolean
		center?: Snippet
		actions?: Snippet
	} = $props();
</script>

<header
	class="sticky top-0 z-30 border-b border-[var(--glass-border)] bg-[var(--header-glass-bg)] shadow-[var(--glass-shadow)] backdrop-blur-[var(--header-glass-blur)] backdrop-saturate-[var(--header-glass-saturate)]"
>
	<div class="flex h-12 w-full items-center gap-4 px-6">
		{#if showSidebarTrigger}
			<SidebarTrigger class="md:hidden" />
		{/if}
		<a href={logoHref} class="shrink-0">
			<img src="/logo.svg" alt="logo" class="block h-6 w-auto [color-scheme:light] dark:[color-scheme:dark]" />
		</a>
		{#if center}
			{@render center()}
		{/if}
		<div class="ml-auto flex items-center gap-2">
			<LocaleSwitcher current={$locale ?? defaultLocale} />
			<ThemeSwitcher />
			{#if actions}
				{@render actions()}
			{/if}
		</div>
	</div>
</header>
