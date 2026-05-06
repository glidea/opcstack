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
	<div class="mt-6 space-y-8 text-sm leading-7 text-muted-foreground">
		<section class="space-y-2">
			<h2 class="text-base font-semibold text-foreground">Refund Review</h2>
			<p>
				Refund requests are reviewed case by case according to order status, product type, account status, usage evidence, fraud signals, provider rules, and support history.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-base font-semibold text-foreground">Subscriptions</h2>
			<p>
				Subscription cancellation stops future renewals. It does not automatically refund prior billing periods.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-base font-semibold text-foreground">Credits</h2>
			<p>
				Credits, token packs, usage packages, and other digital balances are reviewed for refund based on whether they were used.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-base font-semibold text-foreground">Digital Products</h2>
			<p>
				Digital product purchases become harder to refund after access, delivery, download, generation, usage, or consumption begins.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-base font-semibold text-foreground">Processing Time</h2>
			<p>
				Approved refunds are submitted to the payment provider. The final posting time depends on the provider, card network, and bank.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-base font-semibold text-foreground">Account Balance</h2>
			<p>
				Refund outcomes from payment providers are synchronized to account credits, subscriptions, order state, and payment history.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-base font-semibold text-foreground">Contact</h2>
			<p>For refund support contact {data.supportEmail}</p>
		</section>
	</div>
</main>
