<script lang="ts">
	import { clientConfig } from '$web/config/client'
</script>

<main>
	<h1>{clientConfig.appName}</h1>
	<p>{clientConfig.webBaseUrl}</p>
</main>
