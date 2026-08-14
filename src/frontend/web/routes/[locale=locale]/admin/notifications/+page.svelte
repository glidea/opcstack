<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { client } from '$apiContract/client'
	import type { ListAdminNotificationsRequest, ListAdminNotificationsResponse, ListAdminNotificationsResponseItem } from '$apiContract/notifications'
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
	import AdvancedFilters from '../AdvancedFilters.svelte'
	import UserReference from '../UserReference.svelte'
	import UserPicker from '../UserPicker.svelte'
	import { createFilterOptions } from '../presentation'
	import { createAdminPageSearch, readAdminDetailKey } from '../detail-state'
	import NotificationDetailSheet from './NotificationDetailSheet.svelte'
	import PublishNotificationDialog from './PublishNotificationDialog.svelte'
	import { createNotificationSearchParams, parseNotificationComposer, parseNotificationListQuery, type NotificationComposerState } from './notifications-page'

	type NotificationListState = { status: 'loading' } | { status: 'loaded'; data: ListAdminNotificationsResponse } | { status: 'error' }

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
	let typeInput: string = $state(initialQuery.type ?? 'all')
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
	let advancedOpen: boolean = $state(initialQuery.id !== undefined || initialQuery.created_at_start !== undefined || initialQuery.created_at_end !== undefined)
	const advancedFilterCount: number = $derived(Number(idInput.trim() !== '') + Number(createdStartInput !== '') + Number(createdEndInput !== ''))

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
		const detailKey: string = detailOpen ? (selectedNotification?.id ?? '') : ''
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
				const selected: ListAdminNotificationsResponseItem | undefined = listState.data.items.find((notification: ListAdminNotificationsResponseItem): boolean => notification.id === initialDetailKey)
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
		const type: string = typeInput === 'all' ? '' : typeInput
		const scope: ListAdminNotificationsRequest['scope'] = scopeInput === 'global' || scopeInput === 'user' ? scopeInput : undefined
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
		typeInput = 'all'
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

	function handleNotificationChanged(notification: ListAdminNotificationsResponseItem): void {
		selectedNotification = notification
		if (listState.status !== 'loaded') {
			return
		}
		listState = {
			status: 'loaded',
			data: {
				...listState.data,
				items: listState.data.items.map((item: ListAdminNotificationsResponseItem): ListAdminNotificationsResponseItem => {
					return item.id === notification.id ? notification : item
				})
			}
		}
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

	function notificationTypeOptions(): string[] {
		const observed: string[] = listState.status === 'loaded' ? listState.data.items.map((item: ListAdminNotificationsResponseItem): string => item.type) : []
		return createFilterOptions(typeInput, observed, ['system'])
	}

	function notificationTypeLabel(type: string): string {
		return type === 'system' ? $_('admin.notifications.type.system') : type
	}
</script>

<main class="admin-page">
	<header class="admin-page-header">
		<h1>{$_('admin.notifications.title')}</h1>
		<div class="admin-page-actions">
			<Button variant="outline" size="icon" onclick={loadNotifications} aria-label={$_('admin.notifications.refresh')} title={$_('admin.notifications.refresh')}>
				<RefreshCwIcon class={listState.status === 'loading' ? 'animate-spin' : ''} />
			</Button>
			<Button onclick={openPublisher}><PlusIcon />{$_('admin.notifications.publish.action')}</Button>
		</div>
	</header>

	<form class="admin-filter-bar" onsubmit={applyFilters}>
		<div class="admin-filter-primary md:grid-cols-2 xl:grid-cols-[minmax(15rem,1.3fr)_minmax(10rem,0.8fr)_minmax(10rem,0.8fr)_auto] xl:items-end">
			<UserPicker id="notification-user-filter" label={$_('admin.notifications.targetUser')} bind:value={targetInput} />
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
				<Field.Label for="notification-type-filter">{$_('admin.notifications.type')}</Field.Label>
				<Select.Root type="single" bind:value={typeInput}>
					<Select.Trigger id="notification-type-filter" class="w-full">
						{typeInput === 'all' ? $_('admin.notifications.allTypes') : notificationTypeLabel(typeInput)}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="all">{$_('admin.notifications.allTypes')}</Select.Item>
						{#each notificationTypeOptions() as type}
							<Select.Item value={type}>{notificationTypeLabel(type)}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</Field.Field>
			<div class="admin-filter-actions md:col-span-2 xl:col-span-1">
				<Button type="submit">{$_('admin.notifications.apply')}</Button>
				{#if hasFilters()}<Button type="button" variant="ghost" onclick={resetFilters}>{$_('admin.notifications.reset')}</Button>{/if}
			</div>
		</div>
		<AdvancedFilters bind:open={advancedOpen} count={advancedFilterCount} label={$_('admin.filters.advanced')} contentClass="md:grid-cols-3">
			<Field.Field>
				<Field.Label for="notification-id-filter">{$_('admin.notifications.id')}</Field.Label>
				<Input id="notification-id-filter" bind:value={idInput} autocomplete="off" placeholder={$_('admin.notifications.idPlaceholder')} />
			</Field.Field>
			<Field.Field>
				<Field.Label for="notification-created-start">{$_('admin.notifications.createdStart')}</Field.Label>
				<Input id="notification-created-start" bind:value={createdStartInput} type="date" />
			</Field.Field>
			<Field.Field>
				<Field.Label for="notification-created-end">{$_('admin.notifications.createdEnd')}</Field.Label>
				<Input id="notification-created-end" bind:value={createdEndInput} type="date" />
			</Field.Field>
		</AdvancedFilters>
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
		<div class="admin-table-panel">
			<Table.Root class="min-w-[1000px]">
				<Table.Header>
					<Table.Row>
						<Table.Head>{$_('admin.notifications.scope')}</Table.Head>
						<Table.Head>{$_('admin.notifications.titleField')}</Table.Head>
						<Table.Head>{$_('admin.notifications.type')}</Table.Head>
						<Table.Head>{$_('admin.notifications.targetUser')}</Table.Head>
						<Table.Head>{$_('admin.notifications.created')}</Table.Head>
						<Table.Head>{$_('admin.notifications.status')}</Table.Head>
						<Table.Head class="sticky right-0 z-20 w-12 bg-background text-right"><span class="sr-only">{$_('admin.notifications.actions')}</span></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if listState.status === 'loading'}
						{#each Array(6) as _item}
							<Table.Row>
								{#each Array(7) as _cell}
									<Table.Cell><Skeleton class="h-5 w-24" /></Table.Cell>
								{/each}
							</Table.Row>
						{/each}
					{:else}
						{#each listState.data.items as item (item.id)}
							<Table.Row class="group">
								<Table.Cell><Badge variant={item.target_user_id === null ? 'secondary' : 'outline'}>{item.target_user_id === null ? $_('admin.notifications.global') : $_('admin.notifications.targeted')}</Badge></Table.Cell>
								<Table.Cell><p class="max-w-lg truncate font-medium">{item.title}</p></Table.Cell>
								<Table.Cell>{notificationTypeLabel(item.type)}</Table.Cell>
								<Table.Cell>
									{#if item.target_user_id}<UserReference userId={item.target_user_id} href={`/${data.locale}/admin/users?search=${encodeURIComponent(item.target_user_id)}`} />{:else}{$_('admin.common.none')}{/if}
								</Table.Cell>
								<Table.Cell>{formatDate(item.created_at)}</Table.Cell>
								<Table.Cell><Badge variant={item.archived_at === null ? 'secondary' : 'outline'}>{item.archived_at === null ? $_('admin.notifications.active') : $_('admin.notifications.archived')}</Badge></Table.Cell>
								<Table.Cell class="sticky right-0 z-10 bg-background text-right group-hover:bg-accent"><Button class="ml-auto" variant="ghost" size="icon-sm" onclick={() => openNotification(item)} aria-label={$_('admin.notifications.view')} title={$_('admin.notifications.view')}><ChevronRightIcon /></Button></Table.Cell>
							</Table.Row>
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		</div>

		{#if listState.status === 'loaded' && listState.data.total > 0}
			<div class="admin-pagination">
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
	<NotificationDetailSheet
		bind:open={detailOpen}
		notification={selectedNotification}
		locale={data.locale}
		onUpdated={handleNotificationChanged}
		onArchived={handleNotificationChanged}
	/>
{/key}

<PublishNotificationDialog bind:open={publishOpen} prefillTargetUserId={publishTargetUserId} onPublished={handlePublished} />
