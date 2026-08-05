<script lang="ts">
	import { page } from '$app/stores'
	import { Alert, AlertDescription } from '$frontend/ui/alert'
	import { Button } from '$frontend/ui/button'

	let loading = $state(false)
	let error = $state('')

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

	const requestedScopes = $derived(($page.url.searchParams.get('scope') ?? 'agent offline_access').split(' '))
</script>

<svelte:head>
	<title>Agent Consent</title>
	<meta name="description" content="Review Agent access" />
</svelte:head>

<main class="mx-auto flex min-h-svh w-full max-w-lg items-center px-6 py-16">
	<div class="w-full space-y-6">
		<p class="text-sm text-muted-foreground">Connected Agent</p>
		<h1 class="text-display-md">Allow access</h1>
		<p class="text-muted-foreground">This Agent requests the following permissions</p>
		<ul class="list-disc space-y-2 pl-6">
			{#each requestedScopes as scope}
				<li>{scope}</li>
			{/each}
		</ul>
		{#if error}
			<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
		{/if}
		<div class="flex gap-3">
			<Button variant="outline" disabled={loading} onclick={() => submit(false)}>Deny</Button>
			<Button disabled={loading} onclick={() => submit(true)}>Allow</Button>
		</div>
	</div>
</main>
