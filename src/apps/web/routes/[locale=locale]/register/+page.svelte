<script lang="ts">
	import { goto } from '$app/navigation'
	import { clientConfig } from '$web/config/client'
	import AppHeader from '$web/components/AppHeader.svelte'
	import RegisterCard from '$web/components/RegisterCard.svelte'
	import OtpCard from '$web/components/OtpCard.svelte'

	let {
		data
	}: {
		data: {
			locale: string
		}
	} = $props()

	let pendingEmail = $state('')

	function handleRegisterSuccess(email: string): void {
		if (!clientConfig.emailRequireVerification) {
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
			emailUserActionCooldownSeconds={clientConfig.emailUserActionCooldownSeconds}
		/>
	{:else}
		<RegisterCard
			onSuccess={handleRegisterSuccess}
			loginHref={`/${data.locale}/login`}
			googleAuthEnabled={clientConfig.googleAuthEnabled}
			githubAuthEnabled={clientConfig.githubAuthEnabled}
			linuxdoAuthEnabled={clientConfig.linuxdoAuthEnabled}
			emailEnabled={clientConfig.emailEnabled}
			emailSignupEnabled={clientConfig.emailSignupEnabled}
			emailRequireVerification={clientConfig.emailRequireVerification}
			emailUserActionCooldownSeconds={clientConfig.emailUserActionCooldownSeconds}
			refundHref={clientConfig.paymentEnabled ? '/refund-policy' : undefined}
			turnstileEnabled={clientConfig.turnstileEnabled}
			turnstileSiteKey={clientConfig.turnstileSiteKey}
		/>
	{/if}
</main>
