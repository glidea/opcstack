<script lang="ts">
	import { onMount } from 'svelte'
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right'
	import BotIcon from '@lucide/svelte/icons/bot'
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check'
	import CircleDollarSignIcon from '@lucide/svelte/icons/circle-dollar-sign'
	import CreditCardIcon from '@lucide/svelte/icons/credit-card'
	import ImageIcon from '@lucide/svelte/icons/image'
	import MessageSquareTextIcon from '@lucide/svelte/icons/message-square-text'
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
	import SpeechIcon from '@lucide/svelte/icons/speech'
	import TicketCheckIcon from '@lucide/svelte/icons/ticket-check'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import UsersIcon from '@lucide/svelte/icons/users'
	import VideoIcon from '@lucide/svelte/icons/video'
	import { client } from '$apiContract/client'
	import type { GetDashboardResponse } from '$apiContract/dashboard'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Badge } from '$frontend/ui/badge'
	import { Button } from '$frontend/ui/button'
	import * as Empty from '$frontend/ui/empty'
	import { Progress } from '$frontend/ui/progress'
	import { Skeleton } from '$frontend/ui/skeleton'
	import { createDashboardDrilldowns, createDashboardInitialState, createTaskDistribution, formatPaidAmount, getProcessingTaskCount, loadDashboard, type DashboardState, type DashboardDrilldowns, type TaskDistributionItem } from './dashboard-page'

	let {
		data
	}: {
		data: {
			locale: string
		}
	} = $props()

	let dashboardState: DashboardState = $state(createDashboardInitialState())
	let refreshing: boolean = $state(false)

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
				<div class="admin-metric space-y-4">
					<Skeleton class="h-4 w-24" />
					<Skeleton class="h-8 w-32" />
					<Skeleton class="h-4 w-40" />
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
		{@const drilldowns: DashboardDrilldowns = createDashboardDrilldowns(data.locale, dashboard)}
		{@const distribution: TaskDistributionItem[] = createTaskDistribution(dashboard)}
		{@const processingTasks: number = getProcessingTaskCount(dashboard)}
		{@const pendingCount: number = dashboard.redemption_codes.claimed_count + dashboard.ai_tasks.failed_count_24h + dashboard.payments.disputed_count}

		<section aria-labelledby="dashboard-metrics-title">
			<h2 id="dashboard-metrics-title" class="sr-only">{$_('admin.dashboard.metrics')}</h2>
			<div class="admin-metric-strip">
				<article class="admin-metric">
					<div class="flex items-center justify-between gap-3 text-sm font-medium">
						<span>{$_('admin.dashboard.users.title')}</span>
						<UsersIcon class="size-4 text-muted-foreground" />
					</div>
					<p class="mt-4 text-3xl font-semibold tabular-nums">{formatNumber(dashboard.users.total)}</p>
					<p class="mt-1 text-xs text-muted-foreground">
						{$_('admin.dashboard.users.new', { values: { count: dashboard.users.new_7d } })}
					</p>
				</article>

				<article class="admin-metric">
					<div class="flex items-center justify-between gap-3 text-sm font-medium">
						<span>{$_('admin.dashboard.payments.title')}</span>
						<CircleDollarSignIcon class="size-4 text-muted-foreground" />
					</div>
					{#if dashboard.payments.paid_amounts_30d.length === 0}
						<p class="mt-4 text-3xl font-semibold tabular-nums">0</p>
						<p class="mt-1 text-xs text-muted-foreground">{$_('admin.dashboard.payments.none')}</p>
					{:else}
						<div class="mt-4 flex flex-wrap gap-x-4 gap-y-1">
							{#each dashboard.payments.paid_amounts_30d as amount}
								<p class="text-2xl font-semibold tabular-nums">
									{formatPaidAmount(amount.amount, amount.currency, data.locale)}
								</p>
							{/each}
						</div>
						<p class="mt-1 text-xs text-muted-foreground">{$_('admin.dashboard.last30d')}</p>
					{/if}
				</article>

				<article class="admin-metric">
					<div class="flex items-center justify-between gap-3 text-sm font-medium">
						<span>{$_('admin.dashboard.ai.title')}</span>
						<BotIcon class="size-4 text-muted-foreground" />
					</div>
					<p class="mt-4 text-3xl font-semibold tabular-nums">{formatPercent(dashboard.ai_tasks.terminal_completion_rate)}</p>
					<p class="mt-1 text-xs text-muted-foreground">
						{$_('admin.dashboard.ai.summary', { values: { total: dashboard.ai_tasks.total_24h, processing: processingTasks } })}
					</p>
				</article>

				<article class="admin-metric">
					<div class="flex items-center justify-between gap-3 text-sm font-medium">
						<span>{$_('admin.dashboard.feedback.title')}</span>
						<MessageSquareTextIcon class="size-4 text-muted-foreground" />
					</div>
					<p class="mt-4 text-3xl font-semibold tabular-nums">{formatNumber(dashboard.feedbacks.new_7d)}</p>
					<p class="mt-1 text-xs text-muted-foreground">{$_('admin.dashboard.last7d')}</p>
				</article>
			</div>
		</section>

		<div class="admin-dashboard-grid">
			<section class="admin-dashboard-panel" aria-labelledby="dashboard-attention-title">
				<header class="admin-dashboard-panel-header">
					<h2 id="dashboard-attention-title" class="text-base font-semibold">{$_('admin.dashboard.attention.title')}</h2>
					{#if pendingCount > 0}
						<Badge variant="secondary">{formatNumber(pendingCount)}</Badge>
					{/if}
				</header>

				{#if pendingCount === 0}
					<Empty.Root class="min-h-64">
						<Empty.Media variant="icon"><CircleCheckIcon /></Empty.Media>
						<Empty.Header>
							<Empty.Title>{$_('admin.dashboard.attention.empty.title')}</Empty.Title>
							<Empty.Description>{$_('admin.dashboard.attention.empty.description')}</Empty.Description>
						</Empty.Header>
					</Empty.Root>
				{:else}
					<div class="divide-y">
						{#if dashboard.ai_tasks.failed_count_24h > 0}
							<a class="flex min-h-20 items-center gap-3 px-4 transition-colors hover:bg-accent" href={drilldowns.failedTasks}>
								<TriangleAlertIcon class="size-4 text-destructive" />
								<div class="min-w-0 flex-1">
									<p class="text-sm font-medium">{$_('admin.dashboard.attention.failed')}</p>
									<p class="text-xs text-muted-foreground">{$_('admin.dashboard.last24h')}</p>
								</div>
								<span class="font-semibold tabular-nums">{formatNumber(dashboard.ai_tasks.failed_count_24h)}</span>
								<ArrowRightIcon class="size-4 text-muted-foreground" />
							</a>
						{/if}
						{#if dashboard.redemption_codes.claimed_count > 0}
							<a class="flex min-h-20 items-center gap-3 px-4 transition-colors hover:bg-accent" href={drilldowns.claimedCodes}>
								<TicketCheckIcon class="size-4 text-muted-foreground" />
								<div class="min-w-0 flex-1">
									<p class="text-sm font-medium">{$_('admin.dashboard.attention.claimed')}</p>
									<p class="text-xs text-muted-foreground">{$_('admin.dashboard.attention.current')}</p>
								</div>
								<span class="font-semibold tabular-nums">{formatNumber(dashboard.redemption_codes.claimed_count)}</span>
								<ArrowRightIcon class="size-4 text-muted-foreground" />
							</a>
						{/if}
						{#if dashboard.payments.disputed_count > 0}
							<a class="flex min-h-20 items-center gap-3 px-4 transition-colors hover:bg-accent" href={drilldowns.disputedPayments}>
								<CreditCardIcon class="size-4 text-muted-foreground" />
								<div class="min-w-0 flex-1">
									<p class="text-sm font-medium">{$_('admin.dashboard.attention.disputed')}</p>
									<p class="text-xs text-muted-foreground">{$_('admin.dashboard.attention.current')}</p>
								</div>
								<span class="font-semibold tabular-nums">{formatNumber(dashboard.payments.disputed_count)}</span>
								<ArrowRightIcon class="size-4 text-muted-foreground" />
							</a>
						{/if}
					</div>
				{/if}
			</section>

			<section class="admin-dashboard-panel" aria-labelledby="dashboard-distribution-title">
				<header class="admin-dashboard-panel-header">
					<div>
						<h2 id="dashboard-distribution-title" class="text-base font-semibold">{$_('admin.dashboard.distribution.title')}</h2>
						<p class="mt-0.5 text-xs text-muted-foreground">
							{$_('admin.dashboard.distribution.description', { values: { total: dashboard.ai_tasks.total_24h } })}
						</p>
					</div>
				</header>
				<div class="space-y-5 p-4">
					{#each distribution as item}
						<div class="space-y-2">
							<div class="flex items-center gap-3 text-sm">
								{#if item.type === 'image'}
									<ImageIcon class="size-4 text-muted-foreground" />
								{:else if item.type === 'tts'}
									<SpeechIcon class="size-4 text-muted-foreground" />
								{:else}
									<VideoIcon class="size-4 text-muted-foreground" />
								{/if}
								<span class="flex-1">{taskTypeLabel(item.type)}</span>
								<span class="tabular-nums">{formatNumber(item.count)}</span>
								<span class="w-12 text-right text-muted-foreground tabular-nums">{formatPercent(item.percentage / 100)}</span>
							</div>
							<Progress value={item.percentage} />
						</div>
					{/each}
				</div>
			</section>
		</div>
	{/if}
</main>
