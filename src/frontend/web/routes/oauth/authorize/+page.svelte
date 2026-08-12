<script lang="ts">
	import { onMount } from 'svelte'
	import { page } from '$app/stores'
	import { client } from '$apiContract/client'
	import { clientConfig } from '$frontend/config/client'
	import type { PublicRuntimeConfig } from '$backend/config'
	import LoginCard from '$frontend/app-ui/auth/LoginCard.svelte'
	import { Alert, AlertDescription } from '$frontend/ui/alert'
	import { Button } from '$frontend/ui/button'

	const session = client.auth.useSession()
	let { data }: { data: { publicRuntimeConfig: PublicRuntimeConfig } } = $props()
	let status = $state('Preparing authorization')
	let error = $state('')
	let completed = $state(false)

	onMount((): void => {
		void startAuthorization()
	})

	async function startAuthorization(): Promise<void> {
		const userCode: string | null = $page.url.searchParams.get('user_code')
		if (userCode) {
			const response: Response = await fetch('/api/oauth/resolve_authorization', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ user_code: userCode })
			})
			if (!response.ok) {
				error = 'This authorization request is invalid or expired'
				return
			}
			const body = (await response.json()) as { authorization_url: string }
			window.location.assign(body.authorization_url)
			return
		}

		if ($page.url.searchParams.has('sig')) {
			status = 'Sign in to continue'
			if ($session.data) {
				await continueOAuth()
			}
			return
		}
		error = 'Missing authorization request'
	}

	async function continueOAuth(): Promise<void> {
		status = 'Completing authorization'
		const response: Response = await fetch('/api/auth/oauth2/continue', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ postLogin: true })
		})
		if (!response.ok) {
			error = 'Authorization could not continue'
			return
		}
		completed = true
		status = 'Authorization completed'
	}
</script>

<svelte:head>
	<title>Authorize API access</title>
	<meta name="description" content={`Authorize API access to ${clientConfig.appName}`} />
</svelte:head>

<main class="mx-auto flex min-h-svh w-full max-w-lg items-center px-6 py-16">
	<div class="w-full space-y-6">
		<div>
			<p class="text-sm text-muted-foreground">{status}</p>
			<h1 class="mt-2 text-display-md">Authorize API access</h1>
			<p class="mt-3 text-muted-foreground">Sign in to review this connection</p>
		</div>

		{#if error}
			<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
		{:else if completed}
			<Alert><AlertDescription>You can close this window</AlertDescription></Alert>
		{:else if $page.url.searchParams.has('sig') && !$session.data}
			<LoginCard
				onSuccess={continueOAuth}
				registerHref="/en/register"
				forgotPasswordHref={data.publicRuntimeConfig.email_enabled ? '/en/forgot-password' : undefined}
				googleAuthEnabled={data.publicRuntimeConfig.google_auth_enabled}
				githubAuthEnabled={data.publicRuntimeConfig.github_auth_enabled}
				linuxdoAuthEnabled={data.publicRuntimeConfig.linuxdo_auth_enabled}
				emailSignupEnabled={data.publicRuntimeConfig.email_enabled && data.publicRuntimeConfig.email_signup_enabled}
				turnstileEnabled={data.publicRuntimeConfig.turnstile_enabled}
				turnstileSiteKey={data.publicRuntimeConfig.turnstile_site_key ?? ''}
			/>
		{:else}
			<Button disabled>Loading</Button>
		{/if}
	</div>
</main>
