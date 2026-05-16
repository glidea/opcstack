<script lang="ts">
	import { authClient } from '$web/auth/client'
	import { _ } from '$web/i18n'
	import { Button } from '$web/ui/button'
	import { Input } from '$web/ui/input'

	let {
		onSuccess,
		loginHref = '/login',
		emailUserActionCooldownSeconds
	}: {
		onSuccess?: (email: string) => void
		loginHref?: string
		emailUserActionCooldownSeconds: number
	} = $props()

	let email = $state('')
	let loading = $state(false)
	let error = $state('')

	async function handleSubmit(): Promise<void> {
		loading = true
		error = ''
		const result = await authClient.emailOtp.sendVerificationOtp({
			email,
			type: 'forget-password'
		})
		loading = false
		if (result.error) {
			error = resolveEmailError(result.error, $_('auth.forgotPassword.submit'))
			return
		}
		onSuccess?.(email)
	}

	type AuthClientError = {
		code?: string
		message?: string
	}

	function resolveEmailError(authError: AuthClientError, fallback: string): string {
		switch (authError.code) {
			case 'EMAIL_DISABLED':
				return $_('auth.error.emailDisabled')
			case 'EMAIL_ACTION_RATE_LIMITED':
				return $_('auth.error.emailActionRateLimited', {
					values: { seconds: emailUserActionCooldownSeconds }
				})
			default:
				return authError.message ?? fallback
		}
	}
</script>

<div class="mx-auto w-full max-w-[380px] space-y-6">
	<div class="text-center">
		<h1 class="text-[28px] font-semibold tracking-tight">{$_('auth.forgotPassword.title')}</h1>
		<p class="mt-2 text-muted-foreground">{$_('auth.forgotPassword.subtitle')}</p>
	</div>

	<form class="space-y-4" onsubmit={(e) => { e.preventDefault(); handleSubmit() }}>
		{#if error}
			<p class="text-sm text-destructive">{error}</p>
		{/if}
		<Input type="email" placeholder={$_('auth.forgotPassword.email')} bind:value={email} required />
		<Button type="submit" class="w-full" disabled={loading}>
			{loading ? $_('auth.forgotPassword.submitting') : $_('auth.forgotPassword.submit')}
		</Button>
	</form>

	<p class="text-center text-sm text-muted-foreground">
		<a href={loginHref} class="text-primary hover:text-primary/80">
			{$_('auth.forgotPassword.backToSignIn')}
		</a>
	</p>
</div>
