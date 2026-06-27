<script lang="ts">
	import { goto } from '$app/navigation'
	import type { PublicConfig } from '$web/config/client'
	import AppHeader from '$web/components/AppHeader.svelte'
	import ForgotPasswordCard from '$web/components/ForgotPasswordCard.svelte'
	import ResetPasswordCard from '$web/components/ResetPasswordCard.svelte'

	let {
		data
	}: {
		data: {
			locale: string
			publicConfig: PublicConfig
		}
	} = $props()

	let pendingEmail = $state('')

	function handleSentSuccess(email: string): void {
		pendingEmail = email
	}

	function handleResetSuccess(): void {
		goto(`/${data.locale}/login`)
	}

	$effect(() => {
		if (!data.publicConfig.email_enabled) {
			goto(`/${data.locale}/login`)
		}
	})
</script>

<AppHeader logoHref={`/${data.locale}`} />

<main class="flex min-h-[calc(100svh-3rem)] items-center justify-center px-6 py-16">
	{#if data.publicConfig.email_enabled}
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
				emailUserActionCooldownSeconds={data.publicConfig.email_user_action_cooldown_seconds}
				turnstileEnabled={data.publicConfig.turnstile_enabled}
				turnstileSiteKey={data.publicConfig.turnstile_site_key}
			/>
		{/if}
	{/if}
</main>
