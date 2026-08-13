<script lang="ts">
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Button } from '$frontend/ui/button'

	let {
		error,
		conflict,
		onRefresh
	}: {
		error: string
		conflict: boolean
		onRefresh: () => Promise<void>
	} = $props()
</script>

<Alert.Root variant="destructive">
	<Alert.Description>{error}</Alert.Description>
	{#if conflict}
		<Alert.Action>
			<Button type="button" variant="ghost" size="sm" onclick={onRefresh}>{$_('admin.configuration.entity.refresh')}</Button>
		</Alert.Action>
	{/if}
</Alert.Root>
