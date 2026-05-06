<script lang="ts">
	let { data }: { data: { siteName: string; supportEmail: string } } = $props()
</script>

<svelte:head>
	<title>{data.siteName} Privacy</title>
	<meta
		name="description"
		content={`Privacy policy for ${data.siteName}`}
	/>
</svelte:head>

<main class="mx-auto w-full max-w-3xl px-6 py-12">
	<h1 class="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
	<div class="mt-6 space-y-8 text-sm leading-7 text-muted-foreground">
		<section class="space-y-2">
			<h2 class="text-base font-semibold text-foreground">Data We Collect</h2>
			<p>
				{data.siteName} collects the account information needed to run the service, including email address, authentication identifiers, profile fields, product usage, support messages, and settings.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-base font-semibold text-foreground">Operational Data</h2>
			<p>
				We process request logs, device and browser data, security events, credit transactions, and error reports to operate, secure, and debug the service.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-base font-semibold text-foreground">How We Use Data</h2>
			<p>
				We use data to authenticate users, deliver product features, process billing, prevent abuse, debug issues, provide support, and improve the service.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-base font-semibold text-foreground">Third Party Services</h2>
			<p>
				The service uses third party providers for hosting, storage, authentication, email delivery, and support. If payment or AI features are enabled, payment and AI providers process the data needed for those features.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-base font-semibold text-foreground">Payment Data</h2>
			<p>
				If payment is enabled, payment details are processed by the payment provider. The service stores payment status, order identifiers, subscription state, and transaction history needed for billing.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-base font-semibold text-foreground">Cookies and Local Storage</h2>
			<p>
				The service uses cookies and local storage for authentication, session state, locale preferences, security, and product functionality.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-base font-semibold text-foreground">Retention</h2>
			<p>
				We retain data while your account is active or while needed for security, billing, support, legal, and operational purposes.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-base font-semibold text-foreground">Your Requests</h2>
			<p>
				You can request access, correction, export, or deletion of account related data by contacting {data.supportEmail}.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-base font-semibold text-foreground">Children</h2>
			<p>
				The service is not intended for children. If you believe a child provided personal data, contact us so we can review and remove it when appropriate.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-base font-semibold text-foreground">Contact</h2>
			<p>You can request privacy support through {data.supportEmail}</p>
		</section>
	</div>
</main>
