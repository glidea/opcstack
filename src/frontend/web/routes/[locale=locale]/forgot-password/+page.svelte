<script lang="ts">
	import { goto } from '$app/navigation'
	import { clientConfig } from '$frontend/config/client'
	import AppHeader from '$frontend/app-ui/shell/AppHeader.svelte'
	import ForgotPasswordCard from '$frontend/app-ui/auth/ForgotPasswordCard.svelte'
	import ResetPasswordCard from '$frontend/app-ui/auth/ResetPasswordCard.svelte'

	let {
		data
	}: {
		data: {
			locale: string
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
		if (!clientConfig.emailEnabled) {
			goto(`/${data.locale}/login`)
		}
	})
</script>

<AppHeader logoHref={`/${data.locale}`} />

<main class="flex min-h-[calc(100svh-3rem)] items-center justify-center px-6 py-16">
	{#if clientConfig.emailEnabled}
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
				emailUserActionCooldownSeconds={clientConfig.emailUserActionCooldownSeconds}
				turnstileEnabled={clientConfig.turnstileEnabled}
				turnstileSiteKey={clientConfig.turnstileSiteKey}
			/>
		{/if}
	{/if}
</main>
