<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { client } from '$apiContract/client'
	import type {
		ListFeedbacksRequest,
		ListFeedbacksResponse,
		ListFeedbacksResponseItem
	} from '$apiContract/feedback'
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
	import MessageSquareTextIcon from '@lucide/svelte/icons/message-square-text'
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import { onMount } from 'svelte'
	import FeedbackDetailSheet from './FeedbackDetailSheet.svelte'
	import {
		createFeedbackSearchParams,
		createFeedbackUserHref,
		parseFeedbackListQuery,
		summarizeFeedback
	} from './feedback-page'

	type FeedbackListState =
		| { status: 'loading' }
		| { status: 'loaded'; data: ListFeedbacksResponse }
		| { status: 'error' }

	let {
		data
	}: {
		data: {
			locale: string
		}
	} = $props()

	const initialQuery: ListFeedbacksRequest = parseFeedbackListQuery(page.url)
	let query: ListFeedbacksRequest = $state(initialQuery)
	let userInput: string = $state(initialQuery.user_id ?? '')
	let typeInput: string = $state(initialQuery.type ?? '')
	let createdStartInput: string = $state(formatDateInput(initialQuery.created_at_start))
	let createdEndInput: string = $state(formatDateInput(initialQuery.created_at_end))
	let currentPage: number = $state(initialQuery.page ?? 1)
	let listState: FeedbackListState = $state({ status: 'loading' })
	let selectedFeedback: ListFeedbacksResponseItem | null = $state(null)
	let detailOpen: boolean = $state(false)
	let initialized: boolean = $state(false)

	$effect((): void => {
		const nextPage: number = currentPage
		if (!initialized || nextPage === query.page) {
			return
		}
		query = { ...query, page: nextPage }
		updateUrl(query)
		void loadFeedbacks()
	})

	onMount((): void => {
		initialized = true
		void loadFeedbacks()
	})

	async function loadFeedbacks(): Promise<void> {
		listState = { status: 'loading' }
		try {
			listState = { status: 'loaded', data: await client.api.listFeedbacks(query) }
		} catch {
			listState = { status: 'error' }
		}
	}

	function applyFilters(event: SubmitEvent): void {
		event.preventDefault()
		const userId: string = userInput.trim()
		const type: string = typeInput.trim()
		query = {
			...(userId === '' ? {} : { user_id: userId }),
			...(type === '' ? {} : { type }),
			...createDateFilter('created_at_start', createdStartInput, false),
			...createDateFilter('created_at_end', createdEndInput, true),
			page: 1,
			page_size: 20
		}
		currentPage = 1
		updateUrl(query)
		void loadFeedbacks()
	}

	function resetFilters(): void {
		userInput = ''
		typeInput = ''
		createdStartInput = ''
		createdEndInput = ''
		query = { page: 1, page_size: 20 }
		currentPage = 1
		updateUrl(query)
		void loadFeedbacks()
	}

	function updateUrl(input: ListFeedbacksRequest): void {
		const search: string = createFeedbackSearchParams(input).toString()
		void goto(`${page.url.pathname}${search === '' ? '' : `?${search}`}`, {
			keepFocus: true,
			noScroll: true
		})
	}

	function hasFilters(): boolean {
		return createFeedbackSearchParams({ ...query, page: 1 }).toString() !== ''
	}

	function openFeedback(feedback: ListFeedbacksResponseItem): void {
		selectedFeedback = feedback
		detailOpen = true
	}

	function formatDate(value: number): string {
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
</script>

<main class="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
	<header class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="text-xl font-semibold sm:text-2xl">{$_('admin.feedback.title')}</h1>
			<p class="mt-1 text-sm text-muted-foreground">{$_('admin.feedback.description')}</p>
		</div>
		<Button variant="outline" size="sm" onclick={loadFeedbacks}>
			<RefreshCwIcon class={listState.status === 'loading' ? 'animate-spin' : ''} />
			{$_('admin.feedback.refresh')}
		</Button>
	</header>

	<form class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end" onsubmit={applyFilters}>
		<Field.Field>
			<Field.Label for="feedback-user-filter">{$_('admin.feedback.user')}</Field.Label>
			<Input id="feedback-user-filter" bind:value={userInput} autocomplete="off" placeholder={$_('admin.feedback.userPlaceholder')} />
		</Field.Field>
		<Field.Field>
			<Field.Label for="feedback-type-filter">{$_('admin.feedback.type')}</Field.Label>
			<Input id="feedback-type-filter" bind:value={typeInput} autocomplete="off" placeholder={$_('admin.feedback.typePlaceholder')} />
		</Field.Field>
		<Field.Field>
			<Field.Label for="feedback-created-start">{$_('admin.feedback.createdStart')}</Field.Label>
			<Input id="feedback-created-start" bind:value={createdStartInput} type="date" />
		</Field.Field>
		<Field.Field>
			<Field.Label for="feedback-created-end">{$_('admin.feedback.createdEnd')}</Field.Label>
			<Input id="feedback-created-end" bind:value={createdEndInput} type="date" />
		</Field.Field>
		<div class="flex gap-2 sm:col-span-2 lg:col-span-4">
			<Button type="submit">{$_('admin.feedback.apply')}</Button>
			{#if hasFilters()}<Button type="button" variant="ghost" onclick={resetFilters}>{$_('admin.feedback.reset')}</Button>{/if}
		</div>
	</form>

	{#if listState.status === 'error'}
		<Alert.Root variant="destructive">
			<TriangleAlertIcon />
			<Alert.Title>{$_('admin.feedback.error.title')}</Alert.Title>
			<Alert.Description>{$_('admin.feedback.error.description')}</Alert.Description>
			<Alert.Action><Button variant="ghost" size="sm" onclick={loadFeedbacks}>{$_('admin.feedback.retry')}</Button></Alert.Action>
		</Alert.Root>
	{:else if listState.status === 'loaded' && listState.data.items.length === 0}
		<Empty.Root class="min-h-80 border">
			<Empty.Media variant="icon"><MessageSquareTextIcon /></Empty.Media>
			<Empty.Header>
				<Empty.Title>{$_('admin.feedback.empty.title')}</Empty.Title>
				<Empty.Description>{$_('admin.feedback.empty.description')}</Empty.Description>
			</Empty.Header>
			{#if hasFilters()}<Empty.Content><Button variant="outline" onclick={resetFilters}>{$_('admin.feedback.reset')}</Button></Empty.Content>{/if}
		</Empty.Root>
	{:else}
		<div class="overflow-hidden rounded-lg border">
			<div class="overflow-x-auto">
				<Table.Root class="min-w-[900px]">
					<Table.Header>
						<Table.Row>
							<Table.Head>{$_('admin.feedback.user')}</Table.Head>
							<Table.Head>{$_('admin.feedback.type')}</Table.Head>
							<Table.Head>{$_('admin.feedback.content')}</Table.Head>
							<Table.Head>{$_('admin.feedback.created')}</Table.Head>
							<Table.Head class="text-right">{$_('admin.feedback.actions')}</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if listState.status === 'loading'}
							{#each Array(6) as _item}
								<Table.Row>
									<Table.Cell><Skeleton class="h-5 w-44" /></Table.Cell>
									<Table.Cell><Skeleton class="h-5 w-20" /></Table.Cell>
									<Table.Cell><Skeleton class="h-5 w-80" /></Table.Cell>
									<Table.Cell><Skeleton class="h-5 w-32" /></Table.Cell>
									<Table.Cell><Skeleton class="ml-auto h-7 w-16" /></Table.Cell>
								</Table.Row>
							{/each}
						{:else}
							{#each listState.data.items as item (item.id)}
								<Table.Row>
									<Table.Cell><a class="font-mono text-xs underline-offset-4 hover:underline" href={createFeedbackUserHref(data.locale, item.user_id)}>{item.user_id}</a></Table.Cell>
									<Table.Cell><Badge variant="outline">{item.type}</Badge></Table.Cell>
									<Table.Cell><p class="max-w-2xl text-sm text-muted-foreground">{summarizeFeedback(item.content)}</p></Table.Cell>
									<Table.Cell>{formatDate(item.created_at)}</Table.Cell>
									<Table.Cell class="text-right"><Button variant="outline" size="sm" onclick={() => openFeedback(item)}>{$_('admin.feedback.view')}</Button></Table.Cell>
								</Table.Row>
							{/each}
						{/if}
					</Table.Body>
				</Table.Root>
			</div>
		</div>

		{#if listState.status === 'loaded' && listState.data.total > 0}
			<div class="flex flex-col items-center justify-between gap-3 sm:flex-row">
				<p class="text-sm text-muted-foreground">{$_('admin.feedback.total', { values: { count: listState.data.total } })}</p>
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

{#key selectedFeedback?.id}
	<FeedbackDetailSheet bind:open={detailOpen} feedback={selectedFeedback} locale={data.locale} />
{/key}
