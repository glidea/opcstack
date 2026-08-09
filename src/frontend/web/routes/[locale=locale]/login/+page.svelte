<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { clientConfig } from '$frontend/config/client'
	import AppHeader from '$frontend/app-ui/shell/AppHeader.svelte'
	import LoginCard from '$frontend/app-ui/auth/LoginCard.svelte'

	let {
		data
	}: {
		data: {
			locale: string
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
		forgotPasswordHref={`/${data.locale}/forgot-password`}
		googleAuthEnabled={clientConfig.googleAuthEnabled}
		githubAuthEnabled={clientConfig.githubAuthEnabled}
		linuxdoAuthEnabled={clientConfig.linuxdoAuthEnabled}
		emailSignupEnabled={clientConfig.emailSignupEnabled}
		refundHref={clientConfig.paymentEnabled ? '/refund-policy' : undefined}
		turnstileEnabled={clientConfig.turnstileEnabled}
		turnstileSiteKey={clientConfig.turnstileSiteKey}
	/>
</main>
