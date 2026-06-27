<script lang="ts">
	import MonitorCogIcon from '@lucide/svelte/icons/monitor-cog'
	import MoonStarIcon from '@lucide/svelte/icons/moon-star'
	import SunMediumIcon from '@lucide/svelte/icons/sun-medium'
	import { onMount } from 'svelte'
	import { Button } from '$web/ui/button'
	import * as DropdownMenu from '$web/ui/dropdown-menu'

	type ThemeMode = 'system' | 'light' | 'dark'

	let themeMode = $state<ThemeMode>('system')

	onMount(() => {
		themeMode = readThemeMode()
		setThemeModeAttr(themeMode)
		const mq = window.matchMedia('(prefers-color-scheme: dark)')
		const onChange = (): void => {
			if (themeMode === 'system') applyTheme('system')
		}
		mq.addEventListener('change', onChange)
		return () => mq.removeEventListener('change', onChange)
	})

	function readThemeMode(): ThemeMode {
		const stored = localStorage.getItem('theme')
		if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
		return 'system'
	}

	function resolveThemeMode(mode: ThemeMode): 'light' | 'dark' {
		if (mode === 'system') {
			return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
		}
		return mode
	}

	function setThemeModeAttr(mode: ThemeMode): void {
		document.documentElement.dataset['themeMode'] = mode
	}

	function applyTheme(mode: ThemeMode): void {
		themeMode = mode
		localStorage.setItem('theme', mode)
		setThemeModeAttr(mode)
		const resolved = resolveThemeMode(mode)
		document.documentElement.classList.toggle('dark', resolved === 'dark')
		document.documentElement.style.colorScheme = resolved
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button variant="ghost" size="icon" {...props}>
				<MonitorCogIcon class="theme-icon theme-icon-system size-4" />
				<SunMediumIcon class="theme-icon theme-icon-light size-4" />
				<MoonStarIcon class="theme-icon theme-icon-dark size-4" />
				<span class="sr-only">Toggle theme</span>
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		<DropdownMenu.RadioGroup bind:value={themeMode} onValueChange={(v) => applyTheme(v as ThemeMode)}>
			<DropdownMenu.RadioItem value="system">
				<MonitorCogIcon class="mr-2 size-4" />
				System
			</DropdownMenu.RadioItem>
			<DropdownMenu.RadioItem value="light">
				<SunMediumIcon class="mr-2 size-4" />
				Light
			</DropdownMenu.RadioItem>
			<DropdownMenu.RadioItem value="dark">
				<MoonStarIcon class="mr-2 size-4" />
				Dark
			</DropdownMenu.RadioItem>
		</DropdownMenu.RadioGroup>
	</DropdownMenu.Content>
</DropdownMenu.Root>

<style>
	:global(.theme-icon) {
		display: none;
	}

	:global(.theme-icon-system) {
		display: block;
	}

	:global(html[data-theme-mode='light'] .theme-icon-light) {
		display: block;
	}

	:global(html[data-theme-mode='light'] .theme-icon-system) {
		display: none;
	}

	:global(html[data-theme-mode='dark'] .theme-icon-dark) {
		display: block;
	}

	:global(html[data-theme-mode='dark'] .theme-icon-system) {
		display: none;
	}
</style>
