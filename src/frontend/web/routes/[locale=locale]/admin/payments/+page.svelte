<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { client } from '$apiContract/client'
	import type {
		AdminPaymentTransactionItem,
		ListAdminPaymentTransactionsRequest,
		ListAdminPaymentTransactionsResponse
	} from '$apiContract/payment'
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
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
	import CreditCardIcon from '@lucide/svelte/icons/credit-card'
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import { onMount } from 'svelte'
	import PaymentDetailSheet from './PaymentDetailSheet.svelte'
	import {
		createPaymentSearchParams,
		createPaymentUserHref,
		formatPaymentAmount,
		getPaymentStatusVariant,
		parsePaymentListQuery
	} from './payments-page'

	type PaymentListState =
		| { status: 'loading' }
		| { status: 'loaded'; data: ListAdminPaymentTransactionsResponse }
		| { status: 'error' }

	let {
		data
	}: {
		data: {
			locale: string
		}
	} = $props()

	const initialQuery: ListAdminPaymentTransactionsRequest = parsePaymentListQuery(page.url)
	let query: ListAdminPaymentTransactionsRequest = $state(initialQuery)
	let userInput: string = $state(initialQuery.user_id ?? '')
	let typeInput: string = $state(initialQuery.type ?? '')
	let statusInput: string = $state(initialQuery.status ?? '')
	let currentPage: number = $state(initialQuery.page ?? 1)
	let listState: PaymentListState = $state({ status: 'loading' })
	let selectedTransaction: AdminPaymentTransactionItem | null = $state(null)
	let detailOpen: boolean = $state(false)
	let initialized: boolean = $state(false)

	$effect((): void => {
		const nextPage: number = currentPage
		if (!initialized || nextPage === query.page) {
			return
		}
		query = { ...query, page: nextPage }
		updateUrl(query)
		void loadTransactions()
	})

	onMount((): void => {
		initialized = true
		void loadTransactions()
	})

	async function loadTransactions(): Promise<void> {
		listState = { status: 'loading' }
		try {
			listState = {
				status: 'loaded',
				data: await client.api.listAdminPaymentTransactions(query)
			}
		} catch {
			listState = { status: 'error' }
		}
	}

	function applyFilters(event: SubmitEvent): void {
		event.preventDefault()
		const userId: string = userInput.trim()
		const type: string = typeInput.trim()
		const status: string = statusInput.trim()
		query = {
			...(userId === '' ? {} : { user_id: userId }),
			...(type === '' ? {} : { type }),
			...(status === '' ? {} : { status }),
			page: 1,
			page_size: 20
		}
		currentPage = 1
		updateUrl(query)
		void loadTransactions()
	}

	function resetFilters(): void {
		userInput = ''
		typeInput = ''
		statusInput = ''
		query = { page: 1, page_size: 20 }
		currentPage = 1
		updateUrl(query)
		void loadTransactions()
	}

	function updateUrl(input: ListAdminPaymentTransactionsRequest): void {
		const search: string = createPaymentSearchParams(input).toString()
		void goto(`${page.url.pathname}${search === '' ? '' : `?${search}`}`, {
			keepFocus: true,
			noScroll: true
		})
	}

	function hasFilters(): boolean {
		return createPaymentSearchParams({ ...query, page: 1 }).toString() !== ''
	}

	function openTransaction(transaction: AdminPaymentTransactionItem): void {
		selectedTransaction = transaction
		detailOpen = true
	}

	function formatDate(value: number): string {
		return new Intl.DateTimeFormat(data.locale, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(value)
	}
</script>

<main class="mx-auto w-full max-w-[1650px] space-y-6 p-4 sm:p-6 lg:p-8">
	<header class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="text-xl font-semibold sm:text-2xl">{$_('admin.payments.title')}</h1>
			<p class="mt-1 text-sm text-muted-foreground">{$_('admin.payments.description')}</p>
		</div>
		<Button variant="outline" size="sm" onclick={loadTransactions}>
			<RefreshCwIcon class={listState.status === 'loading' ? 'animate-spin' : ''} />
			{$_('admin.payments.refresh')}
		</Button>
	</header>

	<form class="grid gap-3 sm:grid-cols-3 sm:items-end" onsubmit={applyFilters}>
		<Field.Field>
			<Field.Label for="payment-user-filter">{$_('admin.payments.user')}</Field.Label>
			<Input id="payment-user-filter" bind:value={userInput} autocomplete="off" placeholder={$_('admin.payments.userPlaceholder')} />
		</Field.Field>
		<Field.Field>
			<Field.Label for="payment-type-filter">{$_('admin.payments.type')}</Field.Label>
			<Input id="payment-type-filter" bind:value={typeInput} autocomplete="off" placeholder={$_('admin.payments.typePlaceholder')} />
		</Field.Field>
		<Field.Field>
			<Field.Label for="payment-status-filter">{$_('admin.payments.status')}</Field.Label>
			<Input id="payment-status-filter" bind:value={statusInput} autocomplete="off" placeholder={$_('admin.payments.statusPlaceholder')} />
		</Field.Field>
		<div class="flex gap-2 sm:col-span-3">
			<Button type="submit">{$_('admin.payments.apply')}</Button>
			{#if hasFilters()}<Button type="button" variant="ghost" onclick={resetFilters}>{$_('admin.payments.reset')}</Button>{/if}
		</div>
	</form>

	{#if listState.status === 'error'}
		<Alert.Root variant="destructive">
			<TriangleAlertIcon />
			<Alert.Title>{$_('admin.payments.error.title')}</Alert.Title>
			<Alert.Description>{$_('admin.payments.error.description')}</Alert.Description>
			<Alert.Action><Button variant="ghost" size="sm" onclick={loadTransactions}>{$_('admin.payments.retry')}</Button></Alert.Action>
		</Alert.Root>
	{:else if listState.status === 'loaded' && listState.data.items.length === 0}
		<Empty.Root class="min-h-80 border">
			<Empty.Media variant="icon"><CreditCardIcon /></Empty.Media>
			<Empty.Header>
				<Empty.Title>{$_('admin.payments.empty.title')}</Empty.Title>
				<Empty.Description>{$_('admin.payments.empty.description')}</Empty.Description>
			</Empty.Header>
			{#if hasFilters()}<Empty.Content><Button variant="outline" onclick={resetFilters}>{$_('admin.payments.reset')}</Button></Empty.Content>{/if}
		</Empty.Root>
	{:else}
		<div class="overflow-hidden rounded-lg border">
			<div class="overflow-x-auto">
				<Table.Root class="min-w-[1120px]">
					<Table.Header>
						<Table.Row>
							<Table.Head>{$_('admin.payments.created')}</Table.Head>
							<Table.Head>{$_('admin.payments.user')}</Table.Head>
							<Table.Head>{$_('admin.payments.product')}</Table.Head>
							<Table.Head>{$_('admin.payments.type')}</Table.Head>
							<Table.Head>{$_('admin.payments.amount')}</Table.Head>
							<Table.Head>{$_('admin.payments.status')}</Table.Head>
							<Table.Head>{$_('admin.payments.credits')}</Table.Head>
							<Table.Head class="text-right">{$_('admin.payments.actions')}</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if listState.status === 'loading'}
							{#each Array(6) as _item}<Table.Row>{#each Array(8) as _cell}<Table.Cell><Skeleton class="h-5 w-24" /></Table.Cell>{/each}</Table.Row>{/each}
						{:else}
							{#each listState.data.items as item (item.id)}
								<Table.Row class={item.status === 'refunded' || item.status === 'disputed' ? 'bg-destructive/5' : ''}>
									<Table.Cell>{formatDate(item.created_at)}</Table.Cell>
									<Table.Cell><a class="font-mono text-xs underline-offset-4 hover:underline" href={createPaymentUserHref(data.locale, item.user_id)}>{item.user_id}</a></Table.Cell>
									<Table.Cell>{item.product_id}</Table.Cell>
									<Table.Cell>{item.type}</Table.Cell>
									<Table.Cell>{formatPaymentAmount(item.amount, item.currency, data.locale)}</Table.Cell>
									<Table.Cell><Badge variant={getPaymentStatusVariant(item.status)}>{item.status}</Badge></Table.Cell>
									<Table.Cell>{item.credits_granted}</Table.Cell>
									<Table.Cell class="text-right"><Button variant="outline" size="sm" onclick={() => openTransaction(item)}>{$_('admin.payments.view')}</Button></Table.Cell>
								</Table.Row>
							{/each}
						{/if}
					</Table.Body>
				</Table.Root>
			</div>
		</div>

		{#if listState.status === 'loaded' && listState.data.total > 0}
			<div class="flex flex-col items-center justify-between gap-3 sm:flex-row">
				<p class="text-sm text-muted-foreground">{$_('admin.payments.total', { values: { count: listState.data.total } })}</p>
				<Pagination.Root count={listState.data.total} perPage={20} bind:page={currentPage} class="mx-0 w-auto">
					{#snippet children({ pages, currentPage: activePage })}
						<Pagination.Content>
							<Pagination.Item><Pagination.PrevButton aria-label={$_('admin.pagination.previous')}><ChevronLeftIcon /><span class="sr-only">{$_('admin.pagination.previous')}</span></Pagination.PrevButton></Pagination.Item>
							{#each pages as item (item.key)}
								{#if item.type === 'ellipsis'}<Pagination.Item><Pagination.Ellipsis /></Pagination.Item>{:else}<Pagination.Item><Pagination.Link page={item} isActive={activePage === item.value}>{item.value}</Pagination.Link></Pagination.Item>{/if}
							{/each}
							<Pagination.Item><Pagination.NextButton aria-label={$_('admin.pagination.next')}><span class="sr-only">{$_('admin.pagination.next')}</span><ChevronRightIcon /></Pagination.NextButton></Pagination.Item>
						</Pagination.Content>
					{/snippet}
				</Pagination.Root>
			</div>
		{/if}
	{/if}
</main>

{#key selectedTransaction?.id}
	<PaymentDetailSheet bind:open={detailOpen} transaction={selectedTransaction} locale={data.locale} />
{/key}
