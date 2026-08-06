<script lang="ts">
	import { onMount } from 'svelte'
	import { page } from '$app/stores'
	import type { GetAgentAuthorizationDetailsResponse } from '$apiContract/agent-auth'
	import { Alert, AlertDescription } from '$frontend/ui/alert'
	import { Button } from '$frontend/ui/button'

	let loading = $state(false)
	let detailsLoading = $state(true)
	let error = $state('')
	let clientId = $state('opcstack-agent')
	let requestedScopes = $state<string[]>([])
	let expiresIn = $state(0)

	onMount((): void => {
		void loadDetails()
	})

	async function loadDetails(): Promise<void> {
		const state = $page.url.searchParams.get('state')
		if (!state) {
			error = 'Missing authorization request'
			detailsLoading = false
			return
		}

		const response = await fetch('/api/agent/get_authorization_details', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ state })
		})
		if (!response.ok) {
			error = 'This authorization request is invalid or expired'
			detailsLoading = false
			return
		}
		const body = (await response.json()) as GetAgentAuthorizationDetailsResponse
		clientId = body.client_id
		requestedScopes = body.scopes
		expiresIn = body.expires_in
		detailsLoading = false
	}

	async function submit(accept: boolean): Promise<void> {
		loading = true
		const response = await fetch('/api/auth/oauth2/consent', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ accept })
		})
		if (!response.ok) {
			error = 'Consent could not be saved'
			loading = false
			return
		}
		window.location.assign(response.url)
	}
</script>

<svelte:head>
	<title>Agent Consent</title>
	<meta name="description" content="Review Agent access" />
</svelte:head>

<main class="mx-auto flex min-h-svh w-full max-w-lg items-center px-6 py-16">
	<div class="w-full space-y-6">
		<p class="text-sm text-muted-foreground">Connected Agent</p>
		<h1 class="text-display-md">Allow access</h1>
		{#if detailsLoading}
			<p class="text-muted-foreground">Loading authorization request</p>
		{:else}
			<p class="text-muted-foreground">{clientId} requests access to these application permissions</p>
			{#if requestedScopes.length === 0}
				<p class="text-sm text-muted-foreground">No application permissions requested</p>
			{:else}
				<ul class="list-disc space-y-2 pl-6">
					{#each requestedScopes as scope}
						<li>{scope}</li>
					{/each}
				</ul>
			{/if}
			<p class="text-xs text-muted-foreground">Request expires in {expiresIn} seconds</p>
		{/if}
		{#if error}
			<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
		{/if}
		<div class="flex gap-3">
			<Button variant="outline" disabled={loading || detailsLoading || error !== ''} onclick={() => submit(false)}>Deny</Button>
			<Button disabled={loading || detailsLoading || error !== ''} onclick={() => submit(true)}>Allow</Button>
		</div>
	</div>
</main>
