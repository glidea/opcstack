<script lang="ts">
	import { goto } from '$app/navigation'
	import { client } from '$apiContract/client'
	import type { ListAgentGrantsResponse } from '$apiContract/agent-auth'
	import AppHeader from '$frontend/app-ui/shell/AppHeader.svelte'
	import UserMenu from '$frontend/app-ui/shell/UserMenu.svelte'
	import { _ } from '$frontend/i18n'
	import { Button } from '$frontend/ui/button'

	let {
		data
	}: {
		data: { locale: string; siteName: string; canonicalUrl: string }
	} = $props()

	const session = client.auth.useSession()
	let grants = $state<ListAgentGrantsResponse['items']>([])
	let loading = $state(true)
	let error = $state('')

	$effect(() => {
		if (!$session.isPending && !$session.data) {
			void goto(`/${data.locale}/login`)
		}
	})

	$effect(() => {
		if ($session.data) {
			void loadGrants()
		}
	})

	async function loadGrants(): Promise<void> {
		const response = await fetch('/api/agent/list_grants', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{}'
		})
		if (!response.ok) {
			error = $_('settings.agents.error')
			loading = false
			return
		}
		const body = (await response.json()) as ListAgentGrantsResponse
		grants = body.items
		loading = false
	}

	async function revoke(grantId: string): Promise<void> {
		const response = await fetch('/api/agent/revoke_grant', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ grant_id: grantId })
		})
		if (response.ok) {
			await loadGrants()
		}
	}

	function handleSignOut(): void {
		void goto(`/${data.locale}/login`)
	}
</script>

<svelte:head>
	<title>{$_('settings.agents.title')} - {data.siteName}</title>
	<meta name="description" content={$_('settings.agents.description')} />
	<link rel="canonical" href={data.canonicalUrl} />
</svelte:head>

<AppHeader logoHref={`/${data.locale}`}>
	{#snippet actions()}
		{#if $session.data}
			<UserMenu onSignOut={handleSignOut} settingsHref={`/${data.locale}/settings`} />
		{/if}
	{/snippet}
</AppHeader>

<main class="min-h-[calc(100svh-3rem)] px-6 py-16">
	<div class="mx-auto w-full max-w-3xl">
		<h1 class="text-display-lg">{$_('settings.agents.title')}</h1>
		<p class="text-lead mt-3 max-w-xl text-muted-foreground">{$_('settings.agents.description')}</p>

		{#if error}
			<p class="mt-8 text-sm text-destructive">{error}</p>
		{:else if loading}
			<p class="mt-8 text-muted-foreground">Loading</p>
		{:else if grants.length === 0}
			<p class="mt-8 text-muted-foreground">{$_('settings.agents.empty')}</p>
		{:else}
			<div class="mt-8 divide-y divide-border border-y border-border">
				{#each grants as grant}
					<div class="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h2 class="font-medium">{grant.client_id}</h2>
							<p class="mt-2 text-sm text-muted-foreground">{grant.scopes.join(', ') || 'No application scopes'}</p>
							<p class="mt-1 text-xs text-muted-foreground">
								{grant.status === 'active' ? $_('settings.agents.active') : $_('settings.agents.revoked')}
							</p>
						</div>
						{#if grant.status === 'active'}
							<Button variant="destructive" size="sm" onclick={() => revoke(grant.id)}>
								{$_('settings.agents.revoke')}
							</Button>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</main>
