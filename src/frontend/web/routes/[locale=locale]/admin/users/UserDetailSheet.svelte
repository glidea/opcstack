<script lang="ts">
	import type { ListUsersResponseItem } from '$apiContract/users'
	import BellIcon from '@lucide/svelte/icons/bell'
	import BotIcon from '@lucide/svelte/icons/bot'
	import CheckIcon from '@lucide/svelte/icons/check'
	import CoinsIcon from '@lucide/svelte/icons/coins'
	import CopyIcon from '@lucide/svelte/icons/copy'
	import CreditCardIcon from '@lucide/svelte/icons/credit-card'
	import HistoryIcon from '@lucide/svelte/icons/history'
	import MessageSquareTextIcon from '@lucide/svelte/icons/message-square-text'
	import UserRoundPlusIcon from '@lucide/svelte/icons/user-round-plus'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Button } from '$frontend/ui/button'
	import { Separator } from '$frontend/ui/separator'
	import * as Sheet from '$frontend/ui/sheet'
	import GrantCreditsDialog from './GrantCreditsDialog.svelte'
	import { createUserContextLinks, type UserContextLinks } from './users-page'
	import { formatCreditAmount } from '../presentation'
	import { formatAdminUserIdentity } from '../user-picker'

	let {
		open = $bindable(false),
		user,
		locale,
		onCreditsGranted
	}: {
		open?: boolean
		user: ListUsersResponseItem | null
		locale: string
		onCreditsGranted: (balance: string) => void
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

</script>

<Sheet.Root bind:open>
	<Sheet.Content class="w-full sm:max-w-lg">
		{#if user && links}
			<Sheet.Header class="gap-1 pr-10">
				<Sheet.Title class="truncate">{user.email}</Sheet.Title>
				<Sheet.Description class="flex items-center gap-1.5">
					<code class="min-w-0 truncate text-xs">{user.id}</code>
					<Button variant="ghost" size="icon-sm" onclick={copyUserId} aria-label={$_('admin.users.copyId')} title={$_('admin.users.copyId')}>
						{#if copied}<CheckIcon />{:else}<CopyIcon />{/if}
					</Button>
				</Sheet.Description>
			</Sheet.Header>

			<div class="flex-1 space-y-6 overflow-y-auto px-4 pb-6">
				<div class="flex flex-wrap gap-2">
					<Button size="sm" onclick={(): void => {
						open = false
						grantOpen = true
					}}>
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
						<Alert.Title>
							{$_('admin.users.grant.balance', { values: { balance: formatCreditAmount(lastGrantBalance, locale) } })}
						</Alert.Title>
					</Alert.Root>
				{/if}

				<section aria-labelledby="user-profile-title">
					<h3 id="user-profile-title" class="mb-3 text-sm font-semibold">{$_('admin.users.detail.profile')}</h3>
					<dl class="grid gap-3 text-sm">
						{#if user.inviter}
							<div class="grid gap-1">
								<dt class="text-xs text-muted-foreground">{$_('admin.users.invitedBy')}</dt>
								<dd>{formatAdminUserIdentity(user.inviter)}</dd>
							</div>
						{/if}
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

				<section aria-labelledby="user-related-title">
					<h3 id="user-related-title" class="mb-3 text-sm font-semibold">{$_('admin.users.detail.related')}</h3>
					<div class="grid gap-2 sm:grid-cols-2">
						<Button variant="outline" size="sm" href={links.creditTransactions}><HistoryIcon />{$_('admin.nav.credit-transactions')}</Button>
						<Button variant="outline" size="sm" href={links.affiliateReferrals}><UserRoundPlusIcon />{$_('admin.nav.affiliate-referrals')}</Button>
						<Button variant="outline" size="sm" href={links.feedbacks}><MessageSquareTextIcon />{$_('admin.nav.feedback')}</Button>
						<Button variant="outline" size="sm" href={links.payments}><CreditCardIcon />{$_('admin.nav.payments')}</Button>
						<Button variant="outline" size="sm" href={links.aiTasks}><BotIcon />{$_('admin.nav.ai-tasks')}</Button>
					</div>
				</section>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>

{#if user}
	<GrantCreditsDialog bind:open={grantOpen} {user} {locale} onGranted={(balance: string): void => {
		lastGrantBalance = balance
		onCreditsGranted(balance)
		open = true
	}} />
{/if}
