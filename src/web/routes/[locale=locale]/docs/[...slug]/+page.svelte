<script lang="ts">
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
	import { _ } from '$web/i18n'

	let {
		data
	}: {
		data: {
			title: string
			description: string
			canonicalPath: string
			xDefaultPath: string
			locale: string
			contentHtml: string
			headings: Array<{ id: string; text: string; level: 2 | 3 }>
			localePaths: Array<{ locale: string; path: string }>
			previous: { slug: string; title: string } | null
			next: { slug: string; title: string } | null
		}
	} = $props()
</script>

<svelte:head>
	<title>{data.title}</title>
	<meta name="description" content={data.description} />
	<link rel="canonical" href={data.canonicalPath} />
	{#each data.localePaths as item}
		<link rel="alternate" hreflang={item.locale} href={item.path} />
	{/each}
	<link rel="alternate" hreflang="x-default" href={data.xDefaultPath} />
	<meta property="og:type" content="article" />
	<meta property="og:title" content={data.title} />
	<meta property="og:description" content={data.description} />
	<meta property="og:url" content={data.canonicalPath} />
</svelte:head>

<div class="mx-auto flex w-full max-w-5xl px-4 pb-10 pt-8 sm:px-8">
	<div class="min-w-0 flex-1">
		<h1 class="max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">
			{data.title}
		</h1>
		{#if data.description}
			<p class="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">
				{data.description}
			</p>
		{/if}

		<article class="docs-content mt-10">
			{@html data.contentHtml}
		</article>

		<nav class="mt-12 grid gap-4 pt-6 md:grid-cols-2">
			{#if data.previous}
				<a
					href={`/${data.locale}/docs/${data.previous.slug}`}
					class="group flex flex-col gap-1 py-3 transition-colors"
				>
					<span class="flex items-center gap-1.5 text-sm text-muted-foreground">
						<ChevronLeftIcon class="size-3.5" />
						{$_('docs.previous')}
					</span>
					<span class="text-sm font-medium group-hover:text-foreground">{data.previous.title}</span>
				</a>
			{:else}
				<div></div>
			{/if}

			{#if data.next}
				<a
					href={`/${data.locale}/docs/${data.next.slug}`}
					class="group flex flex-col gap-1 py-3 transition-colors md:items-end"
				>
					<span class="flex items-center gap-1.5 text-sm text-muted-foreground">
						{$_('docs.next')}
						<ChevronRightIcon class="size-3.5" />
					</span>
					<span class="text-sm font-medium group-hover:text-foreground">{data.next.title}</span>
				</a>
			{/if}
		</nav>
	</div>

	<aside class="hidden w-48 shrink-0 xl:block">
		<div class="sticky top-[3.25rem] max-h-[calc(100svh-4rem)] overflow-y-auto pl-6 pt-8">
			<p class="px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
				{$_('docs.onThisPage')}
			</p>
			<div class="mt-3 space-y-0.5">
				{#if data.headings.length === 0}
					<p class="px-2 text-sm text-muted-foreground">{$_('docs.noSections')}</p>
				{:else}
					{#each data.headings as heading}
						<a
							href={`#${heading.id}`}
							class={[
								'block rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted',
								heading.level === 3 ? 'ml-3 text-muted-foreground' : 'text-foreground/80'
							]}
						>
							{heading.text}
						</a>
					{/each}
				{/if}
			</div>
		</div>
	</aside>
</div>
