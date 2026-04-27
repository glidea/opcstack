<script lang="ts">
	import { _ } from '$web/i18n'
	import AppHeader from '$web/components/AppHeader.svelte'

	let { data }: { data: { locale: string } } = $props()
</script>

<svelte:head>
	<title>{$_('home.title')}</title>
</svelte:head>

<AppHeader logoHref={`/${data.locale}`} />

<main class="mx-auto flex min-h-[calc(100svh-3.25rem)] w-full max-w-xl flex-col justify-center gap-6 px-6 py-16">
	<header class="space-y-2">
		<h1 class="text-4xl font-semibold tracking-tight">
			{$_('home.title')}
		</h1>
		<p class="text-muted-foreground">{$_('home.subtitle')}</p>
	</header>
</main>
