<script lang="ts">
	import { client } from '$frontend/api-client'
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
		registerHref = '/register',
		forgotPasswordHref = '/forgot-password',
		googleAuthEnabled,
		githubAuthEnabled,
		linuxdoAuthEnabled,
		emailEnabled,
		emailSignupEnabled,
		termsHref = '/terms',
		privacyHref = '/privacy',
		refundHref,
		showLegal = true,
		turnstileEnabled = false,
		turnstileSiteKey = ''
	}: {
		onSuccess?: () => void
		registerHref?: string
		forgotPasswordHref?: string
		googleAuthEnabled: boolean
		githubAuthEnabled: boolean
		linuxdoAuthEnabled: boolean
		emailEnabled: boolean
		emailSignupEnabled: boolean
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

	async function handleEmailLogin(): Promise<void> {
		if (turnstileEnabled && turnstileToken === '') {
			error = $_('auth.error.turnstileRequired')
			return
		}
		loading = true
		error = ''
		const result = await client.auth.signIn.email({ email, password }, buildCaptchaFetchOptions())
		loading = false
		if (result.error) {
			turnstileRef?.reset()
			error = resolveCaptchaError(result.error, $_('auth.login.submit'))
			return
		}
		onSuccess?.()
	}

	async function handleGoogleLogin(): Promise<void> {
		await client.auth.signIn.social({ provider: 'google' })
	}

	async function handleGithubLogin(): Promise<void> {
		await client.auth.signIn.social({ provider: 'github' })
	}

	async function handleLinuxDoLogin(): Promise<void> {
		await client.auth.signIn.oauth2({ providerId: 'linuxdo' })
	}

	type AuthClientError = {
		code?: string
		message?: string
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

	function resolveCaptchaError(authError: AuthClientError, fallback: string): string {
		switch (authError.code) {
			case 'MISSING_RESPONSE':
				return $_('auth.error.turnstileRequired')
			case 'VERIFICATION_FAILED':
				return $_('auth.error.turnstileFailed')
			default:
				return authError.message ?? fallback
		}
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

	{#if githubAuthEnabled}
		<Button variant="secondary" class="w-full" onclick={handleGithubLogin}>
			<GitHubIcon />
			{$_('auth.continueWithGitHub')}
		</Button>
	{/if}

	{#if linuxdoAuthEnabled}
		<Button variant="secondary" class="w-full" onclick={handleLinuxDoLogin}>
			{$_('auth.continueWithLinuxDO')}
		</Button>
	{/if}

	{#if (googleAuthEnabled || githubAuthEnabled || linuxdoAuthEnabled) && emailEnabled}
		<div class="flex items-center gap-3">
			<div class="h-px flex-1 bg-border"></div>
			<span class="text-sm text-muted-foreground">{$_('auth.or')}</span>
			<div class="h-px flex-1 bg-border"></div>
		</div>
	{/if}

	{#if emailEnabled}
		<form class="space-y-4" onsubmit={(e) => { e.preventDefault(); handleEmailLogin() }}>
			{#if error}
				<Alert variant="destructive">
					<CircleAlertIcon />
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			{/if}
			<Field>
				<FieldLabel for="login-email">{$_('auth.login.email')}</FieldLabel>
				<Input id="login-email" type="email" autocomplete="email" bind:value={email} required />
			</Field>
			<Field>
				<FieldLabel for="login-password">{$_('auth.login.password')}</FieldLabel>
				<Input id="login-password" type="password" autocomplete="current-password" bind:value={password} required />
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
				{loading ? $_('auth.login.submitting') : $_('auth.login.submit')}
			</Button>
		</form>
	{/if}

	{#if emailEnabled || googleAuthEnabled || githubAuthEnabled}
		<div class="flex items-center justify-between text-sm">
			{#if emailEnabled}
				<a href={forgotPasswordHref} class="text-muted-foreground hover:text-foreground">
					{$_('auth.login.forgotPassword')}
				</a>
			{/if}
			{#if googleAuthEnabled || githubAuthEnabled || linuxdoAuthEnabled || (emailEnabled && emailSignupEnabled)}
				<a href={registerHref} class="text-primary hover:text-primary/80">
					{$_('auth.login.createAccount')}
				</a>
			{/if}
		</div>
	{/if}

	{#if showLegal && (googleAuthEnabled || githubAuthEnabled || linuxdoAuthEnabled || emailEnabled)}
		<LegalDisclosure intent="continue" {termsHref} {privacyHref} {refundHref} />
	{/if}
</div>
