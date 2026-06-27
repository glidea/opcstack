<script lang="ts">
	import { clientConfig } from '$web/config/client'
</script>

<main>
	<img src="/icons/icon-48.png" alt="" />
	<h1>{clientConfig.appName}</h1>
	<p>{clientConfig.apiBaseUrl}</p>
</main>
