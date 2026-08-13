<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { onMount } from 'svelte'
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
	import SearchIcon from '@lucide/svelte/icons/search'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import UsersIcon from '@lucide/svelte/icons/users'
	import XIcon from '@lucide/svelte/icons/x'
	import { client } from '$apiContract/client'
	import type { ListAdminUsersRequest, ListAdminUsersResponse, ListAdminUsersResponseItem } from '$apiContract/admin-users'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Badge } from '$frontend/ui/badge'
	import { Button } from '$frontend/ui/button'
	import * as Empty from '$frontend/ui/empty'
	import * as Field from '$frontend/ui/field'
	import * as InputGroup from '$frontend/ui/input-group'
	import * as Pagination from '$frontend/ui/pagination'
	import { Skeleton } from '$frontend/ui/skeleton'
	import * as Table from '$frontend/ui/table'
	import { createCloudflareDatabaseUrl } from '../admin-cloudflare'
	import { createAdminPageSearch, readAdminDetailKey } from '../admin-detail-state'
	import { formatCreditAmount } from '../admin-presentation'
	import UserDetailSheet from './UserDetailSheet.svelte'
	import { parseUserListQuery } from './users-page'

	type UserListState = { status: 'loading' } | { status: 'loaded'; data: ListAdminUsersResponse } | { status: 'error' }

	let {
		data
	}: {
		data: {
			locale: string
			cloudflareAccountId: string
		}
	} = $props()

	const initialQuery: ListAdminUsersRequest = parseUserListQuery(page.url)
	const initialDetailKey: string = readAdminDetailKey(page.url)
	let query: ListAdminUsersRequest = $state(initialQuery)
	let searchInput: string = $state(initialQuery.search ?? '')
	let currentPage: number = $state(initialQuery.page ?? 1)
	let listState: UserListState = $state({ status: 'loading' })
	let selectedUser: ListAdminUsersResponseItem | null = $state(null)
	let detailOpen: boolean = $state(false)
	let initialized: boolean = $state(false)
	let detailStateReady: boolean = $state(false)

	$effect((): void => {
		const nextPage: number = currentPage
		if (!initialized || nextPage === query.page) {
			return
		}
		query = { ...query, page: nextPage }
		updateUrl(query)
		void loadUsers()
	})

	$effect((): void => {
		if (!detailStateReady) {
			return
		}
		const detailKey: string = detailOpen ? (selectedUser?.id ?? '') : ''
		if (detailKey === readAdminDetailKey(page.url)) {
			return
		}
		updateUrl(query, detailKey)
	})

	onMount((): void => {
		initialized = true
		void loadUsers()
	})

	async function loadUsers(): Promise<void> {
		listState = { status: 'loading' }
		try {
			const response: ListAdminUsersResponse = await client.api.listAdminUsers(query)
			listState = { status: 'loaded', data: response }
			if (selectedUser !== null) {
				selectedUser = response.items.find((user: ListAdminUsersResponseItem): boolean => {
					return user.id === selectedUser?.id
				}) ?? selectedUser
			}
			if (!detailStateReady) {
				const selected: ListAdminUsersResponseItem | undefined = response.items.find((user: ListAdminUsersResponseItem): boolean => user.id === initialDetailKey)
				if (selected !== undefined) {
					selectedUser = selected
					detailOpen = true
				}
				detailStateReady = true
			}
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

	function updateUrl(input: ListAdminUsersRequest, detailKey: string = ''): void {
		const params: URLSearchParams = new URLSearchParams()
		if (input.search) {
			params.set('search', input.search)
		}
		if ((input.page ?? 1) > 1) {
			params.set('page', String(input.page))
		}
		const search: string = createAdminPageSearch(params, detailKey)
		void goto(`${page.url.pathname}${search === '' ? '' : `?${search}`}`, {
			keepFocus: true,
			noScroll: true
		})
	}

	function openUser(user: ListAdminUsersResponseItem): void {
		selectedUser = user
		detailOpen = true
	}

	function updateUserCreditBalance(balance: string): void {
		if (selectedUser === null || listState.status !== 'loaded') {
			return
		}
		const userId: string = selectedUser.id
		const items: ListAdminUsersResponseItem[] = listState.data.items.map((user: ListAdminUsersResponseItem): ListAdminUsersResponseItem => {
			return user.id === userId ? { ...user, credit_balance: balance } : user
		})
		selectedUser = { ...selectedUser, credit_balance: balance }
		listState = {
			status: 'loaded',
			data: { ...listState.data, items }
		}
	}

	function formatDate(value: number): string {
		return new Intl.DateTimeFormat(data.locale, { dateStyle: 'medium' }).format(value)
	}
</script>

<main class="admin-page">
	<header class="admin-page-header">
		<h1>{$_('admin.users.title')}</h1>
		<Button variant="outline" size="icon-sm" onclick={loadUsers} aria-label={$_('admin.users.refresh')} title={$_('admin.users.refresh')}>
			<RefreshCwIcon class={listState.status === 'loading' ? 'animate-spin' : ''} />
		</Button>
	</header>

	<form class="admin-filter-bar w-full border-0 bg-transparent p-0 sm:max-w-xl" onsubmit={submitSearch}>
		<Field.Field>
			<Field.Label class="sr-only" for="user-search">{$_('admin.users.searchLabel')}</Field.Label>
			<InputGroup.Root>
				<InputGroup.Addon><SearchIcon /></InputGroup.Addon>
				<InputGroup.Input id="user-search" bind:value={searchInput} autocomplete="off" placeholder={$_('admin.users.searchPlaceholder')} />
				<InputGroup.Addon align="inline-end">
					{#if query.search}
						<InputGroup.Button type="button" size="icon-xs" onclick={resetSearch} aria-label={$_('admin.users.reset')} title={$_('admin.users.reset')}><XIcon /></InputGroup.Button>
					{/if}
					<InputGroup.Button type="submit" size="icon-xs" aria-label={$_('admin.users.search')} title={$_('admin.users.search')}><SearchIcon /></InputGroup.Button>
				</InputGroup.Addon>
			</InputGroup.Root>
		</Field.Field>
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
		<div class="admin-table-panel">
			<Table.Root class="min-w-[1000px]">
				<Table.Header>
					<Table.Row>
						<Table.Head>{$_('admin.users.user')}</Table.Head>
						<Table.Head>{$_('admin.users.access')}</Table.Head>
						<Table.Head>{$_('admin.users.source')}</Table.Head>
						<Table.Head>{$_('admin.users.remainingCredits')}</Table.Head>
						<Table.Head>{$_('admin.users.shard')}</Table.Head>
						<Table.Head>{$_('admin.users.created')}</Table.Head>
						<Table.Head class="sticky right-0 z-20 w-12 bg-background text-right"><span class="sr-only">{$_('admin.users.actions')}</span></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if listState.status === 'loading'}
						{#each Array(6) as _item}
							<Table.Row>
								<Table.Cell><Skeleton class="h-5 w-48" /></Table.Cell>
								<Table.Cell><Skeleton class="h-5 w-32" /></Table.Cell>
								<Table.Cell><Skeleton class="h-5 w-20" /></Table.Cell>
								<Table.Cell><Skeleton class="h-5 w-20" /></Table.Cell>
								<Table.Cell><Skeleton class="h-8 w-32" /></Table.Cell>
								<Table.Cell><Skeleton class="h-5 w-24" /></Table.Cell>
								<Table.Cell class="sticky right-0 z-10 bg-background"><Skeleton class="ml-auto size-8" /></Table.Cell>
							</Table.Row>
						{/each}
					{:else}
						{#each listState.data.items as user (user.id)}
							<Table.Row class="group">
								<Table.Cell>
									<div class="max-w-72">
										<p class="truncate text-sm font-medium">{user.name}</p>
										<p class="truncate text-xs text-muted-foreground">{user.email}</p>
									</div>
								</Table.Cell>
								<Table.Cell>
									<div class="flex flex-wrap gap-1.5">
										<Badge variant={user.email_verified ? 'secondary' : 'outline'}>{user.email_verified ? $_('admin.users.emailVerified') : $_('admin.users.emailUnverified')}</Badge>
										{#if user.beta_access}
											<Badge variant="secondary">{$_('admin.users.betaGranted')}</Badge>
										{/if}
									</div>
								</Table.Cell>
								<Table.Cell>{user.registration_utm_source ?? $_('admin.users.sourceDirect')}</Table.Cell>
								<Table.Cell class="tabular-nums">{formatCreditAmount(user.credit_balance, data.locale)}</Table.Cell>
								<Table.Cell>
									{#if user.shard}
										{@const databaseUrl: string | null = createCloudflareDatabaseUrl(data.cloudflareAccountId, user.shard.database_id)}
										<div class="grid gap-0.5">
											{#if databaseUrl}
												<a href={databaseUrl} target="_blank" rel="noopener" class="inline-flex w-fit items-center gap-1 font-mono text-xs font-medium text-primary hover:underline">
													{user.shard.database_name}
													<ExternalLinkIcon class="size-3" />
												</a>
											{:else}
												<span class="font-mono text-xs font-medium">{user.shard.database_name}</span>
											{/if}
											<span class="text-xs text-muted-foreground">{user.shard.region}</span>
										</div>
									{:else}
										{$_('admin.common.none')}
									{/if}
								</Table.Cell>
								<Table.Cell>{formatDate(user.created_at)}</Table.Cell>
								<Table.Cell class="sticky right-0 z-10 bg-background group-hover:bg-accent">
									<Button class="ml-auto" variant="ghost" size="icon-sm" onclick={() => openUser(user)} aria-label={$_('admin.users.view')} title={$_('admin.users.view')}><ChevronRightIcon /></Button>
								</Table.Cell>
							</Table.Row>
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		</div>

		{#if listState.status === 'loaded' && listState.data.total > 0}
			<div class="admin-pagination">
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
	<UserDetailSheet bind:open={detailOpen} user={selectedUser} locale={data.locale} cloudflareDatabaseUrl={selectedUser?.shard ? createCloudflareDatabaseUrl(data.cloudflareAccountId, selectedUser.shard.database_id) : null} onCreditsGranted={updateUserCreditBalance} />
{/key}
