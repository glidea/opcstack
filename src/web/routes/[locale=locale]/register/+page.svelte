<script lang="ts">
	import { goto } from '$app/navigation'
	import type { PublicConfig } from '$web/config/client'
	import AppHeader from '$web/components/AppHeader.svelte'
	import RegisterCard from '$web/components/RegisterCard.svelte'
	import OtpCard from '$web/components/OtpCard.svelte'

	let {
		data
	}: {
		data: {
			locale: string
			publicConfig: PublicConfig
		}
	} = $props()

	let pendingEmail = $state('')

	function handleRegisterSuccess(email: string): void {
		if (!data.publicConfig.email_require_verification) {
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
			emailUserActionCooldownSeconds={data.publicConfig.email_user_action_cooldown_seconds}
		/>
	{:else}
		<RegisterCard
			onSuccess={handleRegisterSuccess}
			loginHref={`/${data.locale}/login`}
			googleAuthEnabled={data.publicConfig.google_auth_enabled}
			emailEnabled={data.publicConfig.email_enabled}
			emailSignupEnabled={data.publicConfig.email_signup_enabled}
			emailUserActionCooldownSeconds={data.publicConfig.email_user_action_cooldown_seconds}
			refundHref={data.publicConfig.payment_enabled ? '/refund-policy' : undefined}
			turnstileEnabled={data.publicConfig.turnstile_enabled}
			turnstileSiteKey={data.publicConfig.turnstile_site_key}
		/>
	{/if}
</main>
