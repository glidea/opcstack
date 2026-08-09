<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import type { Component, Snippet } from 'svelte'
	import BellIcon from '@lucide/svelte/icons/bell'
	import BotIcon from '@lucide/svelte/icons/bot'
	import CloudIcon from '@lucide/svelte/icons/cloud'
	import CreditCardIcon from '@lucide/svelte/icons/credit-card'
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
	import * as Tooltip from '$frontend/ui/tooltip'
	import {
		createAdminNavigation,
		type AdminNavigationItem,
		type AdminSection
	} from './admin-navigation'

	type AdminLayoutData = {
		locale: string
		siteName: string
		canonicalUrl: string
	}

	let {
		data,
		children
	}: {
		data: AdminLayoutData
		children: Snippet
	} = $props()

	const navigation: AdminNavigationItem[] = $derived(createAdminNavigation(data.locale))
	const currentItem: AdminNavigationItem = $derived(
		navigation.find((item: AdminNavigationItem): boolean => item.href === page.url.pathname) ??
			navigation[0]!
	)
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

<Sidebar.Provider class="flex min-h-svh flex-col">
	<AppHeader logoHref={`/${data.locale}/admin/overview`} showSidebarTrigger>
		{#snippet center()}
			<div class="min-w-0">
				<p class="truncate text-sm font-medium">{$_(currentItem.labelKey)}</p>
			</div>
		{/snippet}
		{#snippet actions()}
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<a
							{...props}
							href="https://dash.cloudflare.com/"
							target="_blank"
							rel="noopener"
							aria-label={$_('admin.cloudflare')}
							class={buttonVariants({ variant: 'ghost', size: 'icon' })}
						>
							<CloudIcon class="size-4" />
						</a>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content>{$_('admin.cloudflare')}</Tooltip.Content>
			</Tooltip.Root>
			<UserMenu onSignOut={handleSignOut} settingsHref={`/${data.locale}/settings`} />
		{/snippet}
	</AppHeader>

	<div class="flex min-h-0 flex-1">
		<Sidebar.Root class="md:top-12 md:h-[calc(100svh-3rem)]">
			<Sidebar.Header class="px-4 pb-2 pt-5">
				<p class="text-xs font-medium text-muted-foreground">{$_('admin.title')}</p>
			</Sidebar.Header>
			<Sidebar.Content>
				<Sidebar.Group class="px-3 py-2">
					<Sidebar.GroupContent>
						<Sidebar.Menu class="gap-0.5">
							{#each navigation as item}
								{@const Icon: Component = sectionIcons[item.id]}
								{@const isActive: boolean = item.href === page.url.pathname}
								<Sidebar.MenuItem>
									<Sidebar.MenuButton isActive={isActive} class="h-9 px-2.5">
										{#snippet child({ props })}
											<a
												href={item.href}
												aria-current={isActive ? 'page' : undefined}
												{...props}
											>
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
			</Sidebar.Content>
		</Sidebar.Root>

		<Sidebar.Inset class="min-w-0 overflow-hidden">
			{@render children()}
		</Sidebar.Inset>
	</div>
</Sidebar.Provider>
