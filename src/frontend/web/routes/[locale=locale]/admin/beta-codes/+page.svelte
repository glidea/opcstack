<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import type {
		ListBetaCodesRequest,
		ListBetaCodesResponse,
		ListBetaCodesResponseCode
	} from '$apiContract/beta'
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
	import KeyRoundIcon from '@lucide/svelte/icons/key-round'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import { onMount } from 'svelte'
	import GenerateBetaCodesDialog from './GenerateBetaCodesDialog.svelte'
	import { createBetaCodeSearchParams, parseBetaCodeListQuery } from './beta-codes-page'

	type BetaCodeListState =
		| { status: 'loading' }
		| { status: 'loaded'; data: ListBetaCodesResponse }
		| { status: 'error' }

	let {
		data
	}: {
		data: {
			locale: string
		}
	} = $props()

	const initialQuery: ListBetaCodesRequest = parseBetaCodeListQuery(page.url)
	let query: ListBetaCodesRequest = $state(initialQuery)
	let codeInput: string = $state(initialQuery.code ?? '')
	let usedByInput: string = $state(initialQuery.used_by ?? '')
	let usedFilter: string = $state(
		initialQuery.used === true ? 'used' : initialQuery.used === false ? 'unused' : 'all'
	)
	let createdStartInput: string = $state(formatDateInput(initialQuery.created_at_start))
	let createdEndInput: string = $state(formatDateInput(initialQuery.created_at_end))
	let currentPage: number = $state(initialQuery.page ?? 1)
	let listState: BetaCodeListState = $state({ status: 'loading' })
	let generateOpen: boolean = $state(false)
	let copiedCode: string = $state('')
	let initialized: boolean = $state(false)

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
			listState = { status: 'loaded', data: await client.api.listBetaCodes(query) }
		} catch {
			listState = { status: 'error' }
		}
	}

	function applyFilters(event: SubmitEvent): void {
		event.preventDefault()
		const code: string = codeInput.trim()
		const usedBy: string = usedByInput.trim()
		const createdAtStart: number | undefined = parseLocalDate(createdStartInput, false)
		const createdAtEnd: number | undefined = parseLocalDate(createdEndInput, true)
		query = {
			...(code === '' ? {} : { code }),
			...(usedBy === '' ? {} : { used_by: usedBy }),
			...(usedFilter === 'used' ? { used: true } : {}),
			...(usedFilter === 'unused' ? { used: false } : {}),
			...(createdAtStart === undefined ? {} : { created_at_start: createdAtStart }),
			...(createdAtEnd === undefined ? {} : { created_at_end: createdAtEnd }),
			page: 1,
			page_size: 20
		}
		currentPage = 1
		updateUrl(query)
		void loadCodes()
	}

	function resetFilters(): void {
		codeInput = ''
		usedByInput = ''
		usedFilter = 'all'
		createdStartInput = ''
		createdEndInput = ''
		query = { page: 1, page_size: 20 }
		currentPage = 1
		updateUrl(query)
		void loadCodes()
	}

	function updateUrl(input: ListBetaCodesRequest): void {
		const search: string = createBetaCodeSearchParams(input).toString()
		void goto(`${page.url.pathname}${search === '' ? '' : `?${search}`}`, {
			keepFocus: true,
			noScroll: true
		})
	}

	function hasFilters(): boolean {
		return createBetaCodeSearchParams({ ...query, page: 1 }).toString() !== ''
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

	function parseLocalDate(value: string, endOfDay: boolean): number | undefined {
		if (value === '') {
			return undefined
		}
		return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`).getTime()
	}

	async function copyCode(code: string): Promise<void> {
		await navigator.clipboard.writeText(code)
		copiedCode = code
		setTimeout((): void => {
			copiedCode = ''
		}, 1500)
	}

	function userHref(item: ListBetaCodesResponseCode): string {
		return `/${data.locale}/admin/users?search=${encodeURIComponent(item.used_by ?? '')}`
	}
</script>

<main class="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
	<header class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="text-xl font-semibold sm:text-2xl">{$_('admin.betaCodes.title')}</h1>
			<p class="mt-1 text-sm text-muted-foreground">{$_('admin.betaCodes.description')}</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" size="sm" onclick={loadCodes}>
				<RefreshCwIcon class={listState.status === 'loading' ? 'animate-spin' : ''} />
				{$_('admin.betaCodes.refresh')}
			</Button>
			<Button size="sm" onclick={() => (generateOpen = true)}>
				<PlusIcon />
				{$_('admin.betaCodes.generate.action')}
			</Button>
		</div>
	</header>

	<form class="grid gap-3 lg:grid-cols-5 lg:items-end" onsubmit={applyFilters}>
		<Field.Field>
			<Field.Label for="beta-code-filter">{$_('admin.betaCodes.code')}</Field.Label>
			<Input
				id="beta-code-filter"
				bind:value={codeInput}
				autocomplete="off"
				placeholder={$_('admin.betaCodes.codePlaceholder')}
			/>
		</Field.Field>
		<Field.Field>
			<Field.Label for="beta-user-filter">{$_('admin.betaCodes.usedBy')}</Field.Label>
			<Input
				id="beta-user-filter"
				bind:value={usedByInput}
				autocomplete="off"
				placeholder={$_('admin.betaCodes.userPlaceholder')}
			/>
		</Field.Field>
		<Field.Field>
			<Field.Label for="beta-status-filter">{$_('admin.betaCodes.status')}</Field.Label>
			<Select.Root type="single" bind:value={usedFilter}>
				<Select.Trigger id="beta-status-filter" class="w-full">
					{usedFilter === 'used'
						? $_('admin.betaCodes.used')
						: usedFilter === 'unused'
							? $_('admin.betaCodes.unused')
							: $_('admin.betaCodes.allStatuses')}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="all">{$_('admin.betaCodes.allStatuses')}</Select.Item>
					<Select.Item value="unused">{$_('admin.betaCodes.unused')}</Select.Item>
					<Select.Item value="used">{$_('admin.betaCodes.used')}</Select.Item>
				</Select.Content>
			</Select.Root>
		</Field.Field>
		<Field.Field>
			<Field.Label for="beta-created-start">{$_('admin.betaCodes.createdStart')}</Field.Label>
			<Input id="beta-created-start" bind:value={createdStartInput} type="date" />
		</Field.Field>
		<Field.Field>
			<Field.Label for="beta-created-end">{$_('admin.betaCodes.createdEnd')}</Field.Label>
			<Input id="beta-created-end" bind:value={createdEndInput} type="date" />
		</Field.Field>
		<div class="flex gap-2 lg:col-span-5">
			<Button type="submit">{$_('admin.betaCodes.apply')}</Button>
			{#if hasFilters()}
				<Button type="button" variant="ghost" onclick={resetFilters}>{$_('admin.betaCodes.reset')}</Button>
			{/if}
		</div>
	</form>

	{#if listState.status === 'error'}
		<Alert.Root variant="destructive">
			<TriangleAlertIcon />
			<Alert.Title>{$_('admin.betaCodes.error.title')}</Alert.Title>
			<Alert.Description>{$_('admin.betaCodes.error.description')}</Alert.Description>
			<Alert.Action>
				<Button variant="ghost" size="sm" onclick={loadCodes}>{$_('admin.betaCodes.retry')}</Button>
			</Alert.Action>
		</Alert.Root>
	{:else if listState.status === 'loaded' && listState.data.items.length === 0}
		<Empty.Root class="min-h-80 border">
			<Empty.Media variant="icon"><KeyRoundIcon /></Empty.Media>
			<Empty.Header>
				<Empty.Title>{$_('admin.betaCodes.empty.title')}</Empty.Title>
				<Empty.Description>{$_('admin.betaCodes.empty.description')}</Empty.Description>
			</Empty.Header>
			{#if hasFilters()}
				<Empty.Content>
					<Button variant="outline" onclick={resetFilters}>{$_('admin.betaCodes.reset')}</Button>
				</Empty.Content>
			{/if}
		</Empty.Root>
	{:else}
		<div class="overflow-hidden rounded-lg border">
			<div class="overflow-x-auto">
				<Table.Root class="min-w-[800px]">
					<Table.Header>
						<Table.Row>
							<Table.Head>{$_('admin.betaCodes.code')}</Table.Head>
							<Table.Head>{$_('admin.betaCodes.status')}</Table.Head>
							<Table.Head>{$_('admin.betaCodes.usedBy')}</Table.Head>
							<Table.Head>{$_('admin.betaCodes.usedAt')}</Table.Head>
							<Table.Head>{$_('admin.betaCodes.created')}</Table.Head>
							<Table.Head class="text-right">{$_('admin.betaCodes.actions')}</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if listState.status === 'loading'}
							{#each Array(6) as _item}
								<Table.Row>
									<Table.Cell><Skeleton class="h-5 w-24" /></Table.Cell>
									<Table.Cell><Skeleton class="h-5 w-16" /></Table.Cell>
									<Table.Cell><Skeleton class="h-5 w-40" /></Table.Cell>
									<Table.Cell><Skeleton class="h-5 w-28" /></Table.Cell>
									<Table.Cell><Skeleton class="h-5 w-28" /></Table.Cell>
									<Table.Cell><Skeleton class="ml-auto h-7 w-8" /></Table.Cell>
								</Table.Row>
							{/each}
						{:else}
							{#each listState.data.items as item (item.id)}
								<Table.Row>
									<Table.Cell><code class="font-mono text-sm font-medium">{item.code}</code></Table.Cell>
									<Table.Cell>
										<Badge variant={item.used_by ? 'secondary' : 'outline'}>
											{item.used_by ? $_('admin.betaCodes.used') : $_('admin.betaCodes.unused')}
										</Badge>
									</Table.Cell>
									<Table.Cell>
										{#if item.used_by}
											<a class="font-mono text-xs underline-offset-4 hover:underline" href={userHref(item)}>{item.used_by}</a>
										{:else}
											{$_('admin.common.none')}
										{/if}
									</Table.Cell>
									<Table.Cell>{formatDate(item.used_at)}</Table.Cell>
									<Table.Cell>{formatDate(item.created_at)}</Table.Cell>
									<Table.Cell class="text-right">
										<Button
											variant="ghost"
											size="icon-sm"
											onclick={() => copyCode(item.code)}
											aria-label={$_('admin.betaCodes.copyCode')}
											title={$_('admin.betaCodes.copyCode')}
										>
											{#if copiedCode === item.code}<CheckIcon />{:else}<CopyIcon />{/if}
										</Button>
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
				<p class="text-sm text-muted-foreground">
					{$_('admin.betaCodes.total', { values: { count: listState.data.total } })}
				</p>
				<Pagination.Root count={listState.data.total} perPage={20} bind:page={currentPage} class="mx-0 w-auto">
					{#snippet children({ pages, currentPage: activePage })}
						<Pagination.Content>
							<Pagination.Item>
								<Pagination.PrevButton aria-label={$_('admin.pagination.previous')}>
									<ChevronLeftIcon />
									<span class="sr-only">{$_('admin.pagination.previous')}</span>
								</Pagination.PrevButton>
							</Pagination.Item>
							{#each pages as item (item.key)}
								{#if item.type === 'ellipsis'}
									<Pagination.Item><Pagination.Ellipsis /></Pagination.Item>
								{:else}
									<Pagination.Item>
										<Pagination.Link page={item} isActive={activePage === item.value}>
											{item.value}
										</Pagination.Link>
									</Pagination.Item>
								{/if}
							{/each}
							<Pagination.Item>
								<Pagination.NextButton aria-label={$_('admin.pagination.next')}>
									<span class="sr-only">{$_('admin.pagination.next')}</span>
									<ChevronRightIcon />
								</Pagination.NextButton>
							</Pagination.Item>
						</Pagination.Content>
					{/snippet}
				</Pagination.Root>
			</div>
		{/if}
	{/if}
</main>

<GenerateBetaCodesDialog bind:open={generateOpen} onGenerated={loadCodes} />
