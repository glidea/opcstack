<script lang="ts">
	import { goto } from "$app/navigation";
	import { authClient, clearAuthToken } from "$web/auth/client";
	import { _ } from "$web/i18n";
	import { Button } from "$web/ui/button";
	import * as DropdownMenu from "$web/ui/dropdown-menu";
	import LogOutIcon from "@lucide/svelte/icons/log-out";
	import SettingsIcon from "@lucide/svelte/icons/settings";
	import UserIcon from "@lucide/svelte/icons/user";

	let {
		onSignOut,
		settingsHref = "/settings",
	}: {
		onSignOut?: () => void;
		settingsHref?: string;
	} = $props();

	const session = authClient.useSession();

	async function handleSignOut(): Promise<void> {
		await authClient.signOut();
		clearAuthToken();
		onSignOut?.();
	}

	function handleSettings(): void {
		void goto(settingsHref);
	}
</script>

{#if $session.data}
	{@const user = $session.data.user}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button variant="ghost" size="icon" {...props}>
					{#if user.image}
						<img src={user.image} alt={user.name} class="size-7 rounded-full" />
					{:else}
						<UserIcon class="size-4" />
					{/if}
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="w-56">
			<div class="px-1.5 py-1.5">
				<p class="text-xs text-muted-foreground">{user.email}</p>
			</div>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onclick={handleSettings}>
				<SettingsIcon class="mr-2 size-4" />
				{$_("auth.userMenu.settings")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onclick={handleSignOut}>
				<LogOutIcon class="mr-2 size-4" />
				{$_("auth.userMenu.signOut")}
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/if}
