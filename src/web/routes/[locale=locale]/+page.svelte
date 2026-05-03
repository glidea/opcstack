<script lang="ts">
	import { _ } from '$web/i18n'
	import AppHeader from '$web/components/AppHeader.svelte'

	let {
		data
	}: {
		data: {
			locale: string
			siteName: string
			logoUrl: string
			canonicalUrl: string
			alternateUrls: Array<{ locale: string; url: string }>
			xDefaultUrl: string
		}
	} = $props()
</script>

<svelte:head>
	<title>{data.siteName} - {$_('home.titleSuffix')}</title>
	<meta name="description" content={`${data.siteName} ${$_('home.descriptionSuffix')}`} />
	<link rel="canonical" href={data.canonicalUrl} />
	{#each data.alternateUrls as item}
		<link rel="alternate" hreflang={item.locale} href={item.url} />
	{/each}
	<link rel="alternate" hreflang="x-default" href={data.xDefaultUrl} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={`${data.siteName} - ${$_('home.titleSuffix')}`} />
	<meta property="og:description" content={`${data.siteName} ${$_('home.descriptionSuffix')}`} />
	<meta property="og:url" content={data.canonicalUrl} />
	<meta property="og:image" content={data.logoUrl} />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={`${data.siteName} - ${$_('home.titleSuffix')}`} />
	<meta name="twitter:description" content={`${data.siteName} ${$_('home.descriptionSuffix')}`} />
	<meta name="twitter:image" content={data.logoUrl} />
</svelte:head>

<AppHeader logoHref={`/${data.locale}`} />

<main
	class="mx-auto flex min-h-[calc(100svh-3.25rem)] w-full max-w-xl flex-col justify-center gap-6 px-6 py-16"
>
	<header class="space-y-2">
		<h1 class="text-4xl font-semibold tracking-tight">
			{data.siteName} - {$_('home.titleSuffix')}
		</h1>
		<p class="text-muted-foreground">{data.siteName} {$_('home.descriptionSuffix')}</p>
	</header>
</main>
