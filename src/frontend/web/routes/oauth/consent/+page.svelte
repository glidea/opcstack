<script lang="ts">
	import { onMount } from 'svelte'
	import { page } from '$app/stores'
	import type { GetOAuthAuthorizationDetailsResponse } from '$apiContract/oauth-api-access'
	import { Alert, AlertDescription } from '$frontend/ui/alert'
	import { Button } from '$frontend/ui/button'

	let loading = $state(false)
	let detailsLoading = $state(true)
	let error = $state('')
	let clientName = $state('OPC CLI')
	let targetOrigin = $state('')
	let requestedScopes = $state<string[]>([])
	let expiresIn = $state(0)

	onMount((): void => {
		void loadDetails()
	})

	async function loadDetails(): Promise<void> {
		const state: string | null = $page.url.searchParams.get('state')
		if (!state) {
			error = 'Missing authorization request'
			detailsLoading = false
			return
		}
		const response: Response = await fetch('/api/oauth/get_authorization_details', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ state })
		})
		if (!response.ok) {
			error = 'This authorization request is invalid or expired'
			detailsLoading = false
			return
		}
		const body = (await response.json()) as GetOAuthAuthorizationDetailsResponse
		clientName = body.client_name
		targetOrigin = body.target_origin
		requestedScopes = body.scopes
		expiresIn = body.expires_in
		detailsLoading = false
	}

	async function submit(accept: boolean): Promise<void> {
		loading = true
		const response: Response = await fetch('/api/auth/oauth2/consent', {
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
	<title>API access consent</title>
	<meta name="description" content="Review requested API access" />
</svelte:head>

<main class="mx-auto flex min-h-svh w-full max-w-lg items-center px-6 py-16">
	<div class="w-full space-y-6">
		<p class="text-sm text-muted-foreground">API access request</p>
		<h1 class="text-display-md">Allow access</h1>
		{#if detailsLoading}
			<p class="text-muted-foreground">Loading authorization request</p>
		{:else}
			<div class="space-y-2">
				<p><span class="text-muted-foreground">Client</span> {clientName}</p>
				<p><span class="text-muted-foreground">Project</span> {targetOrigin}</p>
			</div>
			<ul class="list-disc space-y-2 pl-6">
				{#each requestedScopes as scope}
					<li>{scope}</li>
				{/each}
			</ul>
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
