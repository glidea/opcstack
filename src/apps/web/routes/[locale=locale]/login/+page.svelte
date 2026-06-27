<script lang="ts">
	import { goto } from '$app/navigation'
	import { clientConfig } from '$web/config/client'
	import AppHeader from '$web/components/AppHeader.svelte'
	import LoginCard from '$web/components/LoginCard.svelte'

	let {
		data
	}: {
		data: {
			locale: string
		}
	} = $props()

	function handleSuccess(): void {
		goto(`/${data.locale}`)
	}
</script>

<AppHeader logoHref={`/${data.locale}`} />

<main class="flex min-h-[calc(100svh-3rem)] items-center justify-center px-6 py-16">
	<LoginCard
		onSuccess={handleSuccess}
		registerHref={`/${data.locale}/register`}
		forgotPasswordHref={`/${data.locale}/forgot-password`}
		googleAuthEnabled={clientConfig.googleAuthEnabled}
		githubAuthEnabled={clientConfig.githubAuthEnabled}
		linuxdoAuthEnabled={clientConfig.linuxdoAuthEnabled}
		emailEnabled={clientConfig.emailEnabled}
		emailSignupEnabled={clientConfig.emailSignupEnabled}
		refundHref={clientConfig.paymentEnabled ? '/refund-policy' : undefined}
		turnstileEnabled={clientConfig.turnstileEnabled}
		turnstileSiteKey={clientConfig.turnstileSiteKey}
	/>
</main>
