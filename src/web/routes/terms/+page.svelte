<script lang="ts">
	let { data }: { data: { siteName: string; supportEmail: string } } = $props()
</script>

<svelte:head>
	<title>{data.siteName} Terms</title>
	<meta
		name="description"
		content={`Terms of service for ${data.siteName}`}
	/>
</svelte:head>

<main class="mx-auto w-full max-w-3xl px-6 py-12">
	<h1 class="text-3xl font-semibold tracking-tight">Terms of Service</h1>
	<div class="mt-6 space-y-6 text-sm leading-7 text-muted-foreground">
		<p>These terms govern your use of {data.siteName}</p>
		<p>You are responsible for your account activity and must keep your credentials secure</p>
		<p>
			You may not use the service for unlawful behavior or abuse of platform resources
		</p>
		<p>
			We may update features and policies over time and continued usage means you accept changes
		</p>
		<p>For legal or account questions contact {data.supportEmail}</p>
	</div>
</main>
