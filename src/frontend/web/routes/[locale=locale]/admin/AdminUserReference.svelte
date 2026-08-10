<script lang="ts">
	import { compactTechnicalId } from './admin-presentation'

	let {
		userId,
		href
	}: {
		userId: string
		href: string
	} = $props()
</script>

<a
	class="font-mono text-xs underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
	{href}
	title={userId}
	aria-label={userId}
>
	{compactTechnicalId(userId)}
</a>
