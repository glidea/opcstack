<script lang="ts">
	import { authClient } from '$web/auth/client'
	import { _ } from '$web/i18n'
	import { Button } from '$web/ui/button'
	import { Input } from '$web/ui/input'

	let {
		email,
		type = 'email-verification',
		onSuccess
	}: {
		email: string
		type?: 'email-verification' | 'forget-password'
		onSuccess?: () => void
	} = $props()

	let otp = $state('')
	let loading = $state(false)
	let error = $state('')
	let resending = $state(false)

	async function handleVerify(): Promise<void> {
		loading = true
		error = ''
		const result = await authClient.emailOtp.verifyEmail({ email, otp })
		loading = false
		if (result.error) {
			error = result.error.message ?? $_('auth.otp.submit')
			return
		}
		onSuccess?.()
	}

	async function handleResend(): Promise<void> {
		resending = true
		await authClient.emailOtp.sendVerificationOtp({ email, type })
		resending = false
	}
</script>

<div class="mx-auto w-full max-w-[380px] space-y-6">
	<div class="text-center">
		<h1 class="text-[28px] font-semibold tracking-tight">{$_('auth.otp.title')}</h1>
		<p class="mt-2 text-muted-foreground">
			{$_('auth.otp.subtitle', { values: { email } })}
		</p>
	</div>

	<form class="space-y-4" onsubmit={(e) => { e.preventDefault(); handleVerify() }}>
		{#if error}
			<p class="text-sm text-destructive">{error}</p>
		{/if}
		<Input
			type="text"
			placeholder="000000"
			bind:value={otp}
			maxlength={6}
			class="text-center text-[24px] tracking-[0.3em]"
			required
		/>
		<Button type="submit" class="w-full" disabled={loading}>
			{loading ? $_('auth.otp.submitting') : $_('auth.otp.submit')}
		</Button>
	</form>

	<p class="text-center text-sm text-muted-foreground">
		{$_('auth.otp.noCode')}
		<button
			type="button"
			class="text-primary hover:text-primary/80"
			onclick={handleResend}
			disabled={resending}
		>
			{resending ? $_('auth.otp.resending') : $_('auth.otp.resend')}
		</button>
	</p>
</div>

