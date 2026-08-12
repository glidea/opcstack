<script lang="ts">
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Button } from '$frontend/ui/button'

	let { error, onRetry }: { error: string; onRetry: () => void } = $props()
</script>

<div class="space-y-4 py-6">
	<Alert.Root variant="destructive"><Alert.Description>{error}</Alert.Description></Alert.Root>
	<Button type="button" variant="outline" onclick={onRetry}><RefreshCwIcon />{$_('admin.configuration.retry')}</Button>
</div>
