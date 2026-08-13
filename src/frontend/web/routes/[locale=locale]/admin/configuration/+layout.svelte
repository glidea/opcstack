<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation'
	import { page } from '$app/state'
	import type { BeforeNavigate } from '@sveltejs/kit'
	import { onMount, type Snippet } from 'svelte'
	import { _ } from '$frontend/i18n'
	import * as AlertDialog from '$frontend/ui/alert-dialog'
	import * as Tabs from '$frontend/ui/tabs'
	import {
		createConfigurationNavigation,
		resolveConfigurationNavigation,
		type ConfigurationEditorStateDetail,
		type ConfigurationNavigationDecision,
		type ConfigurationNavigationItem,
		type ConfigurationSave
	} from './configuration-page'

	let { data, children }: { data: { locale: string }; children: Snippet } = $props()
	let dirty: boolean = $state(false)
	let confirmOpen: boolean = $state(false)
	let pendingHref: string = $state('')
	let navigationSaving: boolean = $state(false)
	let saveCurrent: ConfigurationSave | null = null
	const navigation: ConfigurationNavigationItem[] = $derived(createConfigurationNavigation(data.locale))
	const activeDomain: string = $derived(page.url.pathname.split('/').at(-1) ?? 'general')

	function handleEditorState(event: Event): void {
		const detail: ConfigurationEditorStateDetail = (event as CustomEvent<ConfigurationEditorStateDetail>).detail
		dirty = detail.dirty
		saveCurrent = detail.save
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

	async function saveAndNavigate(): Promise<void> {
		if (saveCurrent === null) return
		navigationSaving = true
		const saved: boolean = await saveCurrent()
		navigationSaving = false
		if (!saved) {
			keepEditing()
			return
		}
		discardAndNavigate()
	}

	beforeNavigate((navigation: BeforeNavigate): void => {
		const targetPath: string | undefined = navigation.to?.url.pathname
		if (targetPath === undefined) return
		const decision: ConfigurationNavigationDecision = resolveConfigurationNavigation(dirty, page.url.pathname, targetPath)
		if (decision.action === 'navigate') return
		navigation.cancel()
		pendingHref = decision.href
		confirmOpen = true
	})

	onMount((): (() => void) => {
		window.addEventListener('configuration-editor-state', handleEditorState)
		return (): void => window.removeEventListener('configuration-editor-state', handleEditorState)
	})
</script>

<div class="admin-page">
	<header class="admin-page-header">
		<h1>{$_('admin.configuration.title')}</h1>
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
			<AlertDialog.Cancel disabled={navigationSaving} onclick={keepEditing}>{$_('admin.configuration.unsaved.cancel')}</AlertDialog.Cancel>
			<AlertDialog.Action variant="destructive" disabled={navigationSaving} onclick={discardAndNavigate}>
				{$_('admin.configuration.unsaved.discard')}
			</AlertDialog.Action>
			<AlertDialog.Action disabled={navigationSaving} onclick={() => { void saveAndNavigate() }}>
				{$_('admin.configuration.save')}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
