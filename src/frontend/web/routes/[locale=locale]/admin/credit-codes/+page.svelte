<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import type { CreditCodeListResponseItem, ListCreditCodesRequest, ListCreditCodesResponse } from '$apiContract/credits'
	import { client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Badge } from '$frontend/ui/badge'
	import { Button } from '$frontend/ui/button'
	import * as Empty from '$frontend/ui/empty'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import * as Pagination from '$frontend/ui/pagination'
	import * as Select from '$frontend/ui/select'
	import { Skeleton } from '$frontend/ui/skeleton'
	import * as Table from '$frontend/ui/table'
	import CheckIcon from '@lucide/svelte/icons/check'
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
	import CopyIcon from '@lucide/svelte/icons/copy'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
	import TicketIcon from '@lucide/svelte/icons/ticket'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import { onMount } from 'svelte'
	import AdminAdvancedFilters from '../AdminAdvancedFilters.svelte'
	import AdminUserReference from '../AdminUserReference.svelte'
	import AdminUserPicker from '../AdminUserPicker.svelte'
	import { formatCreditAmount } from '../admin-presentation'
	import GenerateCreditCodesDialog from './GenerateCreditCodesDialog.svelte'
	import { createCreditCodeSearchParams, getCreditCodeStatusVariant, parseCreditCodeListQuery } from './credit-codes-page'

	type CreditCodeListState = { status: 'loading' } | { status: 'loaded'; data: ListCreditCodesResponse } | { status: 'error' }

	let {
		data
	}: {
		data: {
			locale: string
		}
	} = $props()

	const initialQuery: ListCreditCodesRequest = parseCreditCodeListQuery(page.url)
	let query: ListCreditCodesRequest = $state(initialQuery)
	let codeInput: string = $state(initialQuery.code ?? '')
	let claimedByInput: string = $state(initialQuery.claimed_by ?? '')
	let statusInput: string = $state(initialQuery.status ?? 'all')
	let amountInput: string = $state(initialQuery.amount ?? '')
	let createdStartInput: string = $state(formatDateInput(initialQuery.created_at_start))
	let createdEndInput: string = $state(formatDateInput(initialQuery.created_at_end))
	let expiresStartInput: string = $state(formatDateInput(initialQuery.expires_at_start))
	let expiresEndInput: string = $state(formatDateInput(initialQuery.expires_at_end))
	let currentPage: number = $state(initialQuery.page ?? 1)
	let listState: CreditCodeListState = $state({ status: 'loading' })
	let generateOpen: boolean = $state(false)
	let copiedCode: string = $state('')
	let initialized: boolean = $state(false)
	let advancedOpen: boolean = $state(initialQuery.amount !== undefined || initialQuery.created_at_start !== undefined || initialQuery.created_at_end !== undefined || initialQuery.expires_at_start !== undefined || initialQuery.expires_at_end !== undefined)
	const advancedFilterCount: number = $derived(Number(amountInput.trim() !== '') + Number(createdStartInput !== '') + Number(createdEndInput !== '') + Number(expiresStartInput !== '') + Number(expiresEndInput !== ''))

	$effect((): void => {
		const nextPage: number = currentPage
		if (!initialized || nextPage === query.page) {
			return
		}
		query = { ...query, page: nextPage }
		updateUrl(query)
		void loadCodes()
	})

	onMount((): void => {
		initialized = true
		void loadCodes()
	})

	async function loadCodes(): Promise<void> {
		listState = { status: 'loading' }
		try {
			listState = { status: 'loaded', data: await client.api.listCreditCodes(query) }
		} catch {
			listState = { status: 'error' }
		}
	}

	function applyFilters(event: SubmitEvent): void {
		event.preventDefault()
		const code: string = codeInput.trim()
		const claimedBy: string = claimedByInput.trim()
		const amount: string = amountInput.trim()
		const status: ListCreditCodesRequest['status'] = statusInput === 'unused' || statusInput === 'claimed' || statusInput === 'granted' ? statusInput : undefined
		query = {
			...(code === '' ? {} : { code }),
			...(claimedBy === '' ? {} : { claimed_by: claimedBy }),
			...(status === undefined ? {} : { status }),
			...(amount === '' ? {} : { amount }),
			...createDateFilter('created_at_start', createdStartInput, false),
			...createDateFilter('created_at_end', createdEndInput, true),
			...createDateFilter('expires_at_start', expiresStartInput, false),
			...createDateFilter('expires_at_end', expiresEndInput, true),
			page: 1,
			page_size: 20
		}
		currentPage = 1
		updateUrl(query)
		void loadCodes()
	}

	function resetFilters(): void {
		codeInput = ''
		claimedByInput = ''
		statusInput = 'all'
		amountInput = ''
		createdStartInput = ''
		createdEndInput = ''
		expiresStartInput = ''
		expiresEndInput = ''
		query = { page: 1, page_size: 20 }
		currentPage = 1
		updateUrl(query)
		void loadCodes()
	}

	function updateUrl(input: ListCreditCodesRequest): void {
		const search: string = createCreditCodeSearchParams(input).toString()
		void goto(`${page.url.pathname}${search === '' ? '' : `?${search}`}`, {
			keepFocus: true,
			noScroll: true
		})
	}

	function hasFilters(): boolean {
		return createCreditCodeSearchParams({ ...query, page: 1 }).toString() !== ''
	}

	function formatDate(value: number | null): string {
		if (value === null) {
			return $_('admin.common.none')
		}
		return new Intl.DateTimeFormat(data.locale, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(value)
	}

	function formatDateInput(value: number | undefined): string {
		if (value === undefined) {
			return ''
		}
		const date: Date = new Date(value)
		const year: string = String(date.getFullYear())
		const month: string = String(date.getMonth() + 1).padStart(2, '0')
		const day: string = String(date.getDate()).padStart(2, '0')
		return `${year}-${month}-${day}`
	}

	function createDateFilter(name: string, value: string, endOfDay: boolean): Record<string, number> {
		if (value === '') {
			return {}
		}
		const time: string = endOfDay ? '23:59:59.999' : '00:00:00.000'
		return { [name]: new Date(`${value}T${time}`).getTime() }
	}

	function statusLabel(status: string): string {
		switch (status) {
			case 'unused':
				return $_('admin.creditCodes.unused')
			case 'claimed':
				return $_('admin.creditCodes.claimed')
			case 'granted':
				return $_('admin.creditCodes.granted')
			default:
				throw new Error(`Unsupported credit code status: ${status}`)
		}
	}

	async function copyCode(code: string): Promise<void> {
		await navigator.clipboard.writeText(code)
		copiedCode = code
		setTimeout((): void => {
			copiedCode = ''
		}, 1500)
	}

	function userHref(item: CreditCodeListResponseItem): string {
		return `/${data.locale}/admin/users?search=${encodeURIComponent(item.claimed_by ?? '')}`
	}
</script>

<main class="admin-page">
	<header class="admin-page-header">
		<h1>{$_('admin.creditCodes.title')}</h1>
		<div class="admin-page-actions">
			<Button variant="outline" size="icon" onclick={loadCodes} aria-label={$_('admin.creditCodes.refresh')} title={$_('admin.creditCodes.refresh')}>
				<RefreshCwIcon class={listState.status === 'loading' ? 'animate-spin' : ''} />
			</Button>
			<Button onclick={() => (generateOpen = true)}>
				<PlusIcon />
				{$_('admin.creditCodes.generate.action')}
			</Button>
		</div>
	</header>

	<form class="admin-filter-bar border-0 bg-transparent p-0" onsubmit={applyFilters}>
		<div class="admin-filter-primary md:grid-cols-2 lg:grid-cols-[minmax(11rem,1fr)_minmax(14rem,1.3fr)_minmax(9rem,0.7fr)_auto] lg:items-end">
			<Field.Field>
				<Field.Label for="credit-code-filter">{$_('admin.creditCodes.code')}</Field.Label>
				<Input id="credit-code-filter" bind:value={codeInput} autocomplete="off" placeholder={$_('admin.creditCodes.codePlaceholder')} />
			</Field.Field>
			<AdminUserPicker id="credit-user-filter" label={$_('admin.creditCodes.claimedBy')} bind:value={claimedByInput} />
			<Field.Field>
				<Field.Label for="credit-status-filter">{$_('admin.creditCodes.status')}</Field.Label>
				<Select.Root type="single" bind:value={statusInput}>
					<Select.Trigger id="credit-status-filter" class="w-full">
						{statusInput === 'unused' ? $_('admin.creditCodes.unused') : statusInput === 'claimed' ? $_('admin.creditCodes.claimed') : statusInput === 'granted' ? $_('admin.creditCodes.granted') : $_('admin.creditCodes.allStatuses')}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="all">{$_('admin.creditCodes.allStatuses')}</Select.Item>
						<Select.Item value="unused">{$_('admin.creditCodes.unused')}</Select.Item>
						<Select.Item value="claimed">{$_('admin.creditCodes.claimed')}</Select.Item>
						<Select.Item value="granted">{$_('admin.creditCodes.granted')}</Select.Item>
					</Select.Content>
				</Select.Root>
			</Field.Field>
			<div class="admin-filter-actions md:col-span-2 lg:col-span-1">
				<Button type="submit">{$_('admin.creditCodes.apply')}</Button>
				{#if hasFilters()}
					<Button type="button" variant="ghost" onclick={resetFilters}>{$_('admin.creditCodes.reset')}</Button>
				{/if}
			</div>
		</div>
		<AdminAdvancedFilters bind:open={advancedOpen} count={advancedFilterCount} label={$_('admin.filters.advanced')} contentClass="md:grid-cols-2 xl:grid-cols-5">
			<Field.Field>
				<Field.Label for="credit-amount-filter">{$_('admin.creditCodes.amount')}</Field.Label>
				<Input id="credit-amount-filter" bind:value={amountInput} inputmode="decimal" autocomplete="off" placeholder="10" />
			</Field.Field>
			<Field.Field>
				<Field.Label for="credit-created-start">{$_('admin.creditCodes.createdStart')}</Field.Label>
				<Input id="credit-created-start" bind:value={createdStartInput} type="date" />
			</Field.Field>
			<Field.Field>
				<Field.Label for="credit-created-end">{$_('admin.creditCodes.createdEnd')}</Field.Label>
				<Input id="credit-created-end" bind:value={createdEndInput} type="date" />
			</Field.Field>
			<Field.Field>
				<Field.Label for="credit-expires-start">{$_('admin.creditCodes.expiresStart')}</Field.Label>
				<Input id="credit-expires-start" bind:value={expiresStartInput} type="date" />
			</Field.Field>
			<Field.Field>
				<Field.Label for="credit-expires-end">{$_('admin.creditCodes.expiresEnd')}</Field.Label>
				<Input id="credit-expires-end" bind:value={expiresEndInput} type="date" />
			</Field.Field>
		</AdminAdvancedFilters>
	</form>

	{#if listState.status === 'error'}
		<Alert.Root variant="destructive">
			<TriangleAlertIcon />
			<Alert.Title>{$_('admin.creditCodes.error.title')}</Alert.Title>
			<Alert.Description>{$_('admin.creditCodes.error.description')}</Alert.Description>
			<Alert.Action><Button variant="ghost" size="sm" onclick={loadCodes}>{$_('admin.creditCodes.retry')}</Button></Alert.Action>
		</Alert.Root>
	{:else if listState.status === 'loaded' && listState.data.items.length === 0}
		<Empty.Root class="min-h-80 border">
			<Empty.Media variant="icon"><TicketIcon /></Empty.Media>
			<Empty.Header>
				<Empty.Title>{$_('admin.creditCodes.empty.title')}</Empty.Title>
				<Empty.Description>{$_('admin.creditCodes.empty.description')}</Empty.Description>
			</Empty.Header>
			{#if hasFilters()}
				<Empty.Content><Button variant="outline" onclick={resetFilters}>{$_('admin.creditCodes.reset')}</Button></Empty.Content>
			{/if}
		</Empty.Root>
	{:else}
		<div class="admin-table-panel">
			<Table.Root class="min-w-[1280px]">
				<Table.Header>
					<Table.Row>
						<Table.Head>{$_('admin.creditCodes.code')}</Table.Head>
						<Table.Head>{$_('admin.creditCodes.amount')}</Table.Head>
						<Table.Head>{$_('admin.creditCodes.status')}</Table.Head>
						<Table.Head>{$_('admin.creditCodes.claimedBy')}</Table.Head>
						<Table.Head>{$_('admin.creditCodes.claimedAt')}</Table.Head>
						<Table.Head>{$_('admin.creditCodes.grantedAt')}</Table.Head>
						<Table.Head>{$_('admin.creditCodes.expires')}</Table.Head>
						<Table.Head>{$_('admin.creditCodes.created')}</Table.Head>
						<Table.Head class="sticky right-0 z-20 w-12 bg-background text-right"><span class="sr-only">{$_('admin.creditCodes.actions')}</span></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if listState.status === 'loading'}
						{#each Array(6) as _item}
							<Table.Row>
								{#each Array(9) as _cell}<Table.Cell><Skeleton class="h-5 w-24" /></Table.Cell>{/each}
							</Table.Row>
						{/each}
					{:else}
						{#each listState.data.items as item (item.id)}
							<Table.Row class={`group ${item.status === 'claimed' ? 'bg-destructive/5' : ''}`}>
								<Table.Cell><code class="font-mono text-sm font-medium">{item.code}</code></Table.Cell>
								<Table.Cell>{formatCreditAmount(item.amount, data.locale)}</Table.Cell>
								<Table.Cell><Badge variant={getCreditCodeStatusVariant(item.status)}>{statusLabel(item.status)}</Badge></Table.Cell>
								<Table.Cell>
									{#if item.claimed_by}<AdminUserReference userId={item.claimed_by} href={userHref(item)} />{:else}{$_('admin.common.none')}{/if}
								</Table.Cell>
								<Table.Cell>{formatDate(item.claimed_at)}</Table.Cell>
								<Table.Cell>{formatDate(item.granted_at)}</Table.Cell>
								<Table.Cell>{item.expires_at === null ? $_('admin.creditCodes.never') : formatDate(item.expires_at)}</Table.Cell>
								<Table.Cell>{formatDate(item.created_at)}</Table.Cell>
								<Table.Cell class={`sticky right-0 z-10 text-right group-hover:bg-accent ${item.status === 'claimed' ? 'bg-destructive/5' : 'bg-background'}`}>
									<Button variant="ghost" size="icon-sm" onclick={() => copyCode(item.code)} aria-label={$_('admin.creditCodes.copyCode')} title={$_('admin.creditCodes.copyCode')}>
										{#if copiedCode === item.code}<CheckIcon />{:else}<CopyIcon />{/if}
									</Button>
								</Table.Cell>
							</Table.Row>
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		</div>

		{#if listState.status === 'loaded' && listState.data.total > 0}
			<div class="admin-pagination">
				<p class="text-sm text-muted-foreground">{$_('admin.creditCodes.total', { values: { count: listState.data.total } })}</p>
				<Pagination.Root count={listState.data.total} perPage={20} bind:page={currentPage} class="mx-0 w-auto">
					{#snippet children({ pages, currentPage: activePage })}
						<Pagination.Content>
							<Pagination.Item><Pagination.PrevButton aria-label={$_('admin.pagination.previous')}><ChevronLeftIcon /><span class="sr-only">{$_('admin.pagination.previous')}</span></Pagination.PrevButton></Pagination.Item>
							{#each pages as item (item.key)}
								{#if item.type === 'ellipsis'}
									<Pagination.Item><Pagination.Ellipsis /></Pagination.Item>
								{:else}
									<Pagination.Item><Pagination.Link page={item} isActive={activePage === item.value}>{item.value}</Pagination.Link></Pagination.Item>
								{/if}
							{/each}
							<Pagination.Item><Pagination.NextButton aria-label={$_('admin.pagination.next')}><span class="sr-only">{$_('admin.pagination.next')}</span><ChevronRightIcon /></Pagination.NextButton></Pagination.Item>
						</Pagination.Content>
					{/snippet}
				</Pagination.Root>
			</div>
		{/if}
	{/if}
</main>

<GenerateCreditCodesDialog bind:open={generateOpen} locale={data.locale} onGenerated={loadCodes} />
