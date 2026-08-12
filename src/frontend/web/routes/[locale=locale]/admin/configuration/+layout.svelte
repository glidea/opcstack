<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation'
	import { page } from '$app/state'
	import type { BeforeNavigate } from '@sveltejs/kit'
	import { onMount, type Snippet } from 'svelte'
	import SettingsIcon from '@lucide/svelte/icons/settings'
	import { _ } from '$frontend/i18n'
	import { Button } from '$frontend/ui/button'
	import * as AlertDialog from '$frontend/ui/alert-dialog'
	import * as Tabs from '$frontend/ui/tabs'
	import { createConfigurationNavigation, type ConfigurationNavigationItem } from './configuration-page'

	let { data, children }: { data: { locale: string }; children: Snippet } = $props()
	let dirty: boolean = $state(false)
	let confirmOpen: boolean = $state(false)
	let pendingHref: string = $state('')
	const navigation: ConfigurationNavigationItem[] = $derived(createConfigurationNavigation(data.locale))
	const activeDomain: string = $derived(page.url.pathname.split('/').at(-1) ?? 'general')

	function handleDirty(event: Event): void {
		dirty = (event as CustomEvent<boolean>).detail
	}

	function discardAndNavigate(): void {
		dirty = false
		confirmOpen = false
		const href: string = pendingHref
		pendingHref = ''
		void goto(href)
	}

	function keepEditing(): void {
		pendingHref = ''
		confirmOpen = false
	}

	beforeNavigate((navigation: BeforeNavigate): void => {
		if (!dirty || navigation.to?.url.pathname === page.url.pathname) return
		navigation.cancel()
		pendingHref = navigation.to?.url.pathname ?? ''
		confirmOpen = pendingHref !== ''
	})

	onMount((): (() => void) => {
		window.addEventListener('configuration-editor-dirty', handleDirty)
		return (): void => window.removeEventListener('configuration-editor-dirty', handleDirty)
	})
</script>

<div class="admin-page">
	<header class="admin-page-header">
		<h1>{$_('admin.configuration.title')}</h1>
		<Button variant="outline" href={`/${data.locale}/settings`}>
			<SettingsIcon />
			{$_('admin.configuration.accountSecurity')}
		</Button>
	</header>

	<Tabs.Root value={activeDomain} orientation="horizontal" class="min-w-0 gap-5">
		<div class="overflow-x-auto border-b">
			<Tabs.List variant="line" class="h-10 min-w-max justify-start rounded-none bg-transparent p-0">
				{#each navigation as item}
					<Tabs.Trigger value={item.id} class="flex-none px-3">
						{#snippet child({ props })}
							<a {...props} href={item.href}>{$_(`admin.configuration.tabs.${item.id}`)}</a>
						{/snippet}
					</Tabs.Trigger>
				{/each}
			</Tabs.List>
		</div>
		{@render children()}
	</Tabs.Root>
</div>

<AlertDialog.Root bind:open={confirmOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{$_('admin.configuration.unsaved.title')}</AlertDialog.Title>
			<AlertDialog.Description>{$_('admin.configuration.unsaved.description')}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={keepEditing}>{$_('admin.configuration.unsaved.cancel')}</AlertDialog.Cancel>
			<AlertDialog.Action variant="destructive" onclick={discardAndNavigate}>
				{$_('admin.configuration.unsaved.discard')}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
