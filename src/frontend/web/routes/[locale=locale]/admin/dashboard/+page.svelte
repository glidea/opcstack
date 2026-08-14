<script lang="ts">
	import { onMount } from 'svelte'
	import type { Component } from 'svelte'
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right'
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check'
	import CreditCardIcon from '@lucide/svelte/icons/credit-card'
	import ImageIcon from '@lucide/svelte/icons/image'
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
	import SpeechIcon from '@lucide/svelte/icons/speech'
	import TicketCheckIcon from '@lucide/svelte/icons/ticket-check'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import VideoIcon from '@lucide/svelte/icons/video'
	import { client } from '$apiContract/client'
	import type { GetDashboardResponse } from '$apiContract/dashboard'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Button } from '$frontend/ui/button'
	import * as Empty from '$frontend/ui/empty'
	import { Progress } from '$frontend/ui/progress'
	import { Skeleton } from '$frontend/ui/skeleton'
	import { createAttentionItems, createDashboardInitialState, createTaskDistribution, formatPaidAmount, getProcessingTaskCount, loadDashboard, type AttentionItem, type AttentionItemId, type DashboardState, type TaskDistributionItem } from './dashboard-page'

	let {
		data
	}: {
		data: {
			locale: string
		}
	} = $props()

	let dashboardState: DashboardState = $state(createDashboardInitialState())
	let refreshing: boolean = $state(false)

	const attentionIcons: Record<AttentionItemId, Component> = {
		failedTasks: TriangleAlertIcon,
		claimedCodes: TicketCheckIcon,
		disputedPayments: CreditCardIcon
	}

	async function refresh(): Promise<void> {
		refreshing = true
		dashboardState = await loadDashboard((): Promise<GetDashboardResponse> => {
			return client.api.getDashboard()
		})
		refreshing = false
	}

	function formatNumber(value: number): string {
		return new Intl.NumberFormat(data.locale).format(value)
	}

	function formatPercent(value: number): string {
		return new Intl.NumberFormat(data.locale, {
			style: 'percent',
			maximumFractionDigits: 1
		}).format(value)
	}

	function taskTypeLabel(type: TaskDistributionItem['type']): string {
		return $_(`admin.dashboard.ai.${type}`)
	}

	onMount((): void => {
		void refresh()
	})
</script>

<main class="admin-page">
	<header class="admin-page-header">
		<h1>{$_('admin.dashboard.title')}</h1>
		<Button variant="outline" size="icon" onclick={refresh} disabled={refreshing} aria-label={$_('admin.dashboard.refresh')} title={$_('admin.dashboard.refresh')}>
			<RefreshCwIcon class={refreshing ? 'animate-spin' : ''} />
		</Button>
	</header>

	{#if dashboardState.status === 'loading'}
		<div class="admin-metric-strip" aria-label={$_('admin.loading')}>
			{#each Array(4) as _item}
				<div class="admin-metric">
					<Skeleton class="h-3 w-20" />
					<Skeleton class="h-7 w-28" />
					<Skeleton class="h-3 w-32" />
				</div>
			{/each}
		</div>
	{:else if dashboardState.status === 'error'}
		<Alert.Root variant="destructive">
			<TriangleAlertIcon />
			<Alert.Title>{$_('admin.dashboard.error.title')}</Alert.Title>
			<Alert.Description>{$_('admin.dashboard.error.description')}</Alert.Description>
			<Alert.Action>
				<Button variant="ghost" size="sm" onclick={refresh}>{$_('admin.dashboard.retry')}</Button>
			</Alert.Action>
		</Alert.Root>
	{:else}
		{@const dashboard: GetDashboardResponse = dashboardState.data}
		{@const attention: AttentionItem[] = createAttentionItems(data.locale, dashboard)}
		{@const distribution: TaskDistributionItem[] = createTaskDistribution(dashboard)}
		{@const processingTasks: number = getProcessingTaskCount(dashboard)}

		<section aria-labelledby="dashboard-metrics-title">
			<h2 id="dashboard-metrics-title" class="sr-only">{$_('admin.dashboard.metrics')}</h2>
			<div class="admin-metric-strip">
				<article class="admin-metric">
					<p class="admin-metric-label">{$_('admin.dashboard.users.title')}</p>
					<p class="admin-metric-value">{formatNumber(dashboard.users.total)}</p>
					<p class="admin-metric-meta">
						{$_('admin.dashboard.users.new', { values: { count: dashboard.users.new_7d } })}
					</p>
				</article>

				<article class="admin-metric">
					<p class="admin-metric-label">{$_('admin.dashboard.payments.title')}</p>
					{#if dashboard.payments.paid_amounts_30d.length === 0}
						<p class="admin-metric-value">{formatNumber(0)}</p>
						<p class="admin-metric-meta">{$_('admin.dashboard.payments.none')}</p>
					{:else}
						<div class="flex flex-wrap items-baseline gap-x-3">
							{#each dashboard.payments.paid_amounts_30d as amount}
								<p class="admin-metric-value">
									{formatPaidAmount(amount.amount, amount.currency, data.locale)}
								</p>
							{/each}
						</div>
						<p class="admin-metric-meta">{$_('admin.dashboard.last30d')}</p>
					{/if}
				</article>

				<article class="admin-metric">
					<p class="admin-metric-label">{$_('admin.dashboard.ai.title')}</p>
					<p class="admin-metric-value">{formatPercent(dashboard.ai_tasks.terminal_completion_rate)}</p>
					<p class="admin-metric-meta">
						{$_('admin.dashboard.ai.summary', { values: { total: dashboard.ai_tasks.total_24h, processing: processingTasks } })}
					</p>
				</article>

				<article class="admin-metric">
					<p class="admin-metric-label">{$_('admin.dashboard.feedback.title')}</p>
					<p class="admin-metric-value">{formatNumber(dashboard.feedbacks.new_7d)}</p>
					<p class="admin-metric-meta">{$_('admin.dashboard.last7d')}</p>
				</article>
			</div>
		</section>

		<div class="admin-dashboard-grid">
			<section class="admin-dashboard-panel" aria-labelledby="dashboard-attention-title">
				<header class="admin-dashboard-panel-header">
					<h2 id="dashboard-attention-title" class="text-sm font-semibold">{$_('admin.dashboard.attention.title')}</h2>
				</header>

				{#if attention.length === 0}
					<Empty.Root class="min-h-56">
						<Empty.Media variant="icon"><CircleCheckIcon /></Empty.Media>
						<Empty.Header>
							<Empty.Title>{$_('admin.dashboard.attention.empty.title')}</Empty.Title>
							<Empty.Description>{$_('admin.dashboard.attention.empty.description')}</Empty.Description>
						</Empty.Header>
					</Empty.Root>
				{:else}
					<div class="divide-y">
						{#each attention as item (item.id)}
							{@const Icon: Component = attentionIcons[item.id]}
							<a class="admin-dashboard-queue-row" href={item.href}>
								<Icon class={item.id === 'failedTasks' ? 'size-4 shrink-0 text-destructive' : 'size-4 shrink-0 text-muted-foreground'} />
								<span class="min-w-0 flex-1 truncate text-sm font-medium">{$_(`admin.dashboard.attention.${item.id}`)}</span>
								<span class="text-sm font-semibold tabular-nums">{formatNumber(item.count)}</span>
								<ArrowRightIcon class="size-4 shrink-0 text-muted-foreground" />
							</a>
						{/each}
					</div>
				{/if}
			</section>

			<section class="admin-dashboard-panel" aria-labelledby="dashboard-distribution-title">
				<header class="admin-dashboard-panel-header">
					<h2 id="dashboard-distribution-title" class="text-sm font-medium text-muted-foreground">{$_('admin.dashboard.distribution.title')}</h2>
				</header>
				<div class="space-y-4 p-4">
					{#each distribution as item (item.type)}
						<div class="space-y-1.5">
							<div class="flex items-center gap-3 text-caption text-muted-foreground">
								{#if item.type === 'image'}
									<ImageIcon class="size-4 shrink-0" />
								{:else if item.type === 'tts'}
									<SpeechIcon class="size-4 shrink-0" />
								{:else}
									<VideoIcon class="size-4 shrink-0" />
								{/if}
								<span class="min-w-0 flex-1 truncate">{taskTypeLabel(item.type)}</span>
								<span class="tabular-nums text-foreground">{formatNumber(item.count)}</span>
								<span class="w-12 text-right tabular-nums">{formatPercent(item.percentage / 100)}</span>
							</div>
							<Progress value={item.percentage} />
						</div>
					{/each}
				</div>
			</section>
		</div>
	{/if}
</main>
