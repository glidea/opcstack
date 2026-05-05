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
	<div class="mt-6 space-y-6 text-sm leading-7 text-muted-foreground">
		<p>
			{data.siteName} stores account information that is required to authenticate and deliver service features
		</p>
		<p>
			We process operational logs and payment records for security billing and abuse prevention
		</p>
		<p>We do not sell your personal data</p>
		<p>
			You can request account related privacy support through {data.supportEmail}
		</p>
	</div>
</main>
