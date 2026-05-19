<script lang="ts">
	import { _ } from "$web/i18n";
	import Section from "./Section.svelte";
	import Block from "./Block.svelte";

	import * as Dialog from "$web/ui/dialog";
	import * as AlertDialog from "$web/ui/alert-dialog";
	import * as Sheet from "$web/ui/sheet";
	import * as Drawer from "$web/ui/drawer";
	import * as Popover from "$web/ui/popover";
	import * as HoverCard from "$web/ui/hover-card";
	import * as Tooltip from "$web/ui/tooltip";
	import * as DropdownMenu from "$web/ui/dropdown-menu";
	import * as ContextMenu from "$web/ui/context-menu";
	import * as Command from "$web/ui/command";
	import { Toaster } from "$web/ui/sonner";
	import { Button } from "$web/ui/button";
	import { Avatar, AvatarFallback } from "$web/ui/avatar";
	import { Badge } from "$web/ui/badge";

	import { toast } from "svelte-sonner";
	import UserIcon from "@lucide/svelte/icons/user";
	import SettingsIcon from "@lucide/svelte/icons/settings";
	import LogOutIcon from "@lucide/svelte/icons/log-out";
	import CopyIcon from "@lucide/svelte/icons/copy";
	import TrashIcon from "@lucide/svelte/icons/trash";
	import SearchIcon from "@lucide/svelte/icons/search";
	import FileTextIcon from "@lucide/svelte/icons/file-text";
	import CalendarIcon from "@lucide/svelte/icons/calendar";

	type Side = "top" | "right" | "bottom" | "left";
	const sides: Side[] = ["right", "left", "top", "bottom"];
	let cmdOpen = $state(false);

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === "k") {
			e.preventDefault();
			cmdOpen = !cmdOpen;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />
<Toaster />

<Section
	id="overlays"
	eyebrow={$_("designSystem.s6.eyebrow")}
	title={$_("designSystem.s6.title")}
	description={$_("designSystem.s6.desc")}
	surface="light"
>
	<!-- Dialog -->
	<Block title="Dialog" span={2}>
		<Dialog.Root>
			<Dialog.Trigger>
				{#snippet child({ props })}
					<Button variant="outline" {...props}>Open dialog</Button>
				{/snippet}
			</Dialog.Trigger>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>Confirm purchase</Dialog.Title>
					<Dialog.Description>
						You're about to purchase the Pro plan for $90/year. This will be charged to your card on file.
					</Dialog.Description>
				</Dialog.Header>
				<Dialog.Footer>
					<Dialog.Close>
						{#snippet child({ props })}
							<Button variant="outline" {...props}>Cancel</Button>
						{/snippet}
					</Dialog.Close>
					<Button>Confirm</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>
	</Block>

	<!-- AlertDialog -->
	<Block title="AlertDialog" span={2}>
		<AlertDialog.Root>
			<AlertDialog.Trigger>
				{#snippet child({ props })}
					<Button variant="destructive" {...props}>Delete account</Button>
				{/snippet}
			</AlertDialog.Trigger>
			<AlertDialog.Content>
				<AlertDialog.Header>
					<AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
					<AlertDialog.Description>
						This action cannot be undone. Your account and all data will be permanently deleted.
					</AlertDialog.Description>
				</AlertDialog.Header>
				<AlertDialog.Footer>
					<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
					<AlertDialog.Action>Delete</AlertDialog.Action>
				</AlertDialog.Footer>
			</AlertDialog.Content>
		</AlertDialog.Root>
	</Block>

	<!-- Sheets -->
	<Block title="Sheet · 4 sides" span={2}>
		<div class="flex flex-wrap gap-2">
			{#each sides as side (side)}
				<Sheet.Root>
					<Sheet.Trigger>
						{#snippet child({ props })}
							<Button variant="outline" size="sm" {...props}>{side}</Button>
						{/snippet}
					</Sheet.Trigger>
					<Sheet.Content {side}>
						<Sheet.Header>
							<Sheet.Title>Sheet · {side}</Sheet.Title>
							<Sheet.Description>Slides in from the {side}.</Sheet.Description>
						</Sheet.Header>
						<div class="p-4 text-caption text-muted-foreground">Sheet content goes here.</div>
					</Sheet.Content>
				</Sheet.Root>
			{/each}
		</div>
	</Block>

	<!-- Drawer -->
	<Block title="Drawer" span={2}>
		<Drawer.Root>
			<Drawer.Trigger>
				{#snippet child({ props })}
					<Button variant="outline" {...props}>Open drawer</Button>
				{/snippet}
			</Drawer.Trigger>
			<Drawer.Content>
				<Drawer.Header>
					<Drawer.Title>Quick actions</Drawer.Title>
					<Drawer.Description>Swipe down to dismiss.</Drawer.Description>
				</Drawer.Header>
				<div class="px-4 pb-4 text-caption text-muted-foreground">Drawer content goes here.</div>
				<Drawer.Footer>
					<Drawer.Close>
						{#snippet child({ props })}
							<Button variant="outline" {...props}>Close</Button>
						{/snippet}
					</Drawer.Close>
				</Drawer.Footer>
			</Drawer.Content>
		</Drawer.Root>
	</Block>

	<!-- Popover -->
	<Block title="Popover" span={2}>
		<Popover.Root>
			<Popover.Trigger>
				{#snippet child({ props })}
					<Button variant="outline" {...props}>Open popover</Button>
				{/snippet}
			</Popover.Trigger>
			<Popover.Content>
				<Popover.Header>
					<Popover.Title>Dimensions</Popover.Title>
					<Popover.Description>Set the dimensions for the layer.</Popover.Description>
				</Popover.Header>
				<div class="grid gap-2 text-caption text-muted-foreground">
					<div class="flex items-center justify-between">
						<span>Width</span><span class="tabular-nums">100%</span>
					</div>
					<div class="flex items-center justify-between">
						<span>Height</span><span class="tabular-nums">auto</span>
					</div>
				</div>
			</Popover.Content>
		</Popover.Root>
	</Block>

	<!-- HoverCard -->
	<Block title="HoverCard" span={2}>
		<HoverCard.Root>
			<HoverCard.Trigger>
				{#snippet child({ props })}
					<Button variant="link" {...props}>@opcstack</Button>
				{/snippet}
			</HoverCard.Trigger>
			<HoverCard.Content>
				<div class="flex gap-3">
					<Avatar>
						<AvatarFallback>OP</AvatarFallback>
					</Avatar>
					<div class="flex flex-col gap-1">
						<p class="text-sm font-semibold">OPC Stack</p>
						<p class="text-caption text-muted-foreground">Cloudflare SaaS scaffold. Zero cost to start.</p>
						<p class="text-fine-print text-muted-foreground">Joined January 2025</p>
					</div>
				</div>
			</HoverCard.Content>
		</HoverCard.Root>
	</Block>

	<!-- Tooltip -->
	<Block title="Tooltip" span={2}>
		<Tooltip.Provider>
			<div class="flex flex-wrap items-center gap-4">
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<Button variant="outline" size="icon" aria-label="Settings" {...props}>
								<SettingsIcon />
							</Button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content>Settings</Tooltip.Content>
				</Tooltip.Root>

				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<Button variant="outline" size="icon" aria-label="Profile" {...props}>
								<UserIcon />
							</Button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="right">View profile</Tooltip.Content>
				</Tooltip.Root>

				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<Button variant="outline" size="icon" aria-label="Delete" {...props}>
								<TrashIcon />
							</Button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="bottom">Delete item</Tooltip.Content>
				</Tooltip.Root>
			</div>
		</Tooltip.Provider>
	</Block>

	<!-- DropdownMenu -->
	<Block title="DropdownMenu" description={$_("designSystem.s6.b.dropdown.desc")} span={2}>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button variant="outline" {...props}>Open menu</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content class="w-56">
				<DropdownMenu.Label>My Account</DropdownMenu.Label>
				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					<DropdownMenu.Item>
						<UserIcon class="mr-2 size-4" />Profile
						<DropdownMenu.Shortcut>⇧⌘P</DropdownMenu.Shortcut>
					</DropdownMenu.Item>
					<DropdownMenu.Item>
						<SettingsIcon class="mr-2 size-4" />Settings
						<DropdownMenu.Shortcut>⌘,</DropdownMenu.Shortcut>
					</DropdownMenu.Item>
				</DropdownMenu.Group>
				<DropdownMenu.Separator />
				<DropdownMenu.CheckboxGroup>
					<DropdownMenu.CheckboxItem checked>Show toolbar</DropdownMenu.CheckboxItem>
					<DropdownMenu.CheckboxItem>Show sidebar</DropdownMenu.CheckboxItem>
				</DropdownMenu.CheckboxGroup>
				<DropdownMenu.Separator />
				<DropdownMenu.RadioGroup value="system">
					<DropdownMenu.GroupHeading>Theme</DropdownMenu.GroupHeading>
					<DropdownMenu.RadioItem value="light">Light</DropdownMenu.RadioItem>
					<DropdownMenu.RadioItem value="dark">Dark</DropdownMenu.RadioItem>
					<DropdownMenu.RadioItem value="system">System</DropdownMenu.RadioItem>
				</DropdownMenu.RadioGroup>
				<DropdownMenu.Separator />
				<DropdownMenu.Sub>
					<DropdownMenu.SubTrigger>More options</DropdownMenu.SubTrigger>
					<DropdownMenu.SubContent>
						<DropdownMenu.Item>Export</DropdownMenu.Item>
						<DropdownMenu.Item>Import</DropdownMenu.Item>
					</DropdownMenu.SubContent>
				</DropdownMenu.Sub>
				<DropdownMenu.Separator />
				<DropdownMenu.Item variant="destructive">
					<LogOutIcon class="mr-2 size-4" />Sign out
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Block>

	<!-- ContextMenu -->
	<Block title="ContextMenu" description={$_("designSystem.s6.b.contextMenu.desc")} span={2}>
		<ContextMenu.Root>
			<ContextMenu.Trigger>
				<div class="flex h-24 w-full items-center justify-center rounded-md border border-dashed border-border text-caption text-muted-foreground select-none">
					Right-click here
				</div>
			</ContextMenu.Trigger>
			<ContextMenu.Content class="w-48">
				<ContextMenu.Item>
					<CopyIcon class="mr-2 size-4" />Copy
				</ContextMenu.Item>
				<ContextMenu.Item>
					<FileTextIcon class="mr-2 size-4" />Paste
				</ContextMenu.Item>
				<ContextMenu.Separator />
				<ContextMenu.Item variant="destructive">
					<TrashIcon class="mr-2 size-4" />Delete
				</ContextMenu.Item>
			</ContextMenu.Content>
		</ContextMenu.Root>
	</Block>

	<!-- CommandDialog -->
	<Block title="CommandDialog" description={$_("designSystem.s6.b.command.desc")} span={2}>
		<div class="flex items-center gap-3">
			<Button variant="outline" onclick={() => (cmdOpen = true)}>
				<SearchIcon class="mr-2 size-4" />Search
				<Badge variant="secondary" class="ml-2">⌘K</Badge>
			</Button>
			<span class="text-caption text-muted-foreground">or press ⌘K anywhere on this page</span>
		</div>
		<Command.Dialog bind:open={cmdOpen}>
			<Command.Input placeholder="Type a command or search…" />
			<Command.List>
				<Command.Empty>No results found.</Command.Empty>
				<Command.Group heading="Suggestions">
					<Command.Item onSelect={() => (cmdOpen = false)}>
						<CalendarIcon class="mr-2 size-4" />Calendar
					</Command.Item>
					<Command.Item onSelect={() => (cmdOpen = false)}>
						<FileTextIcon class="mr-2 size-4" />Documentation
					</Command.Item>
					<Command.Item onSelect={() => (cmdOpen = false)}>
						<SettingsIcon class="mr-2 size-4" />Settings
					</Command.Item>
				</Command.Group>
			</Command.List>
		</Command.Dialog>
	</Block>

	<!-- Sonner -->
	<Block title="Sonner" description={$_("designSystem.s6.b.sonner.desc")} span={2}>
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" size="sm" onclick={() => toast("Event created")}>Default</Button>
			<Button variant="outline" size="sm" onclick={() => toast.success("Saved successfully")}>Success</Button>
			<Button variant="outline" size="sm" onclick={() => toast.error("Something went wrong")}>Error</Button>
			<Button variant="outline" size="sm" onclick={() => toast.warning("Low disk space")}>Warning</Button>
			<Button variant="outline" size="sm" onclick={() => toast.info("Update available")}>Info</Button>
			<Button variant="outline" size="sm" onclick={() => toast.loading("Uploading…")}>Loading</Button>
		</div>
	</Block>
</Section>
