<script lang="ts">
	import { goto } from '$app/navigation'
	import AppHeader from '$web/components/AppHeader.svelte'
	import ForgotPasswordCard from '$web/components/ForgotPasswordCard.svelte'
	import ResetPasswordCard from '$web/components/ResetPasswordCard.svelte'

	let { data }: { data: { locale: string } } = $props()

	let pendingEmail = $state('')

	function handleSentSuccess(email: string): void {
		pendingEmail = email
	}

	function handleResetSuccess(): void {
		goto(`/${data.locale}/login`)
	}
</script>

<AppHeader logoHref={`/${data.locale}`} />

<main class="flex min-h-[calc(100svh-2.75rem)] items-center justify-center px-6 py-16">
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
		/>
	{/if}
</main>
