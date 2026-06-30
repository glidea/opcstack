<script lang="ts">
	import { _ } from "$frontend/i18n";
	import Section from "./Section.svelte";
	import Block from "./Block.svelte";

	import * as Tabs from "$frontend/ui/tabs";
	import * as Breadcrumb from "$frontend/ui/breadcrumb";
	import * as Pagination from "$frontend/ui/pagination";
	import * as NavigationMenu from "$frontend/ui/navigation-menu";
import * as Sidebar from "$frontend/ui/sidebar";
	import * as Command from "$frontend/ui/command";
	import { ScrollArea } from "$frontend/ui/scroll-area";

	import HomeIcon from "@lucide/svelte/icons/home";
	import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";
	import SettingsIcon from "@lucide/svelte/icons/settings";
	import UsersIcon from "@lucide/svelte/icons/users";
	import SearchIcon from "@lucide/svelte/icons/search";
	import FileTextIcon from "@lucide/svelte/icons/file-text";
	import CalendarIcon from "@lucide/svelte/icons/calendar";

	let page = $state(3);
</script>

<Section
	id="navigation"
	eyebrow={$_("designSystem.s5.eyebrow")}
	title={$_("designSystem.s5.title")}
	description={$_("designSystem.s5.desc")}
	surface="parchment"
>
	<!-- Tabs -->
	<Block title="Tabs · default" span={2}>
		<Tabs.Root value="overview" class="w-full">
			<Tabs.List>
				<Tabs.Trigger value="overview">Overview</Tabs.Trigger>
				<Tabs.Trigger value="analytics">Analytics</Tabs.Trigger>
				<Tabs.Trigger value="settings">Settings</Tabs.Trigger>
			</Tabs.List>
			<Tabs.Content value="overview" class="mt-4 text-caption text-muted-foreground">
				Overview content — metrics, charts, summaries.
			</Tabs.Content>
			<Tabs.Content value="analytics" class="mt-4 text-caption text-muted-foreground">
				Analytics content — funnels, retention, cohorts.
			</Tabs.Content>
			<Tabs.Content value="settings" class="mt-4 text-caption text-muted-foreground">
				Settings content — preferences, integrations.
			</Tabs.Content>
		</Tabs.Root>
	</Block>

	<Block title="Tabs · line variant" span={2}>
		<Tabs.Root value="all" class="w-full">
			<Tabs.List variant="line">
				<Tabs.Trigger value="all">All</Tabs.Trigger>
				<Tabs.Trigger value="active">Active</Tabs.Trigger>
				<Tabs.Trigger value="archived">Archived</Tabs.Trigger>
			</Tabs.List>
			<Tabs.Content value="all" class="mt-4 text-caption text-muted-foreground">All items.</Tabs.Content>
			<Tabs.Content value="active" class="mt-4 text-caption text-muted-foreground">Active items.</Tabs.Content>
			<Tabs.Content value="archived" class="mt-4 text-caption text-muted-foreground">Archived items.</Tabs.Content>
		</Tabs.Root>
	</Block>

	<!-- Breadcrumb -->
	<Block title="Breadcrumb" span={2}>
		<Breadcrumb.Root>
			<Breadcrumb.List>
				<Breadcrumb.Item>
					<Breadcrumb.Link href="#">Home</Breadcrumb.Link>
				</Breadcrumb.Item>
				<Breadcrumb.Separator />
				<Breadcrumb.Item>
					<Breadcrumb.Link href="#">Products</Breadcrumb.Link>
				</Breadcrumb.Item>
				<Breadcrumb.Separator />
				<Breadcrumb.Item>
					<Breadcrumb.Ellipsis />
				</Breadcrumb.Item>
				<Breadcrumb.Separator />
				<Breadcrumb.Item>
					<Breadcrumb.Page>iPhone 17 Pro</Breadcrumb.Page>
				</Breadcrumb.Item>
			</Breadcrumb.List>
		</Breadcrumb.Root>
	</Block>

	<!-- Pagination -->
	<Block title="Pagination" span={2}>
		<div class="flex w-full flex-col gap-4">
			<Pagination.Root count={100} perPage={10} bind:page>
				{#snippet children({ pages, currentPage })}
					<Pagination.Content>
						<Pagination.Item>
							<Pagination.PrevButton />
						</Pagination.Item>
						{#each pages as p (p.key)}
							{#if p.type === "ellipsis"}
								<Pagination.Item>
									<Pagination.Ellipsis />
								</Pagination.Item>
							{:else}
								<Pagination.Item>
									<Pagination.Link page={p} isActive={currentPage === p.value}>
										{p.value}
									</Pagination.Link>
								</Pagination.Item>
							{/if}
						{/each}
						<Pagination.Item>
							<Pagination.NextButton />
						</Pagination.Item>
					</Pagination.Content>
				{/snippet}
			</Pagination.Root>
			<span class="text-fine-print text-center text-muted-foreground">page: {page}</span>
		</div>
	</Block>

	<!-- NavigationMenu -->
	<Block title="NavigationMenu" span={2}>
		<NavigationMenu.Root>
			<NavigationMenu.List>
				<NavigationMenu.Item>
					<NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
					<NavigationMenu.Content>
						<div class="grid w-[300px] gap-2 p-3">
							{#each ["iPhone", "Mac", "iPad", "Apple Watch"] as item (item)}
								<NavigationMenu.Link href="#" class="block rounded-md px-3 py-2 text-sm hover:bg-muted">
									{item}
								</NavigationMenu.Link>
							{/each}
						</div>
					</NavigationMenu.Content>
				</NavigationMenu.Item>
				<NavigationMenu.Item>
					<NavigationMenu.Trigger>Store</NavigationMenu.Trigger>
					<NavigationMenu.Content>
						<div class="grid w-[200px] gap-2 p-3">
							{#each ["Shop", "Financing", "Trade In"] as item (item)}
								<NavigationMenu.Link href="#" class="block rounded-md px-3 py-2 text-sm hover:bg-muted">
									{item}
								</NavigationMenu.Link>
							{/each}
						</div>
					</NavigationMenu.Content>
				</NavigationMenu.Item>
				<NavigationMenu.Item>
					<NavigationMenu.Link href="#">Support</NavigationMenu.Link>
				</NavigationMenu.Item>
			</NavigationMenu.List>
		</NavigationMenu.Root>
	</Block>

	<!-- Sidebar mini -->
	<Block title="Sidebar (collapsible=none)" description="Inline preview at fixed height." span={2}>
		<div class="h-64 w-full overflow-hidden rounded-lg border border-border">
			<Sidebar.Provider>
				<Sidebar.Root collapsible="none" class="h-full w-48 border-r border-border">
					<Sidebar.Header class="px-3 py-2">
						<span class="text-caption font-semibold">Workspace</span>
					</Sidebar.Header>
					<Sidebar.Content>
						<Sidebar.Group>
							<Sidebar.GroupLabel>Main</Sidebar.GroupLabel>
							<Sidebar.GroupContent>
								<Sidebar.Menu>
									{#each [
										{ icon: HomeIcon, label: "Home" },
										{ icon: LayoutDashboardIcon, label: "Dashboard" },
										{ icon: UsersIcon, label: "Team" },
										{ icon: SettingsIcon, label: "Settings" },
									] as item (item.label)}
										<Sidebar.MenuItem>
											<Sidebar.MenuButton isActive={item.label === "Dashboard"}>
												<item.icon />
												<span>{item.label}</span>
											</Sidebar.MenuButton>
										</Sidebar.MenuItem>
									{/each}
								</Sidebar.Menu>
							</Sidebar.GroupContent>
						</Sidebar.Group>
					</Sidebar.Content>
				</Sidebar.Root>
				<Sidebar.Inset class="flex items-center justify-center text-caption text-muted-foreground">
					Main content area
				</Sidebar.Inset>
			</Sidebar.Provider>
		</div>
	</Block>

	<!-- Command -->
	<Block title="Command" description="Inline command palette." span={2}>
		<div class="w-full rounded-lg border border-border">
			<Command.Root disableInitialScroll>
				<Command.Input placeholder="Search commands…" autofocus={false} />
				<Command.List>
					<Command.Empty>No results found.</Command.Empty>
					<Command.Group heading="Pages">
						<Command.Item>
							<HomeIcon class="mr-2 size-4" />
							Home
						</Command.Item>
						<Command.Item>
							<FileTextIcon class="mr-2 size-4" />
							Docs
						</Command.Item>
						<Command.Item>
							<CalendarIcon class="mr-2 size-4" />
							Calendar
						</Command.Item>
					</Command.Group>
					<Command.Separator />
					<Command.Group heading="Settings">
						<Command.Item>
							<SettingsIcon class="mr-2 size-4" />
							Preferences
							<Command.Shortcut>⌘,</Command.Shortcut>
						</Command.Item>
					</Command.Group>
				</Command.List>
			</Command.Root>
		</div>
	</Block>

	<!-- ScrollArea -->
	<Block title="ScrollArea" description="Custom scrollbar." span={2}>
		<ScrollArea class="h-48 w-full rounded-md border border-border p-4">
			{#each Array.from({ length: 20 }, (_, i) => i + 1) as n (n)}
				<div class="py-1 text-caption text-muted-foreground">
					Line {n} — The quick brown fox jumps over the lazy dog.
				</div>
			{/each}
		</ScrollArea>
	</Block>
</Section>
