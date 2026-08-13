<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import type { PublicRuntimeConfig } from '$backend/config'
	import AppHeader from '$frontend/app-ui/shell/AppHeader.svelte'
	import LoginCard from '$frontend/app-ui/auth/LoginCard.svelte'

	let {
		data
	}: {
		data: {
			locale: string
			publicRuntimeConfig: PublicRuntimeConfig
		}
	} = $props()

	function handleSuccess(): void {
		const redirectPath: string = page.url.searchParams.get('redirect') ?? ''
		const adminPrefix: string = `/${data.locale}/admin`
		const isAdminRedirect: boolean =
			redirectPath === adminPrefix || redirectPath.startsWith(`${adminPrefix}/`)
		const destination: string = isAdminRedirect
			? redirectPath
			: `/${data.locale}`
		void goto(destination)
	}
</script>

<AppHeader logoHref={`/${data.locale}`} />

<main class="flex min-h-[calc(100svh-3rem)] items-center justify-center px-6 py-16">
	<LoginCard
		onSuccess={handleSuccess}
		registerHref={`/${data.locale}/register`}
		forgotPasswordHref={data.publicRuntimeConfig.email_provider_configured ? `/${data.locale}/forgot-password` : undefined}
		googleAuthEnabled={data.publicRuntimeConfig.google_auth_enabled}
		githubAuthEnabled={data.publicRuntimeConfig.github_auth_enabled}
		linuxdoAuthEnabled={data.publicRuntimeConfig.linuxdo_auth_enabled}
		registrationEnabled={data.publicRuntimeConfig.registration_enabled}
		refundHref={data.publicRuntimeConfig.payment_enabled ? '/refund-policy' : undefined}
		turnstileEnabled={data.publicRuntimeConfig.turnstile_enabled}
		turnstileSiteKey={data.publicRuntimeConfig.turnstile_site_key ?? ''}
	/>
</main>
