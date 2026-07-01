<script lang="ts">
	import { client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import { Alert, AlertDescription } from '$frontend/ui/alert'
	import { Button } from '$frontend/ui/button'
	import { Field, FieldLabel } from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert'
	import Turnstile from './Turnstile.svelte'

	let {
		onSuccess,
		loginHref = '/login',
		emailUserActionCooldownSeconds,
		turnstileEnabled = false,
		turnstileSiteKey = ''
	}: {
		onSuccess?: (email: string) => void
		loginHref?: string
		emailUserActionCooldownSeconds: number
		turnstileEnabled?: boolean
		turnstileSiteKey?: string
	} = $props()

	let email = $state('')
	let loading = $state(false)
	let error = $state('')
	let turnstileToken = $state('')
	let turnstileRef: Turnstile | undefined = $state()

	async function handleSubmit(): Promise<void> {
		if (turnstileEnabled && turnstileToken === '') {
			error = $_('auth.error.turnstileRequired')
			return
		}
		loading = true
		error = ''
		const result = await client.auth.emailOtp.requestPasswordReset(
			{ email },
			buildCaptchaFetchOptions()
		)
		loading = false
		if (result.error) {
			turnstileRef?.reset()
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
			case 'MISSING_RESPONSE':
				return $_('auth.error.turnstileRequired')
			case 'VERIFICATION_FAILED':
				return $_('auth.error.turnstileFailed')
			default:
				return authError.message ?? fallback
		}
	}

	function buildCaptchaFetchOptions(): { headers: { 'x-captcha-response': string } } | undefined {
		if (!turnstileEnabled) {
			return undefined
		}

		return {
			headers: {
				'x-captcha-response': turnstileToken
			}
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
			<Alert variant="destructive">
				<CircleAlertIcon />
				<AlertDescription>{error}</AlertDescription>
			</Alert>
		{/if}
		<Field>
			<FieldLabel for="forgot-email">{$_('auth.forgotPassword.email')}</FieldLabel>
			<Input id="forgot-email" type="email" autocomplete="email" bind:value={email} required />
		</Field>
		{#if turnstileEnabled}
			<Turnstile
				bind:this={turnstileRef}
				siteKey={turnstileSiteKey}
				onToken={(token: string): void => { turnstileToken = token }}
				onReset={(): void => { turnstileToken = '' }}
			/>
		{/if}
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
