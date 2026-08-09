<script lang="ts">
	import type { ListAdminUsersResponseItem } from '$apiContract/admin-users'
	import BellIcon from '@lucide/svelte/icons/bell'
	import BotIcon from '@lucide/svelte/icons/bot'
	import CheckIcon from '@lucide/svelte/icons/check'
	import CoinsIcon from '@lucide/svelte/icons/coins'
	import CopyIcon from '@lucide/svelte/icons/copy'
	import CreditCardIcon from '@lucide/svelte/icons/credit-card'
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
	import MessageSquareTextIcon from '@lucide/svelte/icons/message-square-text'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import * as Avatar from '$frontend/ui/avatar'
	import { Badge } from '$frontend/ui/badge'
	import { Button } from '$frontend/ui/button'
	import { Separator } from '$frontend/ui/separator'
	import * as Sheet from '$frontend/ui/sheet'
	import GrantCreditsDialog from './GrantCreditsDialog.svelte'
	import { createUserContextLinks, type UserContextLinks } from './users-page'

	let {
		open = $bindable(false),
		user,
		locale,
		cloudflareDatabaseUrl
	}: {
		open?: boolean
		user: ListAdminUsersResponseItem | null
		locale: string
		cloudflareDatabaseUrl: string | null
	} = $props()

	let grantOpen: boolean = $state(false)
	let copied: boolean = $state(false)
	let lastGrantBalance: string = $state('')
	const links: UserContextLinks | null = $derived(
		user ? createUserContextLinks(locale, user.id) : null
	)

	async function copyUserId(): Promise<void> {
		if (!user) {
			return
		}
		await navigator.clipboard.writeText(user.id)
		copied = true
		setTimeout((): void => {
			copied = false
		}, 1500)
	}

	function formatDate(value: number): string {
		return new Intl.DateTimeFormat(locale, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(value)
	}

	function initials(value: string): string {
		return value.trim().slice(0, 2).toUpperCase()
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content class="w-full sm:max-w-lg">
		{#if user && links}
			<Sheet.Header class="pr-10">
				<div class="flex items-center gap-3">
					<Avatar.Root size="lg">
						{#if user.image}
							<Avatar.Image src={user.image} alt={user.name} />
						{/if}
						<Avatar.Fallback>{initials(user.name)}</Avatar.Fallback>
					</Avatar.Root>
					<div class="min-w-0">
						<Sheet.Title class="truncate">{user.name}</Sheet.Title>
						<Sheet.Description class="truncate">{user.email}</Sheet.Description>
					</div>
				</div>
			</Sheet.Header>

			<div class="flex-1 space-y-6 overflow-y-auto px-4 pb-6">
				<div class="flex flex-wrap gap-2">
					<Button size="sm" onclick={() => (grantOpen = true)}>
						<CoinsIcon />
						{$_('admin.users.grant.action')}
					</Button>
					<Button variant="outline" size="sm" href={links.notification}>
						<BellIcon />
						{$_('admin.users.notify')}
					</Button>
				</div>

				{#if lastGrantBalance !== ''}
					<Alert.Root>
						<CheckIcon />
						<Alert.Title>{$_('admin.users.grant.success')}</Alert.Title>
						<Alert.Description>
							{$_('admin.users.grant.balance', { values: { balance: lastGrantBalance } })}
						</Alert.Description>
					</Alert.Root>
				{/if}

				<section aria-labelledby="user-profile-title">
					<h3 id="user-profile-title" class="mb-3 text-sm font-semibold">{$_('admin.users.detail.profile')}</h3>
					<dl class="grid gap-3 text-sm">
						<div class="grid gap-1">
							<dt class="text-xs text-muted-foreground">{$_('admin.users.id')}</dt>
							<dd class="flex items-center gap-2">
								<code class="min-w-0 flex-1 break-all text-xs">{user.id}</code>
								<Button variant="ghost" size="icon-sm" onclick={copyUserId} aria-label={$_('admin.users.copyId')} title={$_('admin.users.copyId')}>
									{#if copied}<CheckIcon />{:else}<CopyIcon />{/if}
								</Button>
							</dd>
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div class="grid gap-1">
								<dt class="text-xs text-muted-foreground">{$_('admin.users.verified')}</dt>
								<dd><Badge variant={user.email_verified ? 'secondary' : 'outline'}>{user.email_verified ? $_('admin.common.yes') : $_('admin.common.no')}</Badge></dd>
							</div>
							<div class="grid gap-1">
								<dt class="text-xs text-muted-foreground">{$_('admin.users.affCode')}</dt>
								<dd>{user.aff_code ?? $_('admin.common.none')}</dd>
							</div>
						</div>
						<div class="grid gap-1">
							<dt class="text-xs text-muted-foreground">{$_('admin.users.source')}</dt>
							<dd>{user.registration_utm_source ?? $_('admin.users.sourceDirect')}</dd>
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.users.created')}</dt><dd>{formatDate(user.created_at)}</dd></div>
							<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.users.updated')}</dt><dd>{formatDate(user.updated_at)}</dd></div>
						</div>
					</dl>
				</section>

				<Separator />

				<section aria-labelledby="user-access-title">
					<h3 id="user-access-title" class="mb-3 text-sm font-semibold">{$_('admin.users.detail.access')}</h3>
					{#if user.beta_access}
						<dl class="grid gap-3 text-sm">
							<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.users.betaCode')}</dt><dd class="font-mono text-xs">{user.beta_access.code}</dd></div>
							<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.users.betaUsedAt')}</dt><dd>{formatDate(user.beta_access.used_at)}</dd></div>
						</dl>
					{:else}
						<p class="text-sm text-muted-foreground">{$_('admin.users.betaUnused')}</p>
					{/if}
				</section>

				<Separator />

				<section aria-labelledby="user-shard-title">
					<div class="mb-3 flex items-center justify-between gap-3">
						<h3 id="user-shard-title" class="text-sm font-semibold">{$_('admin.users.detail.shard')}</h3>
						{#if cloudflareDatabaseUrl}
							<Button variant="ghost" size="sm" href={cloudflareDatabaseUrl} target="_blank" rel="noopener">
								<ExternalLinkIcon />
								D1
							</Button>
						{/if}
					</div>
					{#if user.shard}
						<dl class="grid gap-3 text-sm">
							<div class="grid grid-cols-2 gap-3">
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.users.shardId')}</dt><dd class="break-all font-mono text-xs">{user.shard.id}</dd></div>
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.users.region')}</dt><dd>{user.shard.region}</dd></div>
							</div>
							<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.users.database')}</dt><dd class="break-all">{user.shard.database_name}</dd></div>
							<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.users.databaseId')}</dt><dd class="break-all font-mono text-xs">{user.shard.database_id}</dd></div>
						</dl>
					{:else}
						<p class="text-sm text-muted-foreground">{$_('admin.users.noShard')}</p>
					{/if}
				</section>

				<Separator />

				<section aria-labelledby="user-related-title">
					<h3 id="user-related-title" class="mb-3 text-sm font-semibold">{$_('admin.users.detail.related')}</h3>
					<div class="grid gap-2 sm:grid-cols-3">
						<Button variant="outline" size="sm" href={links.feedbacks}><MessageSquareTextIcon />{$_('admin.nav.feedback')}</Button>
						<Button variant="outline" size="sm" href={links.payments}><CreditCardIcon />{$_('admin.nav.payments')}</Button>
						<Button variant="outline" size="sm" href={links.aiTasks}><BotIcon />{$_('admin.nav.ai-tasks')}</Button>
					</div>
				</section>
			</div>

			<GrantCreditsDialog bind:open={grantOpen} {user} {locale} onGranted={(balance: string): void => {
				lastGrantBalance = balance
			}} />
		{/if}
	</Sheet.Content>
</Sheet.Root>
