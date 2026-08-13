<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { client } from '$apiContract/client'
	import type { AdminAffiliateReferralItem, ListAdminAffiliateReferralsRequest, ListAdminAffiliateReferralsResponse } from '$apiContract/aff'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Button } from '$frontend/ui/button'
	import * as Empty from '$frontend/ui/empty'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import * as Pagination from '$frontend/ui/pagination'
	import * as Select from '$frontend/ui/select'
	import { Skeleton } from '$frontend/ui/skeleton'
	import * as Table from '$frontend/ui/table'
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import UserRoundPlusIcon from '@lucide/svelte/icons/user-round-plus'
	import { onMount } from 'svelte'

	type ReferralListState = { status: 'loading' } | { status: 'loaded'; data: ListAdminAffiliateReferralsResponse } | { status: 'error' }

	let { data }: { data: { locale: string } } = $props()
	const initialSearch: string = page.url.searchParams.get('search') ?? ''
	const initialStatus: string = page.url.searchParams.get('reward_status') ?? 'all'
	const initialPage: number = Number(page.url.searchParams.get('page') ?? '1')
	let searchInput: string = $state(initialSearch)
	let statusInput: string = $state(initialStatus)
	let currentPage: number = $state(initialPage)
	let query: ListAdminAffiliateReferralsRequest = $state(createQuery(initialSearch, initialStatus, initialPage))
	let listState: ReferralListState = $state({ status: 'loading' })
	let initialized: boolean = $state(false)

	$effect((): void => {
		const nextPage: number = currentPage
		if (!initialized || nextPage === query.page) return
		query = { ...query, page: nextPage }
		updateUrl(query)
		void loadReferrals()
	})

	onMount((): void => {
		initialized = true
		void loadReferrals()
	})

	function createQuery(search: string, status: string, pageNumber: number): ListAdminAffiliateReferralsRequest {
		const normalizedSearch: string = search.trim()
		return {
			...(normalizedSearch === '' ? {} : { search: normalizedSearch }),
			...(status === 'all' ? {} : { reward_status: status as 'pending' | 'completed' }),
			page: pageNumber,
			page_size: 20
		}
	}

	async function loadReferrals(): Promise<void> {
		listState = { status: 'loading' }
		try {
			const response: ListAdminAffiliateReferralsResponse = await client.api.listAdminAffiliateReferrals(query)
			listState = { status: 'loaded', data: response }
		} catch {
			listState = { status: 'error' }
		}
	}

	function applyFilters(event: SubmitEvent): void {
		event.preventDefault()
		query = createQuery(searchInput, statusInput, 1)
		currentPage = 1
		updateUrl(query)
		void loadReferrals()
	}

	function resetFilters(): void {
		searchInput = ''
		statusInput = 'all'
		query = createQuery('', 'all', 1)
		currentPage = 1
		updateUrl(query)
		void loadReferrals()
	}

	function updateUrl(input: ListAdminAffiliateReferralsRequest): void {
		const search: URLSearchParams = new URLSearchParams()
		if (input.search !== undefined) search.set('search', input.search)
		if (input.reward_status !== undefined) search.set('reward_status', input.reward_status)
		if ((input.page ?? 1) > 1) search.set('page', String(input.page))
		const queryString: string = search.toString()
		void goto(`${page.url.pathname}${queryString === '' ? '' : `?${queryString}`}`, { keepFocus: true, noScroll: true })
	}

	function formatDate(value: number): string {
		return new Intl.DateTimeFormat(data.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(value)
	}

	function userIdentity(user: AdminAffiliateReferralItem['inviter']): string {
		return user.name === '' ? user.email : `${user.name} · ${user.email}`
	}
</script>

<main class="admin-page">
	<header class="admin-page-header">
		<h1>{$_('admin.affiliateReferrals.title')}</h1>
		<Button variant="outline" size="icon" onclick={loadReferrals} aria-label={$_('admin.affiliateReferrals.refresh')} title={$_('admin.affiliateReferrals.refresh')}><RefreshCwIcon class={listState.status === 'loading' ? 'animate-spin' : ''} /></Button>
	</header>

	<form class="admin-filter-bar sm:grid-cols-[minmax(16rem,1fr)_minmax(13rem,0.6fr)_auto] sm:items-end" onsubmit={applyFilters}>
		<Field.Field><Field.Label for="affiliate-referral-search">{$_('admin.affiliateReferrals.search')}</Field.Label><Input id="affiliate-referral-search" bind:value={searchInput} placeholder={$_('admin.affiliateReferrals.searchPlaceholder')} autocomplete="off" /></Field.Field>
		<Field.Field>
			<Field.Label for="affiliate-referral-status">{$_('admin.affiliateReferrals.status')}</Field.Label>
			<Select.Root type="single" bind:value={statusInput}><Select.Trigger id="affiliate-referral-status" class="w-full">{statusInput === 'all' ? $_('admin.affiliateReferrals.allStatuses') : statusInput === 'completed' ? $_('admin.affiliateReferrals.completed') : $_('admin.affiliateReferrals.pending')}</Select.Trigger><Select.Content><Select.Item value="all">{$_('admin.affiliateReferrals.allStatuses')}</Select.Item><Select.Item value="completed">{$_('admin.affiliateReferrals.completed')}</Select.Item><Select.Item value="pending">{$_('admin.affiliateReferrals.pending')}</Select.Item></Select.Content></Select.Root>
		</Field.Field>
		<div class="admin-filter-actions"><Button type="submit">{$_('admin.affiliateReferrals.apply')}</Button>{#if query.search !== undefined || query.reward_status !== undefined}<Button type="button" variant="ghost" onclick={resetFilters}>{$_('admin.affiliateReferrals.reset')}</Button>{/if}</div>
	</form>

	{#if listState.status === 'error'}
		<Alert.Root variant="destructive"><TriangleAlertIcon /><Alert.Title>{$_('admin.affiliateReferrals.error.title')}</Alert.Title><Alert.Description>{$_('admin.affiliateReferrals.error.description')}</Alert.Description><Alert.Action><Button variant="ghost" size="sm" onclick={loadReferrals}>{$_('admin.affiliateReferrals.retry')}</Button></Alert.Action></Alert.Root>
	{:else if listState.status === 'loaded' && listState.data.items.length === 0}
		<Empty.Root class="min-h-80 border"><Empty.Media variant="icon"><UserRoundPlusIcon /></Empty.Media><Empty.Header><Empty.Title>{$_('admin.affiliateReferrals.empty.title')}</Empty.Title><Empty.Description>{$_('admin.affiliateReferrals.empty.description')}</Empty.Description></Empty.Header>{#if query.search !== undefined || query.reward_status !== undefined}<Empty.Content><Button variant="outline" onclick={resetFilters}>{$_('admin.affiliateReferrals.reset')}</Button></Empty.Content>{/if}</Empty.Root>
	{:else}
		<div class="admin-table-panel">
			<Table.Root class="min-w-[760px]">
				<Table.Header><Table.Row><Table.Head>{$_('admin.affiliateReferrals.created')}</Table.Head><Table.Head>{$_('admin.affiliateReferrals.inviter')}</Table.Head><Table.Head>{$_('admin.affiliateReferrals.invitee')}</Table.Head><Table.Head>{$_('admin.affiliateReferrals.rewardStatus')}</Table.Head></Table.Row></Table.Header>
				<Table.Body>
					{#if listState.status === 'loading'}
						{#each Array(6) as _item}<Table.Row>{#each Array(4) as _cell}<Table.Cell><Skeleton class="h-5 w-28" /></Table.Cell>{/each}</Table.Row>{/each}
					{:else}
						{#each listState.data.items as item (item.id)}<Table.Row><Table.Cell>{formatDate(item.created_at)}</Table.Cell><Table.Cell class="max-w-64 truncate font-medium">{userIdentity(item.inviter)}</Table.Cell><Table.Cell class="max-w-64 truncate">{userIdentity(item.invitee)}</Table.Cell><Table.Cell class={item.reward_status === 'completed' ? 'text-emerald-700' : 'text-muted-foreground'}>{item.reward_status === 'completed' ? $_('admin.affiliateReferrals.completed') : $_('admin.affiliateReferrals.pending')}</Table.Cell></Table.Row>{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		</div>
		{#if listState.status === 'loaded' && listState.data.total > 0}
			<div class="admin-pagination">
				<p class="text-sm text-muted-foreground">{$_('admin.affiliateReferrals.total', { values: { count: listState.data.total } })}</p>
				<Pagination.Root count={listState.data.total} perPage={20} bind:page={currentPage} class="mx-0 w-auto">{#snippet children({ pages, currentPage: activePage })}<Pagination.Content><Pagination.Item><Pagination.PrevButton aria-label={$_('admin.pagination.previous')}><ChevronLeftIcon /><span class="sr-only">{$_('admin.pagination.previous')}</span></Pagination.PrevButton></Pagination.Item>{#each pages as item (item.key)}{#if item.type === 'ellipsis'}<Pagination.Item><Pagination.Ellipsis /></Pagination.Item>{:else}<Pagination.Item><Pagination.Link page={item} isActive={activePage === item.value}>{item.value}</Pagination.Link></Pagination.Item>{/if}{/each}<Pagination.Item><Pagination.NextButton aria-label={$_('admin.pagination.next')}><span class="sr-only">{$_('admin.pagination.next')}</span><ChevronRightIcon /></Pagination.NextButton></Pagination.Item></Pagination.Content>{/snippet}</Pagination.Root>
			</div>
		{/if}
	{/if}
</main>
