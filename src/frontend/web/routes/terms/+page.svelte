<script lang="ts">
	let { data }: { data: { siteName: string; supportEmail: string } } =
		$props();
</script>

<svelte:head>
	<title>{data.siteName} Terms</title>
	<meta
		name="description"
		content={`Terms of service for ${data.siteName}`}
	/>
</svelte:head>

<main class="mx-auto w-full max-w-3xl px-6 py-16">
	<h1 class="text-display-md">Terms of Service</h1>
	<div class="mt-8 space-y-10 text-muted-foreground">
		<section class="space-y-2">
			<h2 class="text-tagline text-foreground">Service</h2>
			<p>
				These terms govern your use of {data.siteName}. The service
				provides account features, product documentation, and the
				enabled product modules shown in the app.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-tagline text-foreground">Account</h2>
			<p>
				You are responsible for your account activity and must keep your
				credentials secure. You must provide accurate account
				information when the service requires it.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-tagline text-foreground">
				Plans and Credits
			</h2>
			<p>
				If paid plans, subscriptions, one-time purchases, or credits are
				enabled, the price and product terms shown at checkout apply to
				that purchase.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-tagline text-foreground">
				Acceptable Use
			</h2>
			<p>
				You may not use the service for unlawful behavior, abuse of
				platform resources, security testing without permission, spam,
				fraud, or attempts to disrupt other users.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-tagline text-foreground">
				User Content
			</h2>
			<p>
				You keep ownership of content you submit. You grant the service
				permission to process that content only as needed to provide,
				secure, and improve the service.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-tagline text-foreground">
				Changes and Termination
			</h2>
			<p>
				We update features, suspend abusive accounts, and stop providing
				parts of the service when needed to operate the product.
				Continued usage after policy updates means you accept the
				updated terms.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-tagline text-foreground">Disclaimers</h2>
			<p>
				The service is provided as available. We do not guarantee
				uninterrupted availability, error-free operation, or that
				outputs will meet every requirement.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-tagline text-foreground">Contact</h2>
			<p>For legal or account questions contact {data.supportEmail}</p>
		</section>
	</div>
</main>
