<script lang="ts">
	import { authClient } from '$web/auth/client'
	import { _ } from '$web/i18n'
	import { Button } from '$web/ui/button'
	import { Input } from '$web/ui/input'
	import GoogleIcon from './GoogleIcon.svelte'

	let {
		onSuccess,
		loginHref = '/login'
	}: {
		onSuccess?: (email: string) => void
		loginHref?: string
	} = $props()

	let email = $state('')
	let password = $state('')
	let loading = $state(false)
	let error = $state('')

	async function handleRegister(): Promise<void> {
		loading = true
		error = ''
		const result = await authClient.signUp.email({ email, password, name: email })
		loading = false
		if (result.error) {
			error = result.error.message ?? $_('auth.register.submit')
			return
		}
		onSuccess?.(email)
	}

	async function handleGoogleSignup(): Promise<void> {
		await authClient.signIn.social({ provider: 'google' })
	}
</script>

<div class="mx-auto w-full max-w-[380px] space-y-6">
	<div class="text-center">
		<h1 class="text-[28px] font-semibold tracking-tight">{$_('auth.register.title')}</h1>
	</div>

	<Button variant="secondary" class="w-full" onclick={handleGoogleSignup}>
		<GoogleIcon />
		{$_('auth.continueWithGoogle')}
	</Button>

	<div class="flex items-center gap-3">
		<div class="h-px flex-1 bg-border"></div>
		<span class="text-sm text-muted-foreground">{$_('auth.or')}</span>
		<div class="h-px flex-1 bg-border"></div>
	</div>

	<form class="space-y-4" onsubmit={(e) => { e.preventDefault(); handleRegister() }}>
		{#if error}
			<p class="text-sm text-destructive">{error}</p>
		{/if}
		<Input type="email" placeholder={$_('auth.register.email')} bind:value={email} required />
		<Input type="password" placeholder={$_('auth.register.password')} bind:value={password} required />
		<Button type="submit" class="w-full" disabled={loading}>
			{loading ? $_('auth.register.submitting') : $_('auth.register.submit')}
		</Button>
	</form>

	<p class="text-center text-sm text-muted-foreground">
		{$_('auth.register.haveAccount')}
		<a href={loginHref} class="text-primary hover:text-primary/80">{$_('auth.register.signIn')}</a>
	</p>
</div>

