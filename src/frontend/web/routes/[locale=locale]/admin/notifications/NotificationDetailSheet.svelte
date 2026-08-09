<script lang="ts">
	import type { ListAdminNotificationsResponseItem } from '$apiContract/notifications'
	import { _ } from '$frontend/i18n'
	import { Badge } from '$frontend/ui/badge'
	import { Button } from '$frontend/ui/button'
	import { Separator } from '$frontend/ui/separator'
	import * as Sheet from '$frontend/ui/sheet'
	import UserIcon from '@lucide/svelte/icons/user'

	let {
		open = $bindable(false),
		notification,
		locale
	}: {
		open?: boolean
		notification: ListAdminNotificationsResponseItem | null
		locale: string
	} = $props()

	function formatDate(value: number): string {
		return new Intl.DateTimeFormat(locale, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(value)
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content class="w-full sm:max-w-xl">
		{#if notification}
			<Sheet.Header>
				<Sheet.Title>{notification.title}</Sheet.Title>
				<Sheet.Description>{notification.id}</Sheet.Description>
			</Sheet.Header>
			<div class="flex-1 space-y-5 overflow-y-auto px-4 pb-6">
				<dl class="grid gap-4 text-sm">
					<div class="grid gap-1">
						<dt class="text-xs text-muted-foreground">{$_('admin.notifications.id')}</dt>
						<dd class="break-all font-mono text-xs">{notification.id}</dd>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="grid gap-1">
							<dt class="text-xs text-muted-foreground">{$_('admin.notifications.scope')}</dt>
							<dd>
								<Badge variant={notification.target_user_id === null ? 'secondary' : 'outline'}>
									{notification.target_user_id === null
										? $_('admin.notifications.global')
										: $_('admin.notifications.targeted')}
								</Badge>
							</dd>
						</div>
						<div class="grid gap-1">
							<dt class="text-xs text-muted-foreground">{$_('admin.notifications.type')}</dt>
							<dd><Badge variant="outline">{notification.type}</Badge></dd>
						</div>
					</div>
					{#if notification.target_user_id}
						<div class="grid gap-1">
							<dt class="text-xs text-muted-foreground">{$_('admin.notifications.targetUser')}</dt>
							<dd>
								<Button variant="outline" size="sm" href={`/${locale}/admin/users?search=${encodeURIComponent(notification.target_user_id)}`}>
									<UserIcon />
									<span class="max-w-72 truncate font-mono text-xs">{notification.target_user_id}</span>
								</Button>
							</dd>
						</div>
					{/if}
					<div class="grid gap-1">
						<dt class="text-xs text-muted-foreground">{$_('admin.notifications.created')}</dt>
						<dd>{formatDate(notification.created_at)}</dd>
					</div>
				</dl>
				<Separator />
				<section aria-labelledby="notification-content-title">
					<h3 id="notification-content-title" class="mb-3 text-sm font-semibold">{$_('admin.notifications.content')}</h3>
					<p class="whitespace-pre-wrap break-words text-sm leading-6">{notification.content}</p>
				</section>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
