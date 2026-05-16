<script lang="ts">
	import { goto } from '$app/navigation'
	import type { PublicConfig } from '$web/config/client'
	import AppHeader from '$web/components/AppHeader.svelte'
	import LoginCard from '$web/components/LoginCard.svelte'

	let {
		data
	}: {
		data: {
			locale: string
			publicConfig: PublicConfig
		}
	} = $props()

	function handleSuccess(): void {
		goto(`/${data.locale}`)
	}
</script>

<AppHeader logoHref={`/${data.locale}`} />

<main class="flex min-h-[calc(100svh-2.75rem)] items-center justify-center px-6 py-16">
	<LoginCard
		onSuccess={handleSuccess}
		registerHref={`/${data.locale}/register`}
		forgotPasswordHref={`/${data.locale}/forgot-password`}
		googleAuthEnabled={data.publicConfig.google_auth_enabled}
		emailEnabled={data.publicConfig.email_enabled}
		emailSignupEnabled={data.publicConfig.email_signup_enabled}
	/>
</main>
