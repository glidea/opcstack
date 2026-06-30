<script lang="ts">
	import LanguagesIcon from '@lucide/svelte/icons/languages'
	import { _ } from '$frontend/i18n'
	import { locale } from '$frontend/i18n'
	import { supportedLocales } from '$frontend/i18n/locales'
	import { isSystemLocale } from '$frontend/i18n/locales'
	import { Button } from '$frontend/ui/button'
	import * as DropdownMenu from '$frontend/ui/dropdown-menu'

	type LocalePath = { locale: string; path: string }

	let {
		current,
		localePaths
	}: {
		current: string
		localePaths?: LocalePath[]
	} = $props()

	const items: LocalePath[] = $derived(
		localePaths ?? supportedLocales.map((l) => ({ locale: l, path: '' }))
	)

	function switchLocale(next: string, path: string): void {
		locale.set(next)
		if (path !== '') {
			window.location.assign(path)
			return
		}

		const currentUrl = new URL(window.location.href)
		const segments = currentUrl.pathname.split('/').filter((segment) => segment !== '')
		const first = segments[0] ?? ''

		if (isSystemLocale(first)) {
			segments[0] = next
			currentUrl.pathname = `/${segments.join('/')}`
			window.location.assign(`${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`)
			return
		}

		window.location.assign(`/${next}`)
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button variant="ghost" size="icon" {...props}>
				<LanguagesIcon class="size-4" />
				<span class="sr-only">Switch language</span>
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		<DropdownMenu.RadioGroup value={current}>
			{#each items as item}
				<DropdownMenu.RadioItem
					value={item.locale}
					onSelect={() => switchLocale(item.locale, item.path)}
				>
					{$_(`lang.${item.locale}`)}
				</DropdownMenu.RadioItem>
			{/each}
		</DropdownMenu.RadioGroup>
	</DropdownMenu.Content>
</DropdownMenu.Root>
