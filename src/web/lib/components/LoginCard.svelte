<script lang="ts">
	import { authClient, setAuthToken } from '$web/auth/client'
	import { _ } from '$web/i18n'
	import { Button } from '$web/ui/button'
	import { Input } from '$web/ui/input'
	import GoogleIcon from './GoogleIcon.svelte'

	type EmailLoginResultData = {
		token?: string
	}

	let {
		onSuccess,
		registerHref = '/register',
		forgotPasswordHref = '/forgot-password',
		googleAuthEnabled,
		emailEnabled,
		emailSignupEnabled
	}: {
		onSuccess?: () => void
		registerHref?: string
		forgotPasswordHref?: string
		googleAuthEnabled: boolean
		emailEnabled: boolean
		emailSignupEnabled: boolean
	} = $props()

	let email = $state('')
	let password = $state('')
	let loading = $state(false)
	let error = $state('')

	async function handleEmailLogin(): Promise<void> {
		loading = true
		error = ''
		const result = await authClient.signIn.email({ email, password })
		loading = false
		if (result.error) {
			error = result.error.message ?? $_('auth.login.submit')
			return
		}
		const data = result.data as EmailLoginResultData | null
		const token: string = data?.token ?? ''
		if (token === '') {
			error = $_('auth.login.submit')
			return
		}
		setAuthToken(token)
		onSuccess?.()
	}

	async function handleGoogleLogin(): Promise<void> {
		await authClient.signIn.social({ provider: 'google' })
	}
</script>

<div class="mx-auto w-full max-w-[380px] space-y-6">
	<div class="text-center">
		<h1 class="text-[28px] font-semibold tracking-tight">{$_('auth.login.title')}</h1>
		<p class="mt-2 text-muted-foreground">{$_('auth.login.subtitle')}</p>
	</div>

	{#if googleAuthEnabled}
		<Button variant="secondary" class="w-full" onclick={handleGoogleLogin}>
			<GoogleIcon />
			{$_('auth.continueWithGoogle')}
		</Button>
	{/if}

	{#if googleAuthEnabled && emailEnabled}
		<div class="flex items-center gap-3">
			<div class="h-px flex-1 bg-border"></div>
			<span class="text-sm text-muted-foreground">{$_('auth.or')}</span>
			<div class="h-px flex-1 bg-border"></div>
		</div>
	{/if}

	{#if emailEnabled}
		<form class="space-y-4" onsubmit={(e) => { e.preventDefault(); handleEmailLogin() }}>
			{#if error}
				<p class="text-sm text-destructive">{error}</p>
			{/if}
			<Input type="email" placeholder={$_('auth.login.email')} bind:value={email} required />
			<Input type="password" placeholder={$_('auth.login.password')} bind:value={password} required />
			<Button type="submit" class="w-full" disabled={loading}>
				{loading ? $_('auth.login.submitting') : $_('auth.login.submit')}
			</Button>
		</form>
	{/if}

	{#if emailEnabled || googleAuthEnabled}
		<div class="flex items-center justify-between text-sm">
			{#if emailEnabled}
				<a href={forgotPasswordHref} class="text-muted-foreground hover:text-foreground">
					{$_('auth.login.forgotPassword')}
				</a>
			{/if}
			{#if googleAuthEnabled || (emailEnabled && emailSignupEnabled)}
				<a href={registerHref} class="text-primary hover:text-primary/80">
					{$_('auth.login.createAccount')}
				</a>
			{/if}
		</div>
	{/if}
</div>
