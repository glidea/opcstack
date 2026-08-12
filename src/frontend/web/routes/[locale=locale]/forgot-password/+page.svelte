<script lang="ts">
	import { goto } from '$app/navigation'
	import type { PublicRuntimeConfig } from '$backend/config'
	import AppHeader from '$frontend/app-ui/shell/AppHeader.svelte'
	import ForgotPasswordCard from '$frontend/app-ui/auth/ForgotPasswordCard.svelte'
	import ResetPasswordCard from '$frontend/app-ui/auth/ResetPasswordCard.svelte'

	let {
		data
	}: {
		data: {
			locale: string
			publicRuntimeConfig: PublicRuntimeConfig
		}
	} = $props()

	let pendingEmail = $state('')

	function handleSentSuccess(email: string): void {
		pendingEmail = email
	}

	function handleResetSuccess(): void {
		goto(`/${data.locale}/login`)
	}

</script>

<AppHeader logoHref={`/${data.locale}`} />

<main class="flex min-h-[calc(100svh-3rem)] items-center justify-center px-6 py-16">
	{#if pendingEmail}
		<ResetPasswordCard
			email={pendingEmail}
			onSuccess={handleResetSuccess}
			loginHref={`/${data.locale}/login`}
		/>
	{:else}
		<ForgotPasswordCard
			onSuccess={handleSentSuccess}
			loginHref={`/${data.locale}/login`}
			emailUserActionCooldownSeconds={data.publicRuntimeConfig.email_user_action_cooldown_seconds}
			turnstileEnabled={data.publicRuntimeConfig.turnstile_enabled}
			turnstileSiteKey={data.publicRuntimeConfig.turnstile_site_key ?? ''}
		/>
	{/if}
</main>
