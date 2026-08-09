<script lang="ts">
	import type { AdminPaymentTransactionItem } from '$apiContract/payment'
	import { _ } from '$frontend/i18n'
	import { Badge } from '$frontend/ui/badge'
	import { Button } from '$frontend/ui/button'
	import * as Sheet from '$frontend/ui/sheet'
	import UserIcon from '@lucide/svelte/icons/user'
	import {
		createPaymentUserHref,
		formatPaymentAmount,
		getPaymentStatusVariant
	} from './payments-page'

	let {
		open = $bindable(false),
		transaction,
		locale
	}: {
		open?: boolean
		transaction: AdminPaymentTransactionItem | null
		locale: string
	} = $props()

	function formatDate(value: number | null): string {
		if (value === null) {
			return $_('admin.common.none')
		}
		return new Intl.DateTimeFormat(locale, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(value)
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content class="w-full sm:max-w-xl">
		{#if transaction}
			<Sheet.Header>
				<Sheet.Title>{$_('admin.payments.detail.title')}</Sheet.Title>
				<Sheet.Description>{transaction.id}</Sheet.Description>
			</Sheet.Header>
			<div class="flex-1 overflow-y-auto px-4 pb-6">
				<dl class="grid gap-4 text-sm">
					<div class="grid gap-1">
						<dt class="text-xs text-muted-foreground">{$_('admin.payments.id')}</dt>
						<dd class="break-all font-mono text-xs">{transaction.id}</dd>
					</div>
					<div class="grid gap-1">
						<dt class="text-xs text-muted-foreground">{$_('admin.payments.user')}</dt>
						<dd>
							<Button variant="outline" size="sm" href={createPaymentUserHref(locale, transaction.user_id)}>
								<UserIcon />
								<span class="max-w-72 truncate font-mono text-xs">{transaction.user_id}</span>
							</Button>
						</dd>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.payments.type')}</dt><dd>{transaction.type}</dd></div>
						<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.payments.status')}</dt><dd><Badge variant={getPaymentStatusVariant(transaction.status)}>{transaction.status}</Badge></dd></div>
					</div>
					<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.payments.product')}</dt><dd>{transaction.product_id}</dd></div>
					<div class="grid grid-cols-2 gap-3">
						<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.payments.amount')}</dt><dd class="font-medium">{formatPaymentAmount(transaction.amount, transaction.currency, locale)}</dd></div>
						<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.payments.currency')}</dt><dd>{transaction.currency}</dd></div>
					</div>
					<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.payments.rawAmount')}</dt><dd class="font-mono">{transaction.amount}</dd></div>
					<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.payments.credits')}</dt><dd>{transaction.credits_granted}</dd></div>
					<div class="grid grid-cols-2 gap-3">
						<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.payments.paidAt')}</dt><dd>{formatDate(transaction.paid_at)}</dd></div>
						<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.payments.refundedAt')}</dt><dd>{formatDate(transaction.refunded_at)}</dd></div>
						<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.payments.disputedAt')}</dt><dd>{formatDate(transaction.disputed_at)}</dd></div>
						<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.payments.created')}</dt><dd>{formatDate(transaction.created_at)}</dd></div>
					</div>
				</dl>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
