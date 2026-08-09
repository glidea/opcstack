<script lang="ts">
	import { client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Button } from '$frontend/ui/button'
	import * as Dialog from '$frontend/ui/dialog'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import { Textarea } from '$frontend/ui/textarea'
	import * as ToggleGroup from '$frontend/ui/toggle-group'
	import GlobeIcon from '@lucide/svelte/icons/globe'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import UserIcon from '@lucide/svelte/icons/user'
	import {
		buildNotificationRequest,
		validateNotificationDraft,
		type NotificationScope
	} from './notifications-page'

	let {
		open = $bindable(false),
		prefillTargetUserId,
		onPublished
	}: {
		open?: boolean
		prefillTargetUserId: string
		onPublished: (id: string) => void
	} = $props()

	let scope: NotificationScope = $state('global')
	let targetUserId: string = $state('')
	let typeInput: string = $state('system')
	let titleInput: string = $state('')
	let contentInput: string = $state('')
	let formError: string = $state('')
	let requestError: string = $state('')
	let confirming: boolean = $state(false)
	let submitting: boolean = $state(false)
	let wasOpen: boolean = false

	$effect((): void => {
		if (open && !wasOpen) {
			scope = prefillTargetUserId === '' ? 'global' : 'user'
			targetUserId = prefillTargetUserId
			typeInput = 'system'
			titleInput = ''
			contentInput = ''
			formError = ''
			requestError = ''
			confirming = false
			submitting = false
		}
		wasOpen = open
	})

	function reviewNotification(event: SubmitEvent): void {
		event.preventDefault()
		if (!validateNotificationDraft(scope, targetUserId, typeInput, titleInput, contentInput)) {
			formError =
				scope === 'user' && targetUserId.trim() === ''
					? $_('admin.notifications.publish.targetError')
					: $_('admin.notifications.publish.requiredError')
			return
		}
		formError = ''
		requestError = ''
		confirming = true
	}

	async function publishNotification(): Promise<void> {
		submitting = true
		requestError = ''
		try {
			const response = await client.api.createNotification(
				buildNotificationRequest(scope, targetUserId, {
					type: typeInput.trim(),
					title: titleInput.trim(),
					content: contentInput.trim()
				})
			)
			onPublished(response.id)
			open = false
		} catch {
			requestError = $_('admin.notifications.publish.error')
		} finally {
			submitting = false
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{$_('admin.notifications.publish.title')}</Dialog.Title>
			<Dialog.Description>{$_('admin.notifications.publish.description')}</Dialog.Description>
		</Dialog.Header>

		{#if confirming}
			<div class="space-y-4">
				{#if scope === 'global'}
					<Alert.Root variant="destructive">
						<TriangleAlertIcon />
						<Alert.Title>{$_('admin.notifications.publish.globalWarning')}</Alert.Title>
						<Alert.Description>{$_('admin.notifications.publish.globalWarningDescription')}</Alert.Description>
					</Alert.Root>
				{:else}
					<Alert.Root>
						<UserIcon />
						<Alert.Title>{$_('admin.notifications.publish.targetedConfirmation')}</Alert.Title>
						<Alert.Description>{targetUserId}</Alert.Description>
					</Alert.Root>
				{/if}
				<dl class="grid gap-3 rounded-lg border p-3 text-sm">
					<div><dt class="text-xs text-muted-foreground">{$_('admin.notifications.type')}</dt><dd>{typeInput}</dd></div>
					<div><dt class="text-xs text-muted-foreground">{$_('admin.notifications.titleField')}</dt><dd>{titleInput}</dd></div>
					<div><dt class="text-xs text-muted-foreground">{$_('admin.notifications.content')}</dt><dd class="whitespace-pre-wrap break-words">{contentInput}</dd></div>
				</dl>
				{#if requestError !== ''}
					<Alert.Root variant="destructive">
						<TriangleAlertIcon />
						<Alert.Title>{$_('admin.notifications.publish.failed')}</Alert.Title>
						<Alert.Description>{requestError}</Alert.Description>
					</Alert.Root>
				{/if}
			</div>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (confirming = false)} disabled={submitting}>{$_('admin.notifications.publish.back')}</Button>
				<Button onclick={publishNotification} disabled={submitting}>
					{submitting ? $_('admin.notifications.publish.submitting') : $_('admin.notifications.publish.confirm')}
				</Button>
			</Dialog.Footer>
		{:else}
			<form class="space-y-4" onsubmit={reviewNotification}>
				<Field.Field>
					<Field.Label>{$_('admin.notifications.scope')}</Field.Label>
					<ToggleGroup.Root type="single" bind:value={scope} variant="outline" spacing={0} class="w-full">
						<ToggleGroup.Item value="global" aria-label={$_('admin.notifications.global')} class="flex-1"><GlobeIcon />{$_('admin.notifications.global')}</ToggleGroup.Item>
						<ToggleGroup.Item value="user" aria-label={$_('admin.notifications.targeted')} class="flex-1"><UserIcon />{$_('admin.notifications.targeted')}</ToggleGroup.Item>
					</ToggleGroup.Root>
				</Field.Field>
				{#if scope === 'user'}
					<Field.Field>
						<Field.Label for="notification-target-user">{$_('admin.notifications.targetUser')}</Field.Label>
						<Input id="notification-target-user" bind:value={targetUserId} autocomplete="off" />
					</Field.Field>
				{/if}
				<Field.Field>
					<Field.Label for="notification-type">{$_('admin.notifications.type')}</Field.Label>
					<Input id="notification-type" bind:value={typeInput} autocomplete="off" />
				</Field.Field>
				<Field.Field>
					<Field.Label for="notification-title">{$_('admin.notifications.titleField')}</Field.Label>
					<Input id="notification-title" bind:value={titleInput} autocomplete="off" />
				</Field.Field>
				<Field.Field>
					<Field.Label for="notification-content">{$_('admin.notifications.content')}</Field.Label>
					<Textarea id="notification-content" bind:value={contentInput} autocomplete="off" rows={5} />
				</Field.Field>
				{#if formError !== ''}
					<Alert.Root variant="destructive"><TriangleAlertIcon /><Alert.Description>{formError}</Alert.Description></Alert.Root>
				{/if}
				<Dialog.Footer><Button type="submit">{$_('admin.notifications.publish.review')}</Button></Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
