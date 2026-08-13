<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { client } from '$apiContract/client'
	import type {
		CreditTransactionResponseItem,
		ListAdminCreditTransactionsRequest,
		ListAdminCreditTransactionsResponse
	} from '$apiContract/credits'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Button } from '$frontend/ui/button'
	import * as Empty from '$frontend/ui/empty'
	import * as Field from '$frontend/ui/field'
	import * as Pagination from '$frontend/ui/pagination'
	import * as Select from '$frontend/ui/select'
	import { Skeleton } from '$frontend/ui/skeleton'
	import * as Table from '$frontend/ui/table'
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
	import HistoryIcon from '@lucide/svelte/icons/history'
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import { onMount } from 'svelte'
	import AdminUserPicker from '../AdminUserPicker.svelte'
	import { formatCreditAmount } from '../admin-presentation'

	type CreditTransactionKind =
		| 'signup'
		| 'daily_checkin'
		| 'redemption_code'
		| 'manual_grant'
		| 'payment_purchase'
		| 'payment_refund'
		| 'affiliate_inviter'
		| 'affiliate_invitee'
		| 'consume'
		| 'expired'
	type CreditListState =
		| { status: 'idle' }
		| { status: 'loading' }
		| { status: 'loaded'; data: ListAdminCreditTransactionsResponse }
		| { status: 'error' }

	const TRANSACTION_TYPES: CreditTransactionKind[] = [
		'signup',
		'daily_checkin',
		'redemption_code',
		'manual_grant',
		'payment_purchase',
		'payment_refund',
		'affiliate_inviter',
		'affiliate_invitee',
		'consume',
		'expired'
	]

	let { data }: { data: { locale: string } } = $props()
	const initialUserId: string = page.url.searchParams.get('user_id') ?? ''
	const initialType: string = page.url.searchParams.get('type') ?? 'all'
	let userInput: string = $state(initialUserId)
	let typeInput: string = $state(initialType)
	let query: ListAdminCreditTransactionsRequest | null = $state(createQuery(initialUserId, initialType, 1))
	let currentPage: number = $state(1)
	let listState: CreditListState = $state({ status: initialUserId === '' ? 'idle' : 'loading' })
	let initialized: boolean = $state(false)

	$effect((): void => {
		const nextPage: number = currentPage
		if (!initialized || query === null || nextPage === query.page) return
		query = { ...query, page: nextPage }
		updateUrl(query)
		void loadTransactions()
	})

	onMount((): void => {
		initialized = true
		if (query !== null) void loadTransactions()
	})

	function createQuery(userId: string, type: string, pageNumber: number): ListAdminCreditTransactionsRequest | null {
		const normalizedUserId: string = userId.trim()
		if (normalizedUserId === '') return null
		return {
			user_id: normalizedUserId,
			...(type === 'all' ? {} : { type }),
			page: pageNumber,
			page_size: 20
		}
	}

	async function loadTransactions(): Promise<void> {
		if (query === null) {
			listState = { status: 'idle' }
			return
		}
		listState = { status: 'loading' }
		try {
			const response: ListAdminCreditTransactionsResponse = await client.api.listAdminCreditTransactions(query)
			listState = { status: 'loaded', data: response }
		} catch {
			listState = { status: 'error' }
		}
	}

	function applyFilters(event: SubmitEvent): void {
		event.preventDefault()
		query = createQuery(userInput, typeInput, 1)
		currentPage = 1
		updateUrl(query)
		void loadTransactions()
	}

	function resetFilters(): void {
		userInput = ''
		typeInput = 'all'
		query = null
		currentPage = 1
		updateUrl(null)
		listState = { status: 'idle' }
	}

	function updateUrl(input: ListAdminCreditTransactionsRequest | null): void {
		const search: URLSearchParams = new URLSearchParams()
		if (input !== null) {
			search.set('user_id', input.user_id)
			if (input.type !== undefined) search.set('type', input.type)
			if ((input.page ?? 1) > 1) search.set('page', String(input.page))
		}
		const queryString: string = search.toString()
		void goto(`${page.url.pathname}${queryString === '' ? '' : `?${queryString}`}`, { keepFocus: true, noScroll: true })
	}

	function transactionTypeLabel(type: string): string {
		switch (type) {
			case 'signup': return $_('admin.creditTransactions.types.signup')
			case 'daily_checkin': return $_('admin.creditTransactions.types.dailyCheckin')
			case 'redemption_code': return $_('admin.creditTransactions.types.redemptionCode')
			case 'manual_grant': return $_('admin.creditTransactions.types.manualGrant')
			case 'payment_purchase': return $_('admin.creditTransactions.types.paymentPurchase')
			case 'payment_refund': return $_('admin.creditTransactions.types.paymentRefund')
			case 'affiliate_inviter': return $_('admin.creditTransactions.types.affiliateInviter')
			case 'affiliate_invitee': return $_('admin.creditTransactions.types.affiliateInvitee')
			case 'consume': return $_('admin.creditTransactions.types.consume')
			case 'expired': return $_('admin.creditTransactions.types.expired')
			default: throw new Error(`Unsupported credit transaction type: ${type}`)
		}
	}

	function formatAmount(value: string): string {
		const formatted: string = formatCreditAmount(value, data.locale)
		return Number(value) > 0 ? `+${formatted}` : formatted
	}

	function formatDate(value: number): string {
		return new Intl.DateTimeFormat(data.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(value)
	}
</script>

<main class="admin-page">
	<header class="admin-page-header">
		<h1>{$_('admin.creditTransactions.title')}</h1>
		<Button variant="outline" size="icon" onclick={loadTransactions} disabled={query === null} aria-label={$_('admin.creditTransactions.refresh')} title={$_('admin.creditTransactions.refresh')}><RefreshCwIcon class={listState.status === 'loading' ? 'animate-spin' : ''} /></Button>
	</header>

	<form class="admin-filter-bar sm:grid-cols-[minmax(16rem,1fr)_minmax(13rem,0.7fr)_auto] sm:items-end" onsubmit={applyFilters}>
		<AdminUserPicker id="credit-transaction-user" label={$_('admin.creditTransactions.user')} bind:value={userInput} />
		<Field.Field>
			<Field.Label for="credit-transaction-type">{$_('admin.creditTransactions.type')}</Field.Label>
			<Select.Root type="single" bind:value={typeInput}>
				<Select.Trigger id="credit-transaction-type" class="w-full">{typeInput === 'all' ? $_('admin.creditTransactions.allTypes') : transactionTypeLabel(typeInput)}</Select.Trigger>
				<Select.Content>
					<Select.Item value="all">{$_('admin.creditTransactions.allTypes')}</Select.Item>
					{#each TRANSACTION_TYPES as type}<Select.Item value={type}>{transactionTypeLabel(type)}</Select.Item>{/each}
				</Select.Content>
			</Select.Root>
		</Field.Field>
		<div class="admin-filter-actions">
			<Button type="submit" disabled={userInput === ''}>{$_('admin.creditTransactions.apply')}</Button>
			{#if query !== null}<Button type="button" variant="ghost" onclick={resetFilters}>{$_('admin.creditTransactions.reset')}</Button>{/if}
		</div>
	</form>

	{#if listState.status === 'error'}
		<Alert.Root variant="destructive"><TriangleAlertIcon /><Alert.Title>{$_('admin.creditTransactions.error.title')}</Alert.Title><Alert.Description>{$_('admin.creditTransactions.error.description')}</Alert.Description><Alert.Action><Button variant="ghost" size="sm" onclick={loadTransactions}>{$_('admin.creditTransactions.retry')}</Button></Alert.Action></Alert.Root>
	{:else if listState.status === 'idle'}
		<Empty.Root class="min-h-80 border"><Empty.Media variant="icon"><HistoryIcon /></Empty.Media><Empty.Header><Empty.Title>{$_('admin.creditTransactions.selectUser.title')}</Empty.Title><Empty.Description>{$_('admin.creditTransactions.selectUser.description')}</Empty.Description></Empty.Header></Empty.Root>
	{:else if listState.status === 'loaded' && listState.data.items.length === 0}
		<Empty.Root class="min-h-80 border"><Empty.Media variant="icon"><HistoryIcon /></Empty.Media><Empty.Header><Empty.Title>{$_('admin.creditTransactions.empty.title')}</Empty.Title><Empty.Description>{$_('admin.creditTransactions.empty.description')}</Empty.Description></Empty.Header></Empty.Root>
	{:else}
		<div class="admin-table-panel">
			<Table.Root class="min-w-[760px]">
				<Table.Header><Table.Row><Table.Head>{$_('admin.creditTransactions.created')}</Table.Head><Table.Head>{$_('admin.creditTransactions.type')}</Table.Head><Table.Head class="text-right">{$_('admin.creditTransactions.change')}</Table.Head><Table.Head class="text-right">{$_('admin.creditTransactions.balance')}</Table.Head><Table.Head>{$_('admin.creditTransactions.description')}</Table.Head></Table.Row></Table.Header>
				<Table.Body>
					{#if listState.status === 'loading'}
						{#each Array(6) as _item}<Table.Row>{#each Array(5) as _cell}<Table.Cell><Skeleton class="h-5 w-24" /></Table.Cell>{/each}</Table.Row>{/each}
					{:else}
						{#each listState.data.items as item (item.id)}
							<Table.Row><Table.Cell>{formatDate(item.created_at)}</Table.Cell><Table.Cell>{transactionTypeLabel(item.type)}</Table.Cell><Table.Cell class={`text-right font-medium tabular-nums ${Number(item.amount) < 0 ? 'text-destructive' : 'text-emerald-700'}`}>{formatAmount(item.amount)}</Table.Cell><Table.Cell class="text-right tabular-nums">{formatCreditAmount(item.balance_after, data.locale)}</Table.Cell><Table.Cell class="max-w-72 truncate text-muted-foreground">{item.description ?? $_('admin.creditTransactions.noDescription')}</Table.Cell></Table.Row>
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		</div>
		{#if listState.status === 'loaded' && listState.data.total > 0}
			<div class="admin-pagination">
				<p class="text-sm text-muted-foreground">{$_('admin.creditTransactions.total', { values: { count: listState.data.total } })}</p>
				<Pagination.Root count={listState.data.total} perPage={20} bind:page={currentPage} class="mx-0 w-auto">
					{#snippet children({ pages, currentPage: activePage })}<Pagination.Content><Pagination.Item><Pagination.PrevButton aria-label={$_('admin.pagination.previous')}><ChevronLeftIcon /><span class="sr-only">{$_('admin.pagination.previous')}</span></Pagination.PrevButton></Pagination.Item>{#each pages as item (item.key)}{#if item.type === 'ellipsis'}<Pagination.Item><Pagination.Ellipsis /></Pagination.Item>{:else}<Pagination.Item><Pagination.Link page={item} isActive={activePage === item.value}>{item.value}</Pagination.Link></Pagination.Item>{/if}{/each}<Pagination.Item><Pagination.NextButton aria-label={$_('admin.pagination.next')}><span class="sr-only">{$_('admin.pagination.next')}</span><ChevronRightIcon /></Pagination.NextButton></Pagination.Item></Pagination.Content>{/snippet}
				</Pagination.Root>
			</div>
		{/if}
	{/if}
</main>
