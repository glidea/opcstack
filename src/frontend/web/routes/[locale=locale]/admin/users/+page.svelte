<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { onMount } from 'svelte'
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
	import CopyIcon from '@lucide/svelte/icons/copy'
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
	import SearchIcon from '@lucide/svelte/icons/search'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import UsersIcon from '@lucide/svelte/icons/users'
	import { client } from '$apiContract/client'
	import type {
		ListAdminUsersRequest,
		ListAdminUsersResponse,
		ListAdminUsersResponseItem
	} from '$apiContract/admin-users'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Badge } from '$frontend/ui/badge'
	import { Button } from '$frontend/ui/button'
	import * as Empty from '$frontend/ui/empty'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import * as Pagination from '$frontend/ui/pagination'
	import { Skeleton } from '$frontend/ui/skeleton'
	import * as Table from '$frontend/ui/table'
	import UserDetailSheet from './UserDetailSheet.svelte'
	import { parseUserListQuery } from './users-page'

	type UserListState =
		| { status: 'loading' }
		| { status: 'loaded'; data: ListAdminUsersResponse }
		| { status: 'error' }

	let {
		data
	}: {
		data: {
			locale: string
		}
	} = $props()

	const initialQuery: ListAdminUsersRequest = parseUserListQuery(page.url)
	let query: ListAdminUsersRequest = $state(initialQuery)
	let searchInput: string = $state(initialQuery.search ?? '')
	let currentPage: number = $state(initialQuery.page ?? 1)
	let listState: UserListState = $state({ status: 'loading' })
	let selectedUser: ListAdminUsersResponseItem | null = $state(null)
	let detailOpen: boolean = $state(false)
	let initialized: boolean = $state(false)

	$effect((): void => {
		const nextPage: number = currentPage
		if (!initialized || nextPage === query.page) {
			return
		}
		query = { ...query, page: nextPage }
		updateUrl(query)
		void loadUsers()
	})

	onMount((): void => {
		initialized = true
		void loadUsers()
	})

	async function loadUsers(): Promise<void> {
		listState = { status: 'loading' }
		try {
			listState = { status: 'loaded', data: await client.api.listAdminUsers(query) }
		} catch {
			listState = { status: 'error' }
		}
	}

	function submitSearch(event: SubmitEvent): void {
		event.preventDefault()
		const search: string = searchInput.trim()
		query = {
			...(search === '' ? {} : { search }),
			page: 1,
			page_size: 20
		}
		currentPage = 1
		updateUrl(query)
		void loadUsers()
	}

	function resetSearch(): void {
		searchInput = ''
		query = { page: 1, page_size: 20 }
		currentPage = 1
		updateUrl(query)
		void loadUsers()
	}

	function updateUrl(input: ListAdminUsersRequest): void {
		const params: URLSearchParams = new URLSearchParams()
		if (input.search) {
			params.set('search', input.search)
		}
		if ((input.page ?? 1) > 1) {
			params.set('page', String(input.page))
		}
		const search: string = params.toString()
		void goto(`${page.url.pathname}${search === '' ? '' : `?${search}`}`, {
			keepFocus: true,
			noScroll: true
		})
	}

	function openUser(user: ListAdminUsersResponseItem): void {
		selectedUser = user
		detailOpen = true
	}

	function formatDate(value: number): string {
		return new Intl.DateTimeFormat(data.locale, { dateStyle: 'medium' }).format(value)
	}

	async function copyUserId(userId: string): Promise<void> {
		await navigator.clipboard.writeText(userId)
	}
</script>

<main class="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
	<header class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="text-xl font-semibold sm:text-2xl">{$_('admin.users.title')}</h1>
			<p class="mt-1 text-sm text-muted-foreground">{$_('admin.users.description')}</p>
		</div>
		<Button variant="outline" size="sm" onclick={loadUsers}>
			<RefreshCwIcon class={listState.status === 'loading' ? 'animate-spin' : ''} />
			{$_('admin.users.refresh')}
		</Button>
	</header>

	<form class="flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-end" onsubmit={submitSearch}>
		<Field.Field class="flex-1">
			<Field.Label for="user-search">{$_('admin.users.searchLabel')}</Field.Label>
			<div class="relative">
				<SearchIcon class="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
				<Input
					id="user-search"
					class="pl-9"
					bind:value={searchInput}
					autocomplete="off"
					placeholder={$_('admin.users.searchPlaceholder')}
				/>
			</div>
		</Field.Field>
		<div class="flex gap-2">
			<Button type="submit">{$_('admin.users.search')}</Button>
			{#if query.search}
				<Button type="button" variant="ghost" onclick={resetSearch}>{$_('admin.users.reset')}</Button>
			{/if}
		</div>
	</form>

	{#if listState.status === 'error'}
		<Alert.Root variant="destructive">
			<TriangleAlertIcon />
			<Alert.Title>{$_('admin.users.error.title')}</Alert.Title>
			<Alert.Description>{$_('admin.users.error.description')}</Alert.Description>
			<Alert.Action><Button variant="ghost" size="sm" onclick={loadUsers}>{$_('admin.users.retry')}</Button></Alert.Action>
		</Alert.Root>
	{:else if listState.status === 'loaded' && listState.data.items.length === 0}
		<Empty.Root class="min-h-80 border">
			<Empty.Media variant="icon"><UsersIcon /></Empty.Media>
			<Empty.Header>
				<Empty.Title>{$_('admin.users.empty.title')}</Empty.Title>
				<Empty.Description>{$_('admin.users.empty.description')}</Empty.Description>
			</Empty.Header>
			{#if query.search}
				<Empty.Content><Button variant="outline" onclick={resetSearch}>{$_('admin.users.reset')}</Button></Empty.Content>
			{/if}
		</Empty.Root>
	{:else}
		<div class="overflow-hidden rounded-lg border">
			<div class="overflow-x-auto">
				<Table.Root class="min-w-[980px]">
					<Table.Header>
						<Table.Row>
							<Table.Head>{$_('admin.users.user')}</Table.Head>
							<Table.Head>{$_('admin.users.verified')}</Table.Head>
							<Table.Head>{$_('admin.users.betaAccess')}</Table.Head>
							<Table.Head>{$_('admin.users.source')}</Table.Head>
							<Table.Head>{$_('admin.users.region')}</Table.Head>
							<Table.Head>{$_('admin.users.created')}</Table.Head>
							<Table.Head class="text-right">{$_('admin.users.actions')}</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if listState.status === 'loading'}
							{#each Array(6) as _item}
								<Table.Row>
									<Table.Cell><Skeleton class="h-5 w-48" /></Table.Cell>
									<Table.Cell><Skeleton class="h-5 w-16" /></Table.Cell>
									<Table.Cell><Skeleton class="h-5 w-16" /></Table.Cell>
									<Table.Cell><Skeleton class="h-5 w-20" /></Table.Cell>
									<Table.Cell><Skeleton class="h-5 w-16" /></Table.Cell>
									<Table.Cell><Skeleton class="h-5 w-24" /></Table.Cell>
									<Table.Cell><Skeleton class="ml-auto h-7 w-20" /></Table.Cell>
								</Table.Row>
							{/each}
						{:else}
							{#each listState.data.items as user (user.id)}
								<Table.Row>
									<Table.Cell>
										<div class="max-w-72">
											<p class="truncate text-sm font-medium">{user.name}</p>
											<p class="truncate text-xs text-muted-foreground">{user.email}</p>
										</div>
									</Table.Cell>
									<Table.Cell><Badge variant={user.email_verified ? 'secondary' : 'outline'}>{user.email_verified ? $_('admin.common.yes') : $_('admin.common.no')}</Badge></Table.Cell>
									<Table.Cell><Badge variant={user.beta_access ? 'secondary' : 'outline'}>{user.beta_access ? $_('admin.common.yes') : $_('admin.common.no')}</Badge></Table.Cell>
									<Table.Cell>{user.registration_utm_source ?? $_('admin.users.sourceDirect')}</Table.Cell>
									<Table.Cell>{user.shard?.region ?? $_('admin.common.none')}</Table.Cell>
									<Table.Cell>{formatDate(user.created_at)}</Table.Cell>
									<Table.Cell>
										<div class="flex justify-end gap-1">
											<Button variant="ghost" size="icon-sm" onclick={() => copyUserId(user.id)} aria-label={$_('admin.users.copyId')} title={$_('admin.users.copyId')}><CopyIcon /></Button>
											<Button variant="outline" size="sm" onclick={() => openUser(user)}>{$_('admin.users.view')}</Button>
										</div>
									</Table.Cell>
								</Table.Row>
							{/each}
						{/if}
					</Table.Body>
				</Table.Root>
			</div>
		</div>

		{#if listState.status === 'loaded' && listState.data.total > 0}
			<div class="flex flex-col items-center justify-between gap-3 sm:flex-row">
				<p class="text-sm text-muted-foreground">{$_('admin.users.total', { values: { count: listState.data.total } })}</p>
				<Pagination.Root count={listState.data.total} perPage={20} bind:page={currentPage} class="mx-0 w-auto">
					{#snippet children({ pages, currentPage: activePage })}
						<Pagination.Content>
							<Pagination.Item>
								<Pagination.PrevButton aria-label={$_('admin.pagination.previous')}><ChevronLeftIcon /><span class="sr-only">{$_('admin.pagination.previous')}</span></Pagination.PrevButton>
							</Pagination.Item>
							{#each pages as item (item.key)}
								{#if item.type === 'ellipsis'}
									<Pagination.Item><Pagination.Ellipsis /></Pagination.Item>
								{:else}
									<Pagination.Item><Pagination.Link page={item} isActive={activePage === item.value}>{item.value}</Pagination.Link></Pagination.Item>
								{/if}
							{/each}
							<Pagination.Item>
								<Pagination.NextButton aria-label={$_('admin.pagination.next')}><span class="sr-only">{$_('admin.pagination.next')}</span><ChevronRightIcon /></Pagination.NextButton>
							</Pagination.Item>
						</Pagination.Content>
					{/snippet}
				</Pagination.Root>
			</div>
		{/if}
	{/if}
</main>

{#key selectedUser?.id}
	<UserDetailSheet bind:open={detailOpen} user={selectedUser} locale={data.locale} />
{/key}
