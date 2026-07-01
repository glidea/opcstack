<script lang="ts">
	import { client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import { Alert, AlertDescription } from '$frontend/ui/alert'
	import { Button } from '$frontend/ui/button'
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert'
	import OtpInput from './OtpInput.svelte'

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

	async function handleVerify(): Promise<void> {
		loading = true
		error = ''
		const result = await client.auth.emailOtp.verifyEmail({ email, otp })
		loading = false
		if (result.error) {
			error = result.error.message ?? $_('auth.otp.submit')
			return
		}
		onSuccess?.()
	}

	async function handleResend(): Promise<void> {
		resending = true
		error = ''
		const result = await client.auth.emailOtp.sendVerificationOtp({ email, type })
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
			<Alert variant="destructive">
				<CircleAlertIcon />
				<AlertDescription>{error}</AlertDescription>
			</Alert>
		{/if}
		<OtpInput bind:value={otp} disabled={loading} label={$_('auth.otp.title')} />
		<Button type="submit" class="w-full" disabled={loading || otp.length !== 6}>
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
