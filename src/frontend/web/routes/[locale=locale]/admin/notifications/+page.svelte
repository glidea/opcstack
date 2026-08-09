<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { client } from '$apiContract/client'
	import type {
		ListAdminNotificationsRequest,
		ListAdminNotificationsResponse,
		ListAdminNotificationsResponseItem
	} from '$apiContract/notifications'
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
	import BellIcon from '@lucide/svelte/icons/bell'
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import { onMount } from 'svelte'
	import AdminUserPicker from '../AdminUserPicker.svelte'
	import { createAdminPageSearch, readAdminDetailKey } from '../admin-detail-state'
	import NotificationDetailSheet from './NotificationDetailSheet.svelte'
	import PublishNotificationDialog from './PublishNotificationDialog.svelte'
	import {
		createNotificationSearchParams,
		parseNotificationComposer,
		parseNotificationListQuery,
		type NotificationComposerState
	} from './notifications-page'

	type NotificationListState =
		| { status: 'loading' }
		| { status: 'loaded'; data: ListAdminNotificationsResponse }
		| { status: 'error' }

	let {
		data
	}: {
		data: {
			locale: string
		}
	} = $props()

	const initialQuery: ListAdminNotificationsRequest = parseNotificationListQuery(page.url)
	const initialDetailKey: string = readAdminDetailKey(page.url)
	const initialComposer: NotificationComposerState = parseNotificationComposer(page.url)
	let query: ListAdminNotificationsRequest = $state(initialQuery)
	let idInput: string = $state(initialQuery.id ?? '')
	let targetInput: string = $state(initialQuery.target_user_id ?? '')
	let typeInput: string = $state(initialQuery.type ?? '')
	let scopeInput: string = $state(initialQuery.scope ?? 'all')
	let createdStartInput: string = $state(formatDateInput(initialQuery.created_at_start))
	let createdEndInput: string = $state(formatDateInput(initialQuery.created_at_end))
	let currentPage: number = $state(initialQuery.page ?? 1)
	let listState: NotificationListState = $state({ status: 'loading' })
	let selectedNotification: ListAdminNotificationsResponseItem | null = $state(null)
	let detailOpen: boolean = $state(false)
	let publishOpen: boolean = $state(initialComposer.open)
	let publishTargetUserId: string = $state(initialComposer.targetUserId)
	let initialized: boolean = $state(false)
	let detailStateReady: boolean = $state(false)

	$effect((): void => {
		const nextPage: number = currentPage
		if (!initialized || nextPage === query.page) {
			return
		}
		query = { ...query, page: nextPage }
		updateUrl(query)
		void loadNotifications()
	})

	$effect((): void => {
		if (!detailStateReady) {
			return
		}
		const detailKey: string = detailOpen ? selectedNotification?.id ?? '' : ''
		if (detailKey === readAdminDetailKey(page.url)) {
			return
		}
		updateUrl(query, detailKey)
	})

	onMount((): void => {
		initialized = true
		void loadNotifications()
	})

	async function loadNotifications(): Promise<void> {
		listState = { status: 'loading' }
		try {
			listState = {
				status: 'loaded',
				data: await client.api.listAdminNotifications(query)
			}
			if (!detailStateReady && listState.status === 'loaded') {
				const selected: ListAdminNotificationsResponseItem | undefined = listState.data.items.find(
					(notification: ListAdminNotificationsResponseItem): boolean =>
						notification.id === initialDetailKey
				)
				if (selected !== undefined) {
					selectedNotification = selected
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
		const id: string = idInput.trim()
		const targetUserId: string = targetInput.trim()
		const type: string = typeInput.trim()
		const scope: ListAdminNotificationsRequest['scope'] =
			scopeInput === 'global' || scopeInput === 'user' ? scopeInput : undefined
		query = {
			...(id === '' ? {} : { id }),
			...(targetUserId === '' ? {} : { target_user_id: targetUserId }),
			...(type === '' ? {} : { type }),
			...(scope === undefined ? {} : { scope }),
			...createDateFilter('created_at_start', createdStartInput, false),
			...createDateFilter('created_at_end', createdEndInput, true),
			page: 1,
			page_size: 20
		}
		currentPage = 1
		updateUrl(query)
		void loadNotifications()
	}

	function resetFilters(): void {
		idInput = ''
		targetInput = ''
		typeInput = ''
		scopeInput = 'all'
		createdStartInput = ''
		createdEndInput = ''
		query = { page: 1, page_size: 20 }
		currentPage = 1
		updateUrl(query)
		void loadNotifications()
	}

	function updateUrl(input: ListAdminNotificationsRequest, detailKey: string = ''): void {
		const search: string = createAdminPageSearch(createNotificationSearchParams(input), detailKey)
		void goto(`${page.url.pathname}${search === '' ? '' : `?${search}`}`, {
			keepFocus: true,
			noScroll: true
		})
	}

	function hasFilters(): boolean {
		return createNotificationSearchParams({ ...query, page: 1 }).toString() !== ''
	}

	function openNotification(notification: ListAdminNotificationsResponseItem): void {
		selectedNotification = notification
		detailOpen = true
	}

	function openPublisher(): void {
		publishTargetUserId = ''
		publishOpen = true
	}

	function handlePublished(): void {
		query = { ...query, page: 1 }
		currentPage = 1
		updateUrl(query)
		void loadNotifications()
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

<main class="mx-auto w-full max-w-[1650px] space-y-6 p-4 sm:p-6 lg:p-8">
	<header class="flex flex-wrap items-start justify-between gap-4">
		<h1 class="text-xl font-semibold sm:text-2xl">{$_('admin.notifications.title')}</h1>
		<div class="flex gap-2">
			<Button variant="outline" size="sm" onclick={loadNotifications}>
				<RefreshCwIcon class={listState.status === 'loading' ? 'animate-spin' : ''} />
				{$_('admin.notifications.refresh')}
			</Button>
			<Button size="sm" onclick={openPublisher}><PlusIcon />{$_('admin.notifications.publish.action')}</Button>
		</div>
	</header>

	<form class="grid gap-3 md:grid-cols-2 xl:grid-cols-3" onsubmit={applyFilters}>
		<Field.Field>
			<Field.Label for="notification-id-filter">{$_('admin.notifications.id')}</Field.Label>
			<Input id="notification-id-filter" bind:value={idInput} autocomplete="off" placeholder={$_('admin.notifications.idPlaceholder')} />
		</Field.Field>
		<AdminUserPicker id="notification-user-filter" label={$_('admin.notifications.targetUser')} bind:value={targetInput} />
		<Field.Field>
			<Field.Label for="notification-type-filter">{$_('admin.notifications.type')}</Field.Label>
			<Input id="notification-type-filter" bind:value={typeInput} autocomplete="off" placeholder={$_('admin.notifications.typePlaceholder')} />
		</Field.Field>
		<Field.Field>
			<Field.Label for="notification-scope-filter">{$_('admin.notifications.scope')}</Field.Label>
			<Select.Root type="single" bind:value={scopeInput}>
				<Select.Trigger id="notification-scope-filter" class="w-full">
					{scopeInput === 'global' ? $_('admin.notifications.global') : scopeInput === 'user' ? $_('admin.notifications.targeted') : $_('admin.notifications.allScopes')}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="all">{$_('admin.notifications.allScopes')}</Select.Item>
					<Select.Item value="global">{$_('admin.notifications.global')}</Select.Item>
					<Select.Item value="user">{$_('admin.notifications.targeted')}</Select.Item>
				</Select.Content>
			</Select.Root>
		</Field.Field>
		<Field.Field>
			<Field.Label for="notification-created-start">{$_('admin.notifications.createdStart')}</Field.Label>
			<Input id="notification-created-start" bind:value={createdStartInput} type="date" />
		</Field.Field>
		<Field.Field>
			<Field.Label for="notification-created-end">{$_('admin.notifications.createdEnd')}</Field.Label>
			<Input id="notification-created-end" bind:value={createdEndInput} type="date" />
		</Field.Field>
		<div class="flex gap-2 md:col-span-2 xl:col-span-3">
			<Button type="submit">{$_('admin.notifications.apply')}</Button>
			{#if hasFilters()}<Button type="button" variant="ghost" onclick={resetFilters}>{$_('admin.notifications.reset')}</Button>{/if}
		</div>
	</form>

	{#if listState.status === 'error'}
		<Alert.Root variant="destructive">
			<TriangleAlertIcon />
			<Alert.Title>{$_('admin.notifications.error.title')}</Alert.Title>
			<Alert.Description>{$_('admin.notifications.error.description')}</Alert.Description>
			<Alert.Action><Button variant="ghost" size="sm" onclick={loadNotifications}>{$_('admin.notifications.retry')}</Button></Alert.Action>
		</Alert.Root>
	{:else if listState.status === 'loaded' && listState.data.items.length === 0}
		<Empty.Root class="min-h-80 border">
			<Empty.Media variant="icon"><BellIcon /></Empty.Media>
			<Empty.Header>
				<Empty.Title>{$_('admin.notifications.empty.title')}</Empty.Title>
				<Empty.Description>{$_('admin.notifications.empty.description')}</Empty.Description>
			</Empty.Header>
			{#if hasFilters()}<Empty.Content><Button variant="outline" onclick={resetFilters}>{$_('admin.notifications.reset')}</Button></Empty.Content>{/if}
		</Empty.Root>
	{:else}
		<div class="overflow-hidden rounded-lg border">
			<div class="overflow-x-auto">
				<Table.Root class="min-w-[1000px]">
					<Table.Header>
						<Table.Row>
							<Table.Head>{$_('admin.notifications.scope')}</Table.Head>
							<Table.Head>{$_('admin.notifications.titleField')}</Table.Head>
							<Table.Head>{$_('admin.notifications.type')}</Table.Head>
							<Table.Head>{$_('admin.notifications.targetUser')}</Table.Head>
							<Table.Head>{$_('admin.notifications.created')}</Table.Head>
							<Table.Head class="text-right">{$_('admin.notifications.actions')}</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if listState.status === 'loading'}
							{#each Array(6) as _item}
								<Table.Row>{#each Array(6) as _cell}<Table.Cell><Skeleton class="h-5 w-24" /></Table.Cell>{/each}</Table.Row>
							{/each}
						{:else}
							{#each listState.data.items as item (item.id)}
								<Table.Row>
									<Table.Cell><Badge variant={item.target_user_id === null ? 'secondary' : 'outline'}>{item.target_user_id === null ? $_('admin.notifications.global') : $_('admin.notifications.targeted')}</Badge></Table.Cell>
									<Table.Cell><p class="max-w-lg truncate font-medium">{item.title}</p></Table.Cell>
									<Table.Cell>{item.type}</Table.Cell>
									<Table.Cell>
										{#if item.target_user_id}<a class="font-mono text-xs underline-offset-4 hover:underline" href={`/${data.locale}/admin/users?search=${encodeURIComponent(item.target_user_id)}`}>{item.target_user_id}</a>{:else}{$_('admin.common.none')}{/if}
									</Table.Cell>
									<Table.Cell>{formatDate(item.created_at)}</Table.Cell>
									<Table.Cell class="text-right"><Button variant="outline" size="sm" onclick={() => openNotification(item)}>{$_('admin.notifications.view')}</Button></Table.Cell>
								</Table.Row>
							{/each}
						{/if}
					</Table.Body>
				</Table.Root>
			</div>
		</div>

		{#if listState.status === 'loaded' && listState.data.total > 0}
			<div class="flex flex-col items-center justify-between gap-3 sm:flex-row">
				<p class="text-sm text-muted-foreground">{$_('admin.notifications.total', { values: { count: listState.data.total } })}</p>
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

{#key selectedNotification?.id}
	<NotificationDetailSheet bind:open={detailOpen} notification={selectedNotification} locale={data.locale} />
{/key}

<PublishNotificationDialog bind:open={publishOpen} prefillTargetUserId={publishTargetUserId} onPublished={handlePublished} />
