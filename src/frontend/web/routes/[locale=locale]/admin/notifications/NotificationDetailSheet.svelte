<script lang="ts">
	import { client } from '$apiContract/client'
	import type { ListAdminNotificationsResponseItem } from '$apiContract/notifications'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Badge } from '$frontend/ui/badge'
	import { Button } from '$frontend/ui/button'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import { Separator } from '$frontend/ui/separator'
	import * as Sheet from '$frontend/ui/sheet'
	import { Textarea } from '$frontend/ui/textarea'
	import * as ToggleGroup from '$frontend/ui/toggle-group'
	import ArchiveIcon from '@lucide/svelte/icons/archive'
	import GlobeIcon from '@lucide/svelte/icons/globe'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import UserIcon from '@lucide/svelte/icons/user'
	import AdminUserPicker from '../AdminUserPicker.svelte'
	import AdminUserReference from '../AdminUserReference.svelte'
	import type { NotificationScope } from './notifications-page'

	let {
		open = $bindable(false),
		notification,
		locale,
		onUpdated,
		onArchived
	}: {
		open?: boolean
		notification: ListAdminNotificationsResponseItem | null
		locale: string
		onUpdated: (notification: ListAdminNotificationsResponseItem) => void
		onArchived: (notification: ListAdminNotificationsResponseItem) => void
	} = $props()

	let editing: boolean = $state(false)
	let confirmingArchive: boolean = $state(false)
	let saving: boolean = $state(false)
	let archiving: boolean = $state(false)
	let scope: NotificationScope = $state('global')
	let targetUserId: string = $state('')
	let typeInput: string = $state('')
	let titleInput: string = $state('')
	let contentInput: string = $state('')
	let formError: string = $state('')
	let requestError: string = $state('')

	$effect((): void => {
		if (!open) {
			editing = false
			confirmingArchive = false
			formError = ''
			requestError = ''
		}
	})

	function formatDate(value: number): string {
		return new Intl.DateTimeFormat(locale, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(value)
	}

	function notificationTypeLabel(type: string): string {
		return type === 'system' ? $_('admin.notifications.type.system') : type
	}

	function startEditing(): void {
		if (notification === null || notification.archived_at !== null) {
			return
		}
		scope = notification.target_user_id === null ? 'global' : 'user'
		targetUserId = notification.target_user_id ?? ''
		typeInput = notification.type
		titleInput = notification.title
		contentInput = notification.content
		formError = ''
		requestError = ''
		confirmingArchive = false
		editing = true
	}

	function cancelEditing(): void {
		editing = false
		formError = ''
		requestError = ''
	}

	async function saveNotification(event: SubmitEvent): Promise<void> {
		event.preventDefault()
		if (notification === null) {
			return
		}
		if (typeInput.trim() === '' || titleInput.trim() === '' || contentInput.trim() === '') {
			formError = $_('admin.notifications.edit.requiredError')
			return
		}
		if (scope === 'user' && targetUserId === '') {
			formError = $_('admin.notifications.edit.targetError')
			return
		}

		saving = true
		formError = ''
		requestError = ''
		try {
			const updated: ListAdminNotificationsResponseItem = await client.api.updateNotification({
				id: notification.id,
				type: typeInput.trim(),
				title: titleInput.trim(),
				content: contentInput.trim(),
				target_user_id: scope === 'global' ? null : targetUserId
			})
			onUpdated(updated)
			editing = false
		} catch {
			requestError = $_('admin.notifications.edit.error')
		} finally {
			saving = false
		}
	}

	async function archiveNotification(): Promise<void> {
		if (notification === null) {
			return
		}
		archiving = true
		requestError = ''
		try {
			const archived: ListAdminNotificationsResponseItem = await client.api.archiveNotification({
				id: notification.id
			})
			onArchived(archived)
			confirmingArchive = false
		} catch {
			requestError = $_('admin.notifications.archive.error')
		} finally {
			archiving = false
		}
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content class="w-full sm:max-w-xl">
		{#if notification}
			<Sheet.Header class="border-b">
				<div class="flex items-start justify-between gap-3 pr-8">
					<div class="min-w-0">
						<Sheet.Title class="break-words">{notification.title}</Sheet.Title>
						<Sheet.Description class="sr-only">{$_('admin.notifications.details')}</Sheet.Description>
					</div>
					<Badge variant={notification.archived_at === null ? 'secondary' : 'outline'}>
						{notification.archived_at === null ? $_('admin.notifications.active') : $_('admin.notifications.archived')}
					</Badge>
				</div>
			</Sheet.Header>

			{#if editing}
				<form class="flex flex-1 flex-col overflow-hidden" onsubmit={saveNotification}>
					<div class="flex-1 space-y-4 overflow-y-auto px-4 py-5">
						<Field.Field>
							<Field.Label>{$_('admin.notifications.scope')}</Field.Label>
							<ToggleGroup.Root type="single" bind:value={scope} variant="outline" spacing={0} class="w-full">
								<ToggleGroup.Item value="global" aria-label={$_('admin.notifications.global')} class="flex-1"><GlobeIcon />{$_('admin.notifications.global')}</ToggleGroup.Item>
								<ToggleGroup.Item value="user" aria-label={$_('admin.notifications.targeted')} class="flex-1"><UserIcon />{$_('admin.notifications.targeted')}</ToggleGroup.Item>
							</ToggleGroup.Root>
						</Field.Field>
						{#if scope === 'user'}
							<AdminUserPicker id="notification-edit-target-user" label={$_('admin.notifications.targetUser')} bind:value={targetUserId} />
						{/if}
						<Field.Field>
							<Field.Label for="notification-edit-type">{$_('admin.notifications.type')}</Field.Label>
							<Input id="notification-edit-type" bind:value={typeInput} autocomplete="off" aria-invalid={formError !== '' && typeInput.trim() === ''} />
						</Field.Field>
						<Field.Field>
							<Field.Label for="notification-edit-title">{$_('admin.notifications.titleField')}</Field.Label>
							<Input id="notification-edit-title" bind:value={titleInput} autocomplete="off" aria-invalid={formError !== '' && titleInput.trim() === ''} />
						</Field.Field>
						<Field.Field>
							<Field.Label for="notification-edit-content">{$_('admin.notifications.content')}</Field.Label>
							<Textarea id="notification-edit-content" bind:value={contentInput} autocomplete="off" rows={7} aria-invalid={formError !== '' && contentInput.trim() === ''} />
						</Field.Field>
						{#if formError !== '' || requestError !== ''}
							<Alert.Root variant="destructive"><TriangleAlertIcon /><Alert.Description>{formError || requestError}</Alert.Description></Alert.Root>
						{/if}
					</div>
					<Sheet.Footer class="flex-row justify-end border-t">
						<Button variant="outline" onclick={cancelEditing} disabled={saving}>{$_('admin.notifications.cancel')}</Button>
						<Button type="submit" disabled={saving}>{saving ? $_('admin.notifications.saving') : $_('admin.notifications.save')}</Button>
					</Sheet.Footer>
				</form>
			{:else}
				<div class="flex-1 space-y-5 overflow-y-auto px-4 py-5">
					<dl class="grid gap-4 text-sm">
						<div class="grid grid-cols-2 gap-3">
							<div class="grid gap-1">
								<dt class="text-xs text-muted-foreground">{$_('admin.notifications.scope')}</dt>
								<dd>{notification.target_user_id === null ? $_('admin.notifications.global') : $_('admin.notifications.targeted')}</dd>
							</div>
							<div class="grid gap-1">
								<dt class="text-xs text-muted-foreground">{$_('admin.notifications.type')}</dt>
								<dd>{notificationTypeLabel(notification.type)}</dd>
							</div>
						</div>
						{#if notification.target_user_id}
							<div class="grid gap-1">
								<dt class="text-xs text-muted-foreground">{$_('admin.notifications.targetUser')}</dt>
								<dd><AdminUserReference userId={notification.target_user_id} href={`/${locale}/admin/users?search=${encodeURIComponent(notification.target_user_id)}`} /></dd>
							</div>
						{/if}
						<div class="grid grid-cols-2 gap-3">
							<div class="grid gap-1">
								<dt class="text-xs text-muted-foreground">{$_('admin.notifications.created')}</dt>
								<dd>{formatDate(notification.created_at)}</dd>
							</div>
							{#if notification.archived_at !== null}
								<div class="grid gap-1">
									<dt class="text-xs text-muted-foreground">{$_('admin.notifications.archivedAt')}</dt>
									<dd>{formatDate(notification.archived_at)}</dd>
								</div>
							{/if}
						</div>
					</dl>
					<Separator />
					<section aria-labelledby="notification-content-title">
						<h3 id="notification-content-title" class="mb-3 text-sm font-semibold">{$_('admin.notifications.content')}</h3>
						<p class="whitespace-pre-wrap break-words text-sm leading-6">{notification.content}</p>
					</section>
					{#if confirmingArchive}
						<Alert.Root variant="destructive">
							<TriangleAlertIcon />
							<Alert.Title>{$_('admin.notifications.archive.confirmTitle')}</Alert.Title>
							<Alert.Description>{$_('admin.notifications.archive.confirmDescription')}</Alert.Description>
						</Alert.Root>
					{/if}
					{#if requestError !== ''}
						<Alert.Root variant="destructive"><TriangleAlertIcon /><Alert.Description>{requestError}</Alert.Description></Alert.Root>
					{/if}
				</div>

				{#if notification.archived_at === null}
					<Sheet.Footer class="flex-row justify-end border-t">
						{#if confirmingArchive}
							<Button variant="outline" onclick={() => (confirmingArchive = false)} disabled={archiving}>{$_('admin.notifications.cancel')}</Button>
							<Button variant="destructive" onclick={archiveNotification} disabled={archiving}><ArchiveIcon />{archiving ? $_('admin.notifications.archiving') : $_('admin.notifications.archive')}</Button>
						{:else}
							<Button variant="outline" onclick={startEditing}><PencilIcon />{$_('admin.notifications.edit')}</Button>
							<Button variant="destructive" onclick={() => (confirmingArchive = true)}><ArchiveIcon />{$_('admin.notifications.archive')}</Button>
						{/if}
					</Sheet.Footer>
				{/if}
			{/if}
		{/if}
	</Sheet.Content>
</Sheet.Root>
