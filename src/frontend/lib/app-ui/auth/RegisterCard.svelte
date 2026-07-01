<script lang="ts">
	import { client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import { Alert, AlertDescription } from '$frontend/ui/alert'
	import { Button } from '$frontend/ui/button'
	import { Field, FieldLabel } from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert'
	import GitHubIcon from './GitHubIcon.svelte'
	import GoogleIcon from './GoogleIcon.svelte'
	import LegalDisclosure from './LegalDisclosure.svelte'
	import Turnstile from './Turnstile.svelte'

	let {
		onSuccess,
		loginHref = '/login',
		googleAuthEnabled,
		githubAuthEnabled,
		linuxdoAuthEnabled,
		emailEnabled,
		emailSignupEnabled,
		emailRequireVerification,
		emailUserActionCooldownSeconds,
		termsHref = '/terms',
		privacyHref = '/privacy',
		refundHref,
		showLegal = true,
		turnstileEnabled = false,
		turnstileSiteKey = ''
	}: {
		onSuccess?: (email: string) => void
		loginHref?: string
		googleAuthEnabled: boolean
		githubAuthEnabled: boolean
		linuxdoAuthEnabled: boolean
		emailEnabled: boolean
		emailSignupEnabled: boolean
		emailRequireVerification: boolean
		emailUserActionCooldownSeconds: number
		termsHref?: string
		privacyHref?: string
		refundHref?: string
		showLegal?: boolean
		turnstileEnabled?: boolean
		turnstileSiteKey?: string
	} = $props()

	let email = $state('')
	let password = $state('')
	let loading = $state(false)
	let error = $state('')
	let turnstileToken = $state('')
	let turnstileRef: Turnstile | undefined = $state()

	async function handleRegister(): Promise<void> {
		if (turnstileEnabled && turnstileToken === '') {
			error = $_('auth.error.turnstileRequired')
			return
		}
		loading = true
		error = ''
		const result = await client.auth.signUp.email(
			{ email, password, name: email },
			buildCaptchaFetchOptions()
		)
		if (result.error) {
			loading = false
			turnstileRef?.reset()
			error = resolveEmailError(result.error, $_('auth.register.submit'))
			return
		}
		if (!emailRequireVerification) {
			loading = false
			onSuccess?.(email)
			return
		}
		const otpResult = await client.auth.emailOtp.sendVerificationOtp({
			email,
			type: 'email-verification'
		})
		loading = false
		if (otpResult.error) {
			error = resolveEmailError(otpResult.error, $_('auth.register.submit'))
			return
		}
		onSuccess?.(email)
	}

	async function handleGoogleSignup(): Promise<void> {
		await client.auth.signIn.social({ provider: 'google' })
	}

	async function handleGithubSignup(): Promise<void> {
		await client.auth.signIn.social({ provider: 'github' })
	}

	async function handleLinuxDoSignup(): Promise<void> {
		await client.auth.signIn.oauth2({ providerId: 'linuxdo' })
	}

	type AuthClientError = {
		code?: string
		message?: string
	}

	function resolveEmailError(authError: AuthClientError, fallback: string): string {
		switch (authError.code) {
			case 'EMAIL_DISABLED':
				return $_('auth.error.emailDisabled')
			case 'EMAIL_SIGNUP_DISABLED':
				return $_('auth.error.emailSignupDisabled')
			case 'EMAIL_DOMAIN_NOT_ALLOWED':
				return $_('auth.error.emailDomainNotAllowed')
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
		<h1 class="text-[28px] font-semibold tracking-tight">{$_('auth.register.title')}</h1>
	</div>

	{#if googleAuthEnabled}
		<Button variant="secondary" class="w-full" onclick={handleGoogleSignup}>
			<GoogleIcon />
			{$_('auth.continueWithGoogle')}
		</Button>
	{/if}

	{#if githubAuthEnabled}
		<Button variant="secondary" class="w-full" onclick={handleGithubSignup}>
			<GitHubIcon />
			{$_('auth.continueWithGitHub')}
		</Button>
	{/if}

	{#if linuxdoAuthEnabled}
		<Button variant="secondary" class="w-full" onclick={handleLinuxDoSignup}>
			{$_('auth.continueWithLinuxDO')}
		</Button>
	{/if}

	{#if (googleAuthEnabled || githubAuthEnabled || linuxdoAuthEnabled) && emailEnabled && emailSignupEnabled}
		<div class="flex items-center gap-3">
			<div class="h-px flex-1 bg-border"></div>
			<span class="text-sm text-muted-foreground">{$_('auth.or')}</span>
			<div class="h-px flex-1 bg-border"></div>
		</div>
	{/if}

	{#if emailEnabled && emailSignupEnabled}
		<form class="space-y-4" onsubmit={(e) => { e.preventDefault(); handleRegister() }}>
			{#if error}
				<Alert variant="destructive">
					<CircleAlertIcon />
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			{/if}
			<Field>
				<FieldLabel for="register-email">{$_('auth.register.email')}</FieldLabel>
				<Input id="register-email" type="email" autocomplete="email" bind:value={email} required />
			</Field>
			<Field>
				<FieldLabel for="register-password">{$_('auth.register.password')}</FieldLabel>
				<Input id="register-password" type="password" autocomplete="new-password" bind:value={password} required />
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
				{loading ? $_('auth.register.submitting') : $_('auth.register.submit')}
			</Button>
		</form>
	{/if}

	{#if showLegal && (googleAuthEnabled || githubAuthEnabled || linuxdoAuthEnabled || (emailEnabled && emailSignupEnabled))}
		<LegalDisclosure intent="register" {termsHref} {privacyHref} {refundHref} />
	{/if}

	<p class="text-center text-sm text-muted-foreground">
		{$_('auth.register.haveAccount')}
		<a href={loginHref} class="text-primary hover:text-primary/80">{$_('auth.register.signIn')}</a>
	</p>
</div>
