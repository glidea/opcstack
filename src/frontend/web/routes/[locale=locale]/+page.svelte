<script lang="ts">
	import { _ } from "$frontend/i18n";
	import { client } from "$apiContract/client";
	import AppHeader from "$frontend/app-ui/shell/AppHeader.svelte";
	import UserMenu from "$frontend/app-ui/shell/UserMenu.svelte";
	import { clientConfig } from "$frontend/config/client";
	import { Button } from "$frontend/ui/button";

	let {
		data,
	}: {
		data: {
			locale: string;
			siteName: string;
			logoUrl: string;
			canonicalUrl: string;
			alternateUrls: Array<{ locale: string; url: string }>;
			xDefaultUrl: string;
		};
	} = $props();

	const session = client.auth.useSession();
</script>

<svelte:head>
	<title>{data.siteName} - {$_("home.titleSuffix")}</title>
	<meta
		name="description"
		content={`${data.siteName} ${$_("home.descriptionSuffix")}`}
	/>
	<link rel="canonical" href={data.canonicalUrl} />
	{#each data.alternateUrls as item}
		<link rel="alternate" hreflang={item.locale} href={item.url} />
	{/each}
	<link rel="alternate" hreflang="x-default" href={data.xDefaultUrl} />
	<meta property="og:type" content="website" />
	<meta
		property="og:title"
		content={`${data.siteName} - ${$_("home.titleSuffix")}`}
	/>
	<meta
		property="og:description"
		content={`${data.siteName} ${$_("home.descriptionSuffix")}`}
	/>
	<meta property="og:url" content={data.canonicalUrl} />
	<meta property="og:image" content={data.logoUrl} />
	<meta name="twitter:card" content="summary" />
	<meta
		name="twitter:title"
		content={`${data.siteName} - ${$_("home.titleSuffix")}`}
	/>
	<meta
		name="twitter:description"
		content={`${data.siteName} ${$_("home.descriptionSuffix")}`}
	/>
	<meta name="twitter:image" content={data.logoUrl} />
</svelte:head>

<AppHeader logoHref={`/${data.locale}`}>
	{#snippet actions()}
		{#if $session.data}
			<UserMenu onSignOut={() => {}} settingsHref={`/${data.locale}/settings`} />
		{:else if !$session.isPending}
			<Button size="sm" href={`/${data.locale}/login`}
				>{$_("home.cta.signIn")}</Button
			>
		{/if}
	{/snippet}
</AppHeader>

<main class="w-full">
	<!-- Hero -->
	<section
		class="flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-6 py-20"
	>
		<h1 class="text-hero-display text-center">{data.siteName}</h1>
		<p class="text-lead mt-4 max-w-2xl text-center text-muted-foreground">
			{$_("home.descriptionSuffix")}
		</p>
		<div class="mt-8 flex items-center gap-4">
			<Button href={`/${data.locale}/register`}
				>{$_("home.cta.getStarted")}</Button
			>
			{#if clientConfig.docsEnabled}
				<Button variant="outline" href={`/${data.locale}/docs`}
					>{$_("home.cta.learnMore")}</Button
				>
			{/if}
		</div>
	</section>
</main>
