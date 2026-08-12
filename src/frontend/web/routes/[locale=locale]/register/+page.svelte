<script lang="ts">
	import { goto } from '$app/navigation'
	import { clientConfig } from '$frontend/config/client'
	import type { PublicRuntimeConfig } from '$backend/config'
	import AppHeader from '$frontend/app-ui/shell/AppHeader.svelte'
	import RegisterCard from '$frontend/app-ui/auth/RegisterCard.svelte'
	import OtpCard from '$frontend/app-ui/auth/OtpCard.svelte'

	let {
		data
	}: {
		data: {
			locale: string
			publicRuntimeConfig: PublicRuntimeConfig
		}
	} = $props()

	let pendingEmail = $state('')

	function handleRegisterSuccess(email: string): void {
		if (!data.publicRuntimeConfig.email_require_verification) {
			goto(`/${data.locale}`)
			return
		}
		pendingEmail = email
	}

	function handleOtpSuccess(): void {
		goto(`/${data.locale}`)
	}
</script>

<AppHeader logoHref={`/${data.locale}`} />

<main class="flex min-h-[calc(100svh-3rem)] items-center justify-center px-6 py-16">
	{#if pendingEmail}
		<OtpCard
			email={pendingEmail}
			onSuccess={handleOtpSuccess}
			emailUserActionCooldownSeconds={data.publicRuntimeConfig.email_user_action_cooldown_seconds}
		/>
	{:else}
		<RegisterCard
			onSuccess={handleRegisterSuccess}
			loginHref={`/${data.locale}/login`}
			googleAuthEnabled={data.publicRuntimeConfig.google_auth_enabled}
			githubAuthEnabled={data.publicRuntimeConfig.github_auth_enabled}
			linuxdoAuthEnabled={data.publicRuntimeConfig.linuxdo_auth_enabled}
			emailSignupEnabled={data.publicRuntimeConfig.email_enabled && data.publicRuntimeConfig.email_signup_enabled}
			emailRequireVerification={data.publicRuntimeConfig.email_require_verification}
			emailUserActionCooldownSeconds={data.publicRuntimeConfig.email_user_action_cooldown_seconds}
			refundHref={clientConfig.paymentEnabled ? '/refund-policy' : undefined}
			turnstileEnabled={data.publicRuntimeConfig.turnstile_enabled}
			turnstileSiteKey={data.publicRuntimeConfig.turnstile_site_key ?? ''}
		/>
	{/if}
</main>
