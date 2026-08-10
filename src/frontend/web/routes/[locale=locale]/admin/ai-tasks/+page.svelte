<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import type { AdminAiTaskSummary, AdminAiTaskType, ListAdminAiTasksRequest, ListAdminAiTasksResponse } from '$apiContract/admin-ai-tasks'
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
	import BotIcon from '@lucide/svelte/icons/bot'
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import { onMount } from 'svelte'
	import AdminAdvancedFilters from '../AdminAdvancedFilters.svelte'
	import AdminUserReference from '../AdminUserReference.svelte'
	import AdminUserPicker from '../AdminUserPicker.svelte'
	import { createCloudflareQueuesUrl } from '../admin-cloudflare'
	import { createAdminPageSearch, readAdminDetailKey } from '../admin-detail-state'
	import AiTaskDetailSheet from './AiTaskDetailSheet.svelte'
	import { createAiTaskSearchParams, createAiTaskUserHref, getAiTaskStatusVariant, parseAiTaskListQuery, type CloudflareResourceContext } from './ai-tasks-page'

	type AiTaskListState = { status: 'loading' } | { status: 'loaded'; data: ListAdminAiTasksResponse } | { status: 'error' }

	let {
		data
	}: {
		data: {
			locale: string
			cloudflare: CloudflareResourceContext
		}
	} = $props()

	const initialQuery: ListAdminAiTasksRequest = parseAiTaskListQuery(page.url)
	const initialDetailKey: string = readAdminDetailKey(page.url)
	let query: ListAdminAiTasksRequest = $state(initialQuery)
	let taskTypeInput: string = $state(initialQuery.task_type ?? 'all')
	let idInput: string = $state(initialQuery.id ?? '')
	let userInput: string = $state(initialQuery.user_id ?? '')
	let statusInput: string = $state(initialQuery.status ?? 'all')
	let providerInput: string = $state(initialQuery.provider ?? '')
	let modelInput: string = $state(initialQuery.model ?? '')
	let createdStartInput: string = $state(formatDateTimeInput(initialQuery.created_at_start))
	let createdEndInput: string = $state(formatDateTimeInput(initialQuery.created_at_end))
	let currentPage: number = $state(initialQuery.page ?? 1)
	let listState: AiTaskListState = $state({ status: 'loading' })
	let selectedTask: AdminAiTaskSummary | null = $state(null)
	let detailOpen: boolean = $state(false)
	let initialized: boolean = $state(false)
	let detailStateReady: boolean = $state(false)
	const queuesUrl: string | null = $derived(createCloudflareQueuesUrl(data.cloudflare.accountId))
	let advancedOpen: boolean = $state(initialQuery.id !== undefined || initialQuery.provider !== undefined || initialQuery.model !== undefined || initialQuery.created_at_start !== undefined || initialQuery.created_at_end !== undefined)
	const advancedFilterCount: number = $derived(Number(idInput.trim() !== '') + Number(providerInput.trim() !== '') + Number(modelInput.trim() !== '') + Number(createdStartInput !== '') + Number(createdEndInput !== ''))

	$effect((): void => {
		const nextPage: number = currentPage
		if (!initialized || nextPage === query.page) {
			return
		}
		query = { ...query, page: nextPage }
		updateUrl(query)
		void loadTasks()
	})

	$effect((): void => {
		if (!detailStateReady) {
			return
		}
		const detailKey: string = detailOpen && selectedTask ? createTaskDetailKey(selectedTask) : ''
		if (detailKey === readAdminDetailKey(page.url)) {
			return
		}
		updateUrl(query, detailKey)
	})

	onMount((): void => {
		initialized = true
		void loadTasks()
	})

	async function loadTasks(): Promise<void> {
		listState = { status: 'loading' }
		try {
			const response: ListAdminAiTasksResponse = await client.api.listAdminAiTasks(query)
			listState = {
				status: 'loaded',
				data: response
			}
			if (!detailStateReady) {
				const selected: AdminAiTaskSummary | undefined = response.items.find((task: AdminAiTaskSummary): boolean => createTaskDetailKey(task) === initialDetailKey)
				if (selected !== undefined) {
					selectedTask = selected
					detailOpen = true
				}
				detailStateReady = true
			}
		} catch {
			listState = { status: 'error' }
		}
	}

	function applyFilters(event: SubmitEvent): void {
		event.preventDefault()
		const taskType: AdminAiTaskType | undefined = readTaskType(taskTypeInput)
		const id: string = idInput.trim()
		const userId: string = userInput.trim()
		const status: string = statusInput === 'all' ? '' : statusInput
		const provider: string = providerInput.trim()
		const model: string = modelInput.trim()
		query = {
			...(taskType === undefined ? {} : { task_type: taskType }),
			...(id === '' ? {} : { id }),
			...(userId === '' ? {} : { user_id: userId }),
			...(status === '' ? {} : { status }),
			...(provider === '' ? {} : { provider }),
			...(model === '' ? {} : { model }),
			...(createdStartInput === '' ? {} : { created_at_start: new Date(createdStartInput).getTime() }),
			...(createdEndInput === '' ? {} : { created_at_end: new Date(createdEndInput).getTime() }),
			page: 1,
			page_size: 20
		}
		currentPage = 1
		updateUrl(query)
		void loadTasks()
	}

	function resetFilters(): void {
		taskTypeInput = 'all'
		idInput = ''
		userInput = ''
		statusInput = 'all'
		providerInput = ''
		modelInput = ''
		createdStartInput = ''
		createdEndInput = ''
		query = { page: 1, page_size: 20 }
		currentPage = 1
		updateUrl(query)
		void loadTasks()
	}

	function updateUrl(input: ListAdminAiTasksRequest, detailKey: string = ''): void {
		const search: string = createAdminPageSearch(createAiTaskSearchParams(input), detailKey)
		void goto(`${page.url.pathname}${search === '' ? '' : `?${search}`}`, {
			keepFocus: true,
			noScroll: true
		})
	}

	function hasFilters(): boolean {
		return createAiTaskSearchParams({ ...query, page: 1 }).toString() !== ''
	}

	function openTask(task: AdminAiTaskSummary): void {
		selectedTask = task
		detailOpen = true
	}

	function createTaskDetailKey(task: AdminAiTaskSummary): string {
		return JSON.stringify([task.task_type, task.shard_id, task.id])
	}

	function formatDate(value: number): string {
		return new Intl.DateTimeFormat(data.locale, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(value)
	}

	function formatDateTimeInput(value: number | undefined): string {
		if (value === undefined) {
			return ''
		}
		const date: Date = new Date(value)
		const localTime: Date = new Date(value - date.getTimezoneOffset() * 60_000)
		return localTime.toISOString().slice(0, 16)
	}

	function readTaskType(value: string): AdminAiTaskType | undefined {
		switch (value) {
			case 'image':
			case 'tts':
			case 'video':
				return value
			default:
				return undefined
		}
	}

	function taskTypeLabel(type: string): string {
		switch (type) {
			case 'image':
				return $_('admin.aiTasks.image')
			case 'tts':
				return 'TTS'
			case 'video':
				return $_('admin.aiTasks.video')
			default:
				throw new Error(`Unsupported AI task type: ${type}`)
		}
	}

	function taskStatusLabel(status: string): string {
		switch (status) {
			case 'processing':
				return $_('admin.aiTasks.status.processing')
			case 'completed':
				return $_('admin.aiTasks.status.completed')
			case 'failed':
				return $_('admin.aiTasks.status.failed')
			default:
				throw new Error(`Unsupported AI task status: ${status}`)
		}
	}
</script>

<main class="admin-page">
	<header class="admin-page-header">
		<h1>{$_('admin.aiTasks.title')}</h1>
		<div class="admin-page-actions">
			{#if queuesUrl}
				<Button variant="ghost" size="sm" href={queuesUrl} target="_blank" rel="noopener">
					{$_('admin.aiTasks.openQueues')}
					<ExternalLinkIcon class="size-3.5" />
				</Button>
			{/if}
			<Button variant="outline" size="icon-sm" onclick={loadTasks} aria-label={$_('admin.aiTasks.refresh')} title={$_('admin.aiTasks.refresh')}>
				<RefreshCwIcon class={listState.status === 'loading' ? 'animate-spin' : ''} />
			</Button>
		</div>
	</header>

	<form class="admin-filter-bar" onsubmit={applyFilters}>
		<div class="admin-filter-primary md:grid-cols-2 xl:grid-cols-[minmax(10rem,0.8fr)_minmax(15rem,1.3fr)_minmax(10rem,0.8fr)_auto] xl:items-end">
			<Field.Field>
				<Field.Label for="ai-task-type-filter">{$_('admin.aiTasks.type')}</Field.Label>
				<Select.Root type="single" bind:value={taskTypeInput}>
					<Select.Trigger id="ai-task-type-filter" class="w-full"><span>{taskTypeInput === 'all' ? $_('admin.aiTasks.allTypes') : taskTypeLabel(taskTypeInput)}</span></Select.Trigger>
					<Select.Content>
						<Select.Item value="all">{$_('admin.aiTasks.allTypes')}</Select.Item>
						<Select.Item value="image">{taskTypeLabel('image')}</Select.Item>
						<Select.Item value="tts">{taskTypeLabel('tts')}</Select.Item>
						<Select.Item value="video">{taskTypeLabel('video')}</Select.Item>
					</Select.Content>
				</Select.Root>
			</Field.Field>
			<AdminUserPicker id="ai-task-user-filter" label={$_('admin.aiTasks.user')} bind:value={userInput} />
			<Field.Field>
				<Field.Label for="ai-task-status-filter">{$_('admin.aiTasks.status')}</Field.Label>
				<Select.Root type="single" bind:value={statusInput}>
					<Select.Trigger id="ai-task-status-filter" class="w-full"><span>{statusInput === 'all' ? $_('admin.aiTasks.allStatuses') : taskStatusLabel(statusInput)}</span></Select.Trigger>
					<Select.Content>
						<Select.Item value="all">{$_('admin.aiTasks.allStatuses')}</Select.Item>
						<Select.Item value="processing">{taskStatusLabel('processing')}</Select.Item>
						<Select.Item value="completed">{taskStatusLabel('completed')}</Select.Item>
						<Select.Item value="failed">{taskStatusLabel('failed')}</Select.Item>
					</Select.Content>
				</Select.Root>
			</Field.Field>
			<div class="admin-filter-actions md:col-span-2 xl:col-span-1">
				<Button type="submit">{$_('admin.aiTasks.apply')}</Button>
				{#if hasFilters()}<Button type="button" variant="ghost" onclick={resetFilters}>{$_('admin.aiTasks.reset')}</Button>{/if}
			</div>
		</div>
		<AdminAdvancedFilters bind:open={advancedOpen} count={advancedFilterCount} label={$_('admin.filters.advanced')} contentClass="md:grid-cols-2 xl:grid-cols-5">
			<Field.Field>
				<Field.Label for="ai-task-id-filter">{$_('admin.aiTasks.id')}</Field.Label>
				<Input id="ai-task-id-filter" bind:value={idInput} autocomplete="off" placeholder={$_('admin.aiTasks.idPlaceholder')} />
			</Field.Field>
			<Field.Field>
				<Field.Label for="ai-task-provider-filter">{$_('admin.aiTasks.provider')}</Field.Label>
				<Input id="ai-task-provider-filter" bind:value={providerInput} autocomplete="off" placeholder={$_('admin.aiTasks.providerPlaceholder')} />
			</Field.Field>
			<Field.Field>
				<Field.Label for="ai-task-model-filter">{$_('admin.aiTasks.model')}</Field.Label>
				<Input id="ai-task-model-filter" bind:value={modelInput} autocomplete="off" placeholder={$_('admin.aiTasks.modelPlaceholder')} />
			</Field.Field>
			<Field.Field>
				<Field.Label for="ai-task-created-start">{$_('admin.aiTasks.createdStart')}</Field.Label>
				<Input id="ai-task-created-start" type="datetime-local" bind:value={createdStartInput} />
			</Field.Field>
			<Field.Field>
				<Field.Label for="ai-task-created-end">{$_('admin.aiTasks.createdEnd')}</Field.Label>
				<Input id="ai-task-created-end" type="datetime-local" bind:value={createdEndInput} />
			</Field.Field>
		</AdminAdvancedFilters>
	</form>

	{#if listState.status === 'error'}
		<Alert.Root variant="destructive">
			<TriangleAlertIcon />
			<Alert.Title>{$_('admin.aiTasks.error.title')}</Alert.Title>
			<Alert.Description>{$_('admin.aiTasks.error.description')}</Alert.Description>
			<Alert.Action><Button variant="ghost" size="sm" onclick={loadTasks}>{$_('admin.aiTasks.retry')}</Button></Alert.Action>
		</Alert.Root>
	{:else if listState.status === 'loaded' && listState.data.items.length === 0}
		<Empty.Root class="min-h-80 border">
			<Empty.Media variant="icon"><BotIcon /></Empty.Media>
			<Empty.Header>
				<Empty.Title>{$_('admin.aiTasks.empty.title')}</Empty.Title>
				<Empty.Description>{$_('admin.aiTasks.empty.description')}</Empty.Description>
			</Empty.Header>
			{#if hasFilters()}<Empty.Content><Button variant="outline" onclick={resetFilters}>{$_('admin.aiTasks.reset')}</Button></Empty.Content>{/if}
		</Empty.Root>
	{:else}
		<div class="admin-table-panel">
			<Table.Root class="min-w-[1260px]">
				<Table.Header>
					<Table.Row>
						<Table.Head>{$_('admin.aiTasks.created')}</Table.Head>
						<Table.Head>{$_('admin.aiTasks.type')}</Table.Head>
						<Table.Head>{$_('admin.aiTasks.id')}</Table.Head>
						<Table.Head>{$_('admin.aiTasks.user')}</Table.Head>
						<Table.Head>{$_('admin.aiTasks.provider')}</Table.Head>
						<Table.Head>{$_('admin.aiTasks.model')}</Table.Head>
						<Table.Head>{$_('admin.aiTasks.status')}</Table.Head>
						<Table.Head>{$_('admin.aiTasks.attempts')}</Table.Head>
						<Table.Head>{$_('admin.aiTasks.updated')}</Table.Head>
						<Table.Head class="sticky right-0 z-20 w-12 bg-background text-right"><span class="sr-only">{$_('admin.aiTasks.actions')}</span></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if listState.status === 'loading'}
						{#each Array(6) as _item}
							<Table.Row>
								{#each Array(10) as _cell}
									<Table.Cell><Skeleton class="h-5 w-24" /></Table.Cell>
								{/each}
							</Table.Row>
						{/each}
					{:else}
						{#each listState.data.items as item (`${item.task_type}:${item.shard_id}:${item.id}`)}
							<Table.Row class={`group ${item.status === 'failed' ? 'bg-destructive/5' : ''}`}>
								<Table.Cell>{formatDate(item.created_at)}</Table.Cell>
								<Table.Cell><Badge variant="outline">{taskTypeLabel(item.task_type)}</Badge></Table.Cell>
								<Table.Cell class="max-w-44 truncate font-mono text-xs" title={item.id}>{item.id}</Table.Cell>
								<Table.Cell><AdminUserReference userId={item.user_id} href={createAiTaskUserHref(data.locale, item.user_id)} /></Table.Cell>
								<Table.Cell>{item.provider}</Table.Cell>
								<Table.Cell>{item.model ?? $_('admin.common.none')}</Table.Cell>
								<Table.Cell><Badge variant={getAiTaskStatusVariant(item.status)}>{taskStatusLabel(item.status)}</Badge></Table.Cell>
								<Table.Cell>{item.attempt_count}</Table.Cell>
								<Table.Cell>{formatDate(item.updated_at)}</Table.Cell>
								<Table.Cell class={`sticky right-0 z-10 text-right group-hover:bg-accent ${item.status === 'failed' ? 'bg-destructive/5' : 'bg-background'}`}><Button class="ml-auto" variant="ghost" size="icon-sm" onclick={() => openTask(item)} aria-label={$_('admin.aiTasks.view')} title={$_('admin.aiTasks.view')}><ChevronRightIcon /></Button></Table.Cell>
							</Table.Row>
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		</div>

		{#if listState.status === 'loaded' && listState.data.total > 0}
			<div class="admin-pagination">
				<p class="text-sm text-muted-foreground">{$_('admin.aiTasks.total', { values: { count: listState.data.total } })}</p>
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

{#key selectedTask ? `${selectedTask.task_type}:${selectedTask.shard_id}:${selectedTask.id}` : ''}
	<AiTaskDetailSheet bind:open={detailOpen} summary={selectedTask} locale={data.locale} cloudflare={data.cloudflare} />
{/key}
