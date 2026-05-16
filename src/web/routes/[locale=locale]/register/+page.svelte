<script lang="ts">
	import { goto } from '$app/navigation'
	import AppHeader from '$web/components/AppHeader.svelte'
	import RegisterCard from '$web/components/RegisterCard.svelte'
	import OtpCard from '$web/components/OtpCard.svelte'

	let { data }: { data: { locale: string } } = $props()

	let pendingEmail = $state('')

	function handleRegisterSuccess(email: string): void {
		pendingEmail = email
	}

	function handleOtpSuccess(): void {
		goto(`/${data.locale}`)
	}
</script>

<AppHeader logoHref={`/${data.locale}`} />

<main class="flex min-h-[calc(100svh-2.75rem)] items-center justify-center px-6 py-16">
	{#if pendingEmail}
		<OtpCard email={pendingEmail} onSuccess={handleOtpSuccess} />
	{:else}
		<RegisterCard
			onSuccess={handleRegisterSuccess}
			loginHref={`/${data.locale}/login`}
		/>
	{/if}
</main>
