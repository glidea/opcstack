<script lang="ts">
	import { clientConfig } from '$frontend/config/client'
</script>

<main>
	<h1>{clientConfig.appName}</h1>
	<p>{clientConfig.webBaseUrl}</p>
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: Inter, system-ui, sans-serif;
	}

	main {
		box-sizing: border-box;
		max-width: 640px;
		padding: 24px;
	}

	h1 {
		margin: 0 0 8px;
		font-size: 24px;
		font-weight: 650;
	}

	p {
		margin: 0;
		font-size: 14px;
		color: #666;
	}
</style>
