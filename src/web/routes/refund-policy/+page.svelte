<script lang="ts">
	let { data }: { data: { siteName: string; supportEmail: string } } = $props()
</script>

<svelte:head>
	<title>{data.siteName} Refund Policy</title>
	<meta
		name="description"
		content={`Refund policy for ${data.siteName}`}
	/>
</svelte:head>

<main class="mx-auto w-full max-w-3xl px-6 py-12">
	<h1 class="text-3xl font-semibold tracking-tight">Refund Policy</h1>
	<div class="mt-6 space-y-6 text-sm leading-7 text-muted-foreground">
		<p>Refund requests are reviewed case by case according to order status and usage evidence</p>
		<p>Subscription cancellation stops future renewals and does not retroactively refund prior periods</p>
		<p>Refund outcomes from payment providers are synchronized to account credits and payment history</p>
		<p>For refund support contact {data.supportEmail}</p>
	</div>
</main>
