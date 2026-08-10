<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import type { Component, Snippet } from 'svelte'
	import BellIcon from '@lucide/svelte/icons/bell'
	import BotIcon from '@lucide/svelte/icons/bot'
	import CloudIcon from '@lucide/svelte/icons/cloud'
	import CreditCardIcon from '@lucide/svelte/icons/credit-card'
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
	import KeyRoundIcon from '@lucide/svelte/icons/key-round'
	import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard'
	import MessageSquareTextIcon from '@lucide/svelte/icons/message-square-text'
	import TicketCheckIcon from '@lucide/svelte/icons/ticket-check'
	import UsersIcon from '@lucide/svelte/icons/users'
	import AppHeader from '$frontend/app-ui/shell/AppHeader.svelte'
	import UserMenu from '$frontend/app-ui/shell/UserMenu.svelte'
	import { _ } from '$frontend/i18n'
	import { buttonVariants } from '$frontend/ui/button'
	import * as Sidebar from '$frontend/ui/sidebar'
	import { createAdminNavigation, type AdminNavigationItem, type AdminSection } from './admin-navigation'

	type AdminLayoutData = {
		locale: string
		siteName: string
		canonicalUrl: string
		cloudflareWorkerUrl: string | null
	}

	type AdminNavigationGroup = {
		labelKey: string | null
		items: AdminNavigationItem[]
	}

	let {
		data,
		children
	}: {
		data: AdminLayoutData
		children: Snippet
	} = $props()

	const navigation: AdminNavigationItem[] = $derived(createAdminNavigation(data.locale))
	const currentItem: AdminNavigationItem = $derived(navigation.find((item: AdminNavigationItem): boolean => item.href === page.url.pathname) ?? navigation[0]!)
	const navigationGroups: AdminNavigationGroup[] = $derived([
		{
			labelKey: null,
			items: navigation.filter((item: AdminNavigationItem): boolean => item.id === 'overview')
		},
		{
			labelKey: 'admin.nav.management',
			items: navigation.filter((item: AdminNavigationItem): boolean => item.id !== 'overview' && item.id !== 'ai-tasks')
		},
		{
			labelKey: 'admin.nav.operations',
			items: navigation.filter((item: AdminNavigationItem): boolean => item.id === 'ai-tasks')
		}
	])
	const sectionIcons: Record<AdminSection, Component> = {
		overview: LayoutDashboardIcon,
		users: UsersIcon,
		'beta-codes': KeyRoundIcon,
		'credit-codes': TicketCheckIcon,
		feedback: MessageSquareTextIcon,
		notifications: BellIcon,
		payments: CreditCardIcon,
		'ai-tasks': BotIcon
	}

	function handleSignOut(): void {
		void goto(`/${data.locale}/login`)
	}
</script>

<svelte:head>
	<title>{$_(currentItem.labelKey)} - {data.siteName}</title>
	<meta name="description" content={$_('admin.seo.description')} />
	<link rel="canonical" href={data.canonicalUrl} />
</svelte:head>

<Sidebar.Provider class="admin-shell flex min-h-svh flex-col" style="--sidebar-width: 14rem;">
	<AppHeader logoHref={`/${data.locale}/admin/overview`} showSidebarTrigger>
		{#snippet actions()}
			{#if data.cloudflareWorkerUrl}
				<a href={data.cloudflareWorkerUrl} target="_blank" rel="noopener" class={buttonVariants({ variant: 'ghost', size: 'sm' })}>
					<CloudIcon class="size-4" />
					<span class="hidden sm:inline">{$_('admin.cloudflare.worker')}</span>
					<ExternalLinkIcon class="size-3.5 text-muted-foreground" />
				</a>
			{/if}
			<UserMenu onSignOut={handleSignOut} settingsHref={`/${data.locale}/settings`} />
		{/snippet}
	</AppHeader>

	<div class="flex min-h-0 flex-1">
		<Sidebar.Root class="border-r md:top-12 md:h-[calc(100svh-3rem)]">
			<Sidebar.Content class="py-3">
				{#each navigationGroups as group}
					<Sidebar.Group class="px-3 py-1.5">
						{#if group.labelKey}
							<Sidebar.GroupLabel class="px-2">{$_(group.labelKey)}</Sidebar.GroupLabel>
						{/if}
						<Sidebar.GroupContent>
							<Sidebar.Menu class="gap-0.5">
								{#each group.items as item}
									{@const Icon: Component = sectionIcons[item.id]}
									{@const isActive: boolean = item.href === page.url.pathname}
									<Sidebar.MenuItem>
										<Sidebar.MenuButton {isActive} class="h-9 px-2.5 data-active:bg-sidebar-primary data-active:text-sidebar-primary-foreground">
											{#snippet child({ props })}
												<a href={item.href} aria-current={isActive ? 'page' : undefined} {...props}>
													<Icon class="size-4" />
													<span>{$_(item.labelKey)}</span>
												</a>
											{/snippet}
										</Sidebar.MenuButton>
									</Sidebar.MenuItem>
								{/each}
							</Sidebar.Menu>
						</Sidebar.GroupContent>
					</Sidebar.Group>
				{/each}
			</Sidebar.Content>
		</Sidebar.Root>

		<Sidebar.Inset class="min-w-0 overflow-hidden">
			{@render children()}
		</Sidebar.Inset>
	</div>
</Sidebar.Provider>
