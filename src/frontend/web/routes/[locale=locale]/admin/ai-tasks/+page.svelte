<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import type {
		AdminAiTaskSummary,
		AdminAiTaskType,
		ListAdminAiTasksRequest,
		ListAdminAiTasksResponse
	} from '$apiContract/admin-ai-tasks'
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
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import { onMount } from 'svelte'
	import { createAdminPageSearch, readAdminDetailKey } from '../admin-detail-state'
	import AiTaskDetailSheet from './AiTaskDetailSheet.svelte'
	import {
		createAiTaskSearchParams,
		createAiTaskUserHref,
		getAiTaskStatusVariant,
		parseAiTaskListQuery,
		type CloudflareResourceContext
	} from './ai-tasks-page'

	type AiTaskListState =
		| { status: 'loading' }
		| { status: 'loaded'; data: ListAdminAiTasksResponse }
		| { status: 'error' }

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
				const selected: AdminAiTaskSummary | undefined = response.items.find(
					(task: AdminAiTaskSummary): boolean => createTaskDetailKey(task) === initialDetailKey
				)
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
</script>

<main class="mx-auto w-full max-w-[1650px] space-y-6 p-4 sm:p-6 lg:p-8">
	<header class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="text-xl font-semibold sm:text-2xl">{$_('admin.aiTasks.title')}</h1>
			<p class="mt-1 text-sm text-muted-foreground">{$_('admin.aiTasks.description')}</p>
		</div>
		<Button variant="outline" size="sm" onclick={loadTasks}>
			<RefreshCwIcon class={listState.status === 'loading' ? 'animate-spin' : ''} />
			{$_('admin.aiTasks.refresh')}
		</Button>
	</header>

	<form class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:items-end" onsubmit={applyFilters}>
		<Field.Field>
			<Field.Label for="ai-task-type-filter">{$_('admin.aiTasks.type')}</Field.Label>
			<Select.Root type="single" bind:value={taskTypeInput}>
				<Select.Trigger id="ai-task-type-filter" class="w-full"><span>{taskTypeInput === 'all' ? $_('admin.aiTasks.allTypes') : taskTypeInput}</span></Select.Trigger>
				<Select.Content>
					<Select.Item value="all">{$_('admin.aiTasks.allTypes')}</Select.Item>
					<Select.Item value="image">{$_('admin.aiTasks.image')}</Select.Item>
					<Select.Item value="tts">TTS</Select.Item>
					<Select.Item value="video">{$_('admin.aiTasks.video')}</Select.Item>
				</Select.Content>
			</Select.Root>
		</Field.Field>
		<Field.Field>
			<Field.Label for="ai-task-id-filter">{$_('admin.aiTasks.id')}</Field.Label>
			<Input id="ai-task-id-filter" bind:value={idInput} autocomplete="off" placeholder={$_('admin.aiTasks.idPlaceholder')} />
		</Field.Field>
		<Field.Field>
			<Field.Label for="ai-task-user-filter">{$_('admin.aiTasks.user')}</Field.Label>
			<Input id="ai-task-user-filter" bind:value={userInput} autocomplete="off" placeholder={$_('admin.aiTasks.userPlaceholder')} />
		</Field.Field>
		<Field.Field>
			<Field.Label for="ai-task-status-filter">{$_('admin.aiTasks.status')}</Field.Label>
			<Select.Root type="single" bind:value={statusInput}>
				<Select.Trigger id="ai-task-status-filter" class="w-full"><span>{statusInput === 'all' ? $_('admin.aiTasks.allStatuses') : statusInput}</span></Select.Trigger>
				<Select.Content>
					<Select.Item value="all">{$_('admin.aiTasks.allStatuses')}</Select.Item>
					<Select.Item value="processing">processing</Select.Item>
					<Select.Item value="completed">completed</Select.Item>
					<Select.Item value="failed">failed</Select.Item>
				</Select.Content>
			</Select.Root>
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
		<div class="flex gap-2 sm:col-span-2 xl:col-span-4">
			<Button type="submit">{$_('admin.aiTasks.apply')}</Button>
			{#if hasFilters()}<Button type="button" variant="ghost" onclick={resetFilters}>{$_('admin.aiTasks.reset')}</Button>{/if}
		</div>
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
		<div class="overflow-hidden rounded-lg border">
			<div class="overflow-x-auto">
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
							<Table.Head class="text-right">{$_('admin.aiTasks.actions')}</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if listState.status === 'loading'}
							{#each Array(6) as _item}<Table.Row>{#each Array(10) as _cell}<Table.Cell><Skeleton class="h-5 w-24" /></Table.Cell>{/each}</Table.Row>{/each}
						{:else}
							{#each listState.data.items as item (`${item.task_type}:${item.shard_id}:${item.id}`)}
								<Table.Row class={item.status === 'failed' ? 'bg-destructive/5' : ''}>
									<Table.Cell>{formatDate(item.created_at)}</Table.Cell>
									<Table.Cell><Badge variant="outline">{item.task_type}</Badge></Table.Cell>
									<Table.Cell class="max-w-44 truncate font-mono text-xs" title={item.id}>{item.id}</Table.Cell>
									<Table.Cell><a class="font-mono text-xs underline-offset-4 hover:underline" href={createAiTaskUserHref(data.locale, item.user_id)}>{item.user_id}</a></Table.Cell>
									<Table.Cell>{item.provider}</Table.Cell>
									<Table.Cell>{item.model ?? $_('admin.common.none')}</Table.Cell>
									<Table.Cell><Badge variant={getAiTaskStatusVariant(item.status)}>{item.status}</Badge></Table.Cell>
									<Table.Cell>{item.attempt_count}</Table.Cell>
									<Table.Cell>{formatDate(item.updated_at)}</Table.Cell>
									<Table.Cell class="text-right"><Button variant="outline" size="sm" onclick={() => openTask(item)}>{$_('admin.aiTasks.view')}</Button></Table.Cell>
								</Table.Row>
							{/each}
						{/if}
					</Table.Body>
				</Table.Root>
			</div>
		</div>

		{#if listState.status === 'loaded' && listState.data.total > 0}
			<div class="flex flex-col items-center justify-between gap-3 sm:flex-row">
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
