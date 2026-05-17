<script lang="ts">
	import { authClient, setAuthToken } from '$web/auth/client'
	import { _ } from '$web/i18n'
	import { Button } from '$web/ui/button'
	import { Input } from '$web/ui/input'

	let {
		email,
		type = 'email-verification',
		onSuccess,
		emailUserActionCooldownSeconds
	}: {
		email: string
		type?: 'email-verification' | 'forget-password'
		onSuccess?: () => void
		emailUserActionCooldownSeconds: number
	} = $props()

	let otp = $state('')
	let loading = $state(false)
	let error = $state('')
	let resending = $state(false)
	let resendCooldownLeft = $state(0)
	let cooldownTimer: ReturnType<typeof setInterval> | undefined = undefined

	type OtpVerifyResultData = {
		token?: string | null
	}

	async function handleVerify(): Promise<void> {
		loading = true
		error = ''
		const result = await authClient.emailOtp.verifyEmail({ email, otp })
		loading = false
		if (result.error) {
			error = result.error.message ?? $_('auth.otp.submit')
			return
		}
		const data = result.data as OtpVerifyResultData | null
		const token: string = data?.token ?? ''
		if (token !== '') {
			setAuthToken(token)
		}
		onSuccess?.()
	}

	async function handleResend(): Promise<void> {
		resending = true
		error = ''
		const result = await authClient.emailOtp.sendVerificationOtp({ email, type })
		resending = false
		if (result.error) {
			error = resolveEmailError(result.error, $_('auth.otp.resend'))
			if (result.error.code === 'EMAIL_ACTION_RATE_LIMITED') {
				startResendCooldown()
			}
			return
		}
		startResendCooldown()
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

	function startResendCooldown(): void {
		resendCooldownLeft = emailUserActionCooldownSeconds
		if (cooldownTimer) {
			clearInterval(cooldownTimer)
		}
		cooldownTimer = setInterval((): void => {
			resendCooldownLeft -= 1
			if (resendCooldownLeft <= 0 && cooldownTimer) {
				clearInterval(cooldownTimer)
				cooldownTimer = undefined
			}
		}, 1000)
	}

	$effect(() => {
		return (): void => {
			if (cooldownTimer) {
				clearInterval(cooldownTimer)
			}
		}
	})
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
			disabled={resending || resendCooldownLeft > 0}
		>
			{#if resending}
				{$_('auth.otp.resending')}
			{:else if resendCooldownLeft > 0}
				{$_('auth.otp.resendIn', { values: { seconds: resendCooldownLeft } })}
			{:else}
				{$_('auth.otp.resend')}
			{/if}
		</button>
	</p>
</div>
