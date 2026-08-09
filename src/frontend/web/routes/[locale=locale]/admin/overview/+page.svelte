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
	import type { GetAdminOverviewResponse } from '$apiContract/admin-overview'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Button } from '$frontend/ui/button'
	import * as Card from '$frontend/ui/card'
	import * as Empty from '$frontend/ui/empty'
	import { Progress } from '$frontend/ui/progress'
	import { Skeleton } from '$frontend/ui/skeleton'
	import {
		createOverviewDrilldowns,
		createOverviewInitialState,
		createTaskDistribution,
		formatPaidAmount,
		getProcessingTaskCount,
		loadAdminOverview,
		type AdminOverviewState,
		type OverviewDrilldowns,
		type TaskDistributionItem
	} from './overview-page'

	let {
		data
	}: {
		data: {
			locale: string
		}
	} = $props()

	let overviewState: AdminOverviewState = $state(createOverviewInitialState())
	let refreshing: boolean = $state(false)

	async function refresh(): Promise<void> {
		refreshing = true
		overviewState = await loadAdminOverview((): Promise<GetAdminOverviewResponse> => {
			return client.api.getAdminOverview()
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

	function formatDateTime(value: number): string {
		return new Intl.DateTimeFormat(data.locale, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(value)
	}

	function taskTypeLabel(type: TaskDistributionItem['type']): string {
		return $_(`admin.overview.ai.${type}`)
	}

	onMount((): void => {
		void refresh()
	})
</script>

<main class="mx-auto w-full max-w-[1600px] space-y-8 p-4 sm:p-6 lg:p-8">
	<header class="flex flex-wrap items-start justify-between gap-4">
		<h1 class="min-w-0 text-xl font-semibold sm:text-2xl">{$_('admin.overview.title')}</h1>
		<Button variant="outline" size="sm" onclick={refresh} disabled={refreshing}>
			<RefreshCwIcon class={refreshing ? 'animate-spin' : ''} />
			{$_('admin.overview.refresh')}
		</Button>
	</header>

	{#if overviewState.status === 'loading'}
		<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={$_('admin.loading')}>
			{#each Array(4) as _item}
				<Card.Root class="min-h-36">
					<Card.Header><Skeleton class="h-4 w-24" /></Card.Header>
					<Card.Content class="space-y-3">
						<Skeleton class="h-8 w-32" />
						<Skeleton class="h-4 w-40" />
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{:else if overviewState.status === 'error'}
		<Alert.Root variant="destructive">
			<TriangleAlertIcon />
			<Alert.Title>{$_('admin.overview.error.title')}</Alert.Title>
			<Alert.Description>{$_('admin.overview.error.description')}</Alert.Description>
			<Alert.Action>
				<Button variant="ghost" size="sm" onclick={refresh}>{$_('admin.overview.retry')}</Button>
			</Alert.Action>
		</Alert.Root>
	{:else}
		{@const overview: GetAdminOverviewResponse = overviewState.data}
		{@const drilldowns: OverviewDrilldowns = createOverviewDrilldowns(data.locale, overview)}
		{@const distribution: TaskDistributionItem[] = createTaskDistribution(overview)}
		{@const processingTasks: number = getProcessingTaskCount(overview)}
		{@const pendingCount: number = overview.redemption_codes.claimed_count + overview.ai_tasks.failed_count_24h + overview.payments.disputed_count}

		<p class="text-right text-xs text-muted-foreground">
			{$_('admin.overview.updated', { values: { time: formatDateTime(overview.generated_at) } })}
		</p>

		<section aria-labelledby="overview-metrics-title">
			<h2 id="overview-metrics-title" class="sr-only">{$_('admin.overview.metrics')}</h2>
			<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<Card.Root>
					<Card.Header class="flex-row items-center justify-between gap-3">
						<Card.Title class="text-sm font-medium">{$_('admin.overview.users.title')}</Card.Title>
						<UsersIcon class="size-4 text-muted-foreground" />
					</Card.Header>
					<Card.Content>
						<p class="text-2xl font-semibold tabular-nums">{formatNumber(overview.users.total)}</p>
						<p class="mt-2 text-xs text-muted-foreground">
							{$_('admin.overview.users.new', { values: { count: overview.users.new_7d } })}
						</p>
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header class="flex-row items-center justify-between gap-3">
						<Card.Title class="text-sm font-medium">{$_('admin.overview.payments.title')}</Card.Title>
						<CircleDollarSignIcon class="size-4 text-muted-foreground" />
					</Card.Header>
					<Card.Content>
						{#if overview.payments.paid_amounts_30d.length === 0}
							<p class="text-2xl font-semibold tabular-nums">0</p>
							<p class="mt-2 text-xs text-muted-foreground">{$_('admin.overview.payments.none')}</p>
						{:else}
							<div class="flex flex-wrap gap-x-4 gap-y-1">
								{#each overview.payments.paid_amounts_30d as amount}
									<p class="text-xl font-semibold tabular-nums">
										{formatPaidAmount(amount.amount, amount.currency, data.locale)}
									</p>
								{/each}
							</div>
							<p class="mt-2 text-xs text-muted-foreground">{$_('admin.overview.last30d')}</p>
						{/if}
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header class="flex-row items-center justify-between gap-3">
						<Card.Title class="text-sm font-medium">{$_('admin.overview.ai.title')}</Card.Title>
						<BotIcon class="size-4 text-muted-foreground" />
					</Card.Header>
					<Card.Content>
						<p class="text-2xl font-semibold tabular-nums">{formatPercent(overview.ai_tasks.terminal_completion_rate)}</p>
						<p class="mt-2 text-xs text-muted-foreground">
							{$_('admin.overview.ai.summary', { values: { total: overview.ai_tasks.total_24h, processing: processingTasks } })}
						</p>
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header class="flex-row items-center justify-between gap-3">
						<Card.Title class="text-sm font-medium">{$_('admin.overview.feedback.title')}</Card.Title>
						<MessageSquareTextIcon class="size-4 text-muted-foreground" />
					</Card.Header>
					<Card.Content>
						<p class="text-2xl font-semibold tabular-nums">{formatNumber(overview.feedbacks.new_7d)}</p>
						<p class="mt-2 text-xs text-muted-foreground">{$_('admin.overview.last7d')}</p>
					</Card.Content>
				</Card.Root>
			</div>
		</section>

		<div class="grid gap-8 border-t pt-8 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]">
			<section aria-labelledby="overview-attention-title">
				<div class="mb-4 flex items-center justify-between gap-4">
					<div>
						<h2 id="overview-attention-title" class="text-base font-semibold">{$_('admin.overview.attention.title')}</h2>
						<p class="mt-1 text-sm text-muted-foreground">{$_('admin.overview.attention.description')}</p>
					</div>
					{#if pendingCount > 0}
						<span class="text-sm font-medium tabular-nums">{formatNumber(pendingCount)}</span>
					{/if}
				</div>

				{#if pendingCount === 0}
					<Empty.Root class="min-h-48 border">
						<Empty.Media variant="icon"><CircleCheckIcon /></Empty.Media>
						<Empty.Header>
							<Empty.Title>{$_('admin.overview.attention.empty.title')}</Empty.Title>
							<Empty.Description>{$_('admin.overview.attention.empty.description')}</Empty.Description>
						</Empty.Header>
					</Empty.Root>
				{:else}
					<div class="divide-y rounded-lg border">
						{#if overview.ai_tasks.failed_count_24h > 0}
							<a class="flex min-h-16 items-center gap-3 px-4 hover:bg-accent" href={drilldowns.failedTasks}>
								<TriangleAlertIcon class="size-4 text-destructive" />
								<div class="min-w-0 flex-1">
									<p class="text-sm font-medium">{$_('admin.overview.attention.failed')}</p>
									<p class="text-xs text-muted-foreground">{$_('admin.overview.last24h')}</p>
								</div>
								<span class="font-semibold tabular-nums">{formatNumber(overview.ai_tasks.failed_count_24h)}</span>
								<ArrowRightIcon class="size-4 text-muted-foreground" />
							</a>
						{/if}
						{#if overview.redemption_codes.claimed_count > 0}
							<a class="flex min-h-16 items-center gap-3 px-4 hover:bg-accent" href={drilldowns.claimedCodes}>
								<TicketCheckIcon class="size-4 text-muted-foreground" />
								<div class="min-w-0 flex-1">
									<p class="text-sm font-medium">{$_('admin.overview.attention.claimed')}</p>
									<p class="text-xs text-muted-foreground">{$_('admin.overview.attention.current')}</p>
								</div>
								<span class="font-semibold tabular-nums">{formatNumber(overview.redemption_codes.claimed_count)}</span>
								<ArrowRightIcon class="size-4 text-muted-foreground" />
							</a>
						{/if}
						{#if overview.payments.disputed_count > 0}
							<a class="flex min-h-16 items-center gap-3 px-4 hover:bg-accent" href={drilldowns.disputedPayments}>
								<CreditCardIcon class="size-4 text-muted-foreground" />
								<div class="min-w-0 flex-1">
									<p class="text-sm font-medium">{$_('admin.overview.attention.disputed')}</p>
									<p class="text-xs text-muted-foreground">{$_('admin.overview.attention.current')}</p>
								</div>
								<span class="font-semibold tabular-nums">{formatNumber(overview.payments.disputed_count)}</span>
								<ArrowRightIcon class="size-4 text-muted-foreground" />
							</a>
						{/if}
					</div>
				{/if}
			</section>

			<section aria-labelledby="overview-distribution-title">
				<div class="mb-4">
					<h2 id="overview-distribution-title" class="text-base font-semibold">{$_('admin.overview.distribution.title')}</h2>
					<p class="mt-1 text-sm text-muted-foreground">
						{$_('admin.overview.distribution.description', { values: { total: overview.ai_tasks.total_24h } })}
					</p>
				</div>
				<div class="space-y-5 rounded-lg border p-4">
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
