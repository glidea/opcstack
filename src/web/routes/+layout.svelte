<script lang="ts">
	import { untrack } from 'svelte'
	import { locale as localeStore } from '$web/i18n'
	import type { SystemLocale } from '$web/i18n/locales'
	import '../app.css'
	import '$web/i18n'

	let {
		data,
		children
	}: {
		data: { locale: SystemLocale }
		children: import('svelte').Snippet
	} = $props()

	localeStore.set(untrack(() => data.locale))

	$effect(() => {
		if (typeof document !== 'undefined') {
			document.documentElement.lang = data.locale
		}
	})
</script>

{@render children()}
