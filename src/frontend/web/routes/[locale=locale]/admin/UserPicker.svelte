<script lang="ts">
	import { client } from '$apiContract/client'
	import type {
		ListAdminUsersResponse,
		ListAdminUsersResponseItem
	} from '$apiContract/users'
	import { _ } from '$frontend/i18n'
	import { Button } from '$frontend/ui/button'
	import * as Command from '$frontend/ui/command'
	import * as Field from '$frontend/ui/field'
	import * as Popover from '$frontend/ui/popover'
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down'
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle'
	import XIcon from '@lucide/svelte/icons/x'
	import {
		findAdminUserById,
		formatAdminUserIdentity
	} from './user-picker'

	type UserSearchState =
		| { status: 'idle'; users: ListAdminUsersResponseItem[] }
		| { status: 'loading'; users: ListAdminUsersResponseItem[] }
		| { status: 'loaded'; users: ListAdminUsersResponseItem[] }
		| { status: 'error'; users: ListAdminUsersResponseItem[] }

	let {
		id,
		label,
		value = $bindable(''),
		selectedUser = $bindable(null)
	}: {
		id: string
		label: string
		value?: string
		selectedUser?: ListAdminUsersResponseItem | null
	} = $props()

	let open: boolean = $state(false)
	let searchInput: string = $state('')
	let searchState: UserSearchState = $state({ status: 'idle', users: [] })
	let requestSequence: number = 0
	let resolvedUserId: string = ''
	let visibleIdentity: string = $derived(
		selectedUser === null
			? value === ''
				? $_('admin.userPicker.placeholder')
				: $_('admin.userPicker.unknown')
			: formatAdminUserIdentity(selectedUser)
	)

	$effect((): void => {
		const userId: string = value
		if (userId === '') {
			selectedUser = null
			resolvedUserId = ''
			return
		}
		if (selectedUser?.id === userId || resolvedUserId === userId) {
			return
		}
		resolvedUserId = userId
		void resolveUser(userId)
	})

	$effect(() => {
		const search: string = searchInput.trim()
		if (!open || search.length < 2) {
			searchState = { status: 'idle', users: [] }
			return
		}
		const timeoutId: ReturnType<typeof setTimeout> = setTimeout((): void => {
			void searchUsers(search)
		}, 250)
		return (): void => clearTimeout(timeoutId)
	})

	async function resolveUser(userId: string): Promise<void> {
		const sequence: number = ++requestSequence
		try {
			const response: ListAdminUsersResponse = await client.api.listAdminUsers({
				search: userId,
				page: 1,
				page_size: 20
			})
			if (sequence === requestSequence && value === userId) {
				selectedUser = findAdminUserById(response.items, userId)
			}
		} catch {
			if (sequence === requestSequence && value === userId) {
				selectedUser = null
			}
		}
	}

	async function searchUsers(search: string): Promise<void> {
		const sequence: number = ++requestSequence
		searchState = { status: 'loading', users: [] }
		try {
			const response: ListAdminUsersResponse = await client.api.listAdminUsers({
				search,
				page: 1,
				page_size: 20
			})
			if (sequence === requestSequence) {
				searchState = { status: 'loaded', users: response.items }
			}
		} catch {
			if (sequence === requestSequence) {
				searchState = { status: 'error', users: [] }
			}
		}
	}

	function selectUser(user: ListAdminUsersResponseItem): void {
		selectedUser = user
		value = user.id
		resolvedUserId = user.id
		searchInput = ''
		open = false
	}

	function clearUser(): void {
		requestSequence += 1
		selectedUser = null
		value = ''
		resolvedUserId = ''
		searchInput = ''
		searchState = { status: 'idle', users: [] }
	}
</script>

<Field.Field>
	<Field.Label for={id}>{label}</Field.Label>
	<div class="flex min-w-0 gap-1">
		<Popover.Root bind:open>
			<Popover.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						{id}
						variant="outline"
						class="min-w-0 flex-1 justify-between px-3 font-normal"
						aria-label={`${label}: ${visibleIdentity}`}
					>
						<span class="truncate text-left">{visibleIdentity}</span>
						<ChevronsUpDownIcon class="ml-2 shrink-0 text-muted-foreground" />
					</Button>
				{/snippet}
			</Popover.Trigger>
			<Popover.Content align="start" class="w-[min(24rem,calc(100vw-2rem))] p-1">
				<Command.Root>
					<Command.Input bind:value={searchInput} placeholder={$_('admin.userPicker.searchPlaceholder')} />
					<Command.List>
						{#if searchState.status === 'idle'}
							<div class="px-3 py-6 text-center text-sm text-muted-foreground">{$_('admin.userPicker.prompt')}</div>
						{:else if searchState.status === 'loading'}
							<div class="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
								<LoaderCircleIcon class="animate-spin" />
								{$_('admin.userPicker.loading')}
							</div>
						{:else if searchState.status === 'error'}
							<div class="px-3 py-6 text-center text-sm text-destructive">{$_('admin.userPicker.error')}</div>
						{:else if searchState.users.length === 0}
							<Command.Empty>{$_('admin.userPicker.empty')}</Command.Empty>
						{:else}
							{#each searchState.users as user (user.id)}
								<Command.Item
									value={formatAdminUserIdentity(user)}
									onSelect={() => selectUser(user)}
								>
									<div class="min-w-0">
										<p class="truncate font-medium">{user.name || user.email}</p>
										{#if user.name !== ''}<p class="truncate text-xs text-muted-foreground">{user.email}</p>{/if}
									</div>
								</Command.Item>
							{/each}
						{/if}
					</Command.List>
				</Command.Root>
			</Popover.Content>
		</Popover.Root>
		{#if value !== ''}
			<Button
				type="button"
				variant="ghost"
				size="icon"
				onclick={clearUser}
				aria-label={$_('admin.userPicker.clear')}
			>
				<XIcon />
			</Button>
		{/if}
	</div>
</Field.Field>
