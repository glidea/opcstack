<script lang="ts">
	import type { ListAdminUsersResponseItem } from '$apiContract/admin-users'
	import type { AdminAiTask, AdminAiTaskSummary } from '$apiContract/admin-ai-tasks'
	import { client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Badge } from '$frontend/ui/badge'
	import { Button } from '$frontend/ui/button'
	import { Separator } from '$frontend/ui/separator'
	import { Skeleton } from '$frontend/ui/skeleton'
	import * as Sheet from '$frontend/ui/sheet'
	import CheckIcon from '@lucide/svelte/icons/check'
	import CopyIcon from '@lucide/svelte/icons/copy'
	import DatabaseIcon from '@lucide/svelte/icons/database'
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
	import HardDriveIcon from '@lucide/svelte/icons/hard-drive'
	import ListRestartIcon from '@lucide/svelte/icons/list-restart'
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
	import ServerCogIcon from '@lucide/svelte/icons/server-cog'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import UserIcon from '@lucide/svelte/icons/user'
	import {
		createAiTaskUserHref,
		createCloudflareTaskLinks,
		extractR2Results,
		formatStoredJson,
		getAiTaskStatusVariant,
		type CloudflareResourceContext,
		type CloudflareTaskLinks,
		type R2TaskResult
	} from './ai-tasks-page'

	type DetailState =
		| { status: 'idle' }
		| { status: 'loading' }
		| { status: 'loaded'; task: AdminAiTask; databaseId: string | null }
		| { status: 'error' }

	let {
		open = $bindable(false),
		summary,
		locale,
		cloudflare
	}: {
		open?: boolean
		summary: AdminAiTaskSummary | null
		locale: string
		cloudflare: CloudflareResourceContext
	} = $props()

	let detailState: DetailState = $state<DetailState>({ status: 'idle' })
	let loadedKey: string = $state('')
	let copiedValue: string = $state('')
	const task: AdminAiTask | null = $derived(
		detailState.status === 'loaded' ? detailState.task : null
	)
	const links: CloudflareTaskLinks | null = $derived(
		task
			? createCloudflareTaskLinks(
					cloudflare,
					detailState.status === 'loaded' ? detailState.databaseId : null,
					task.task_type
				)
			: null
	)
	const r2Results: R2TaskResult[] = $derived(task ? extractR2Results(task.result_json) : [])

	$effect((): void => {
		if (!open || !summary) {
			return
		}
		const key: string = `${summary.task_type}:${summary.shard_id}:${summary.id}`
		if (key === loadedKey) {
			return
		}
		loadedKey = key
		void loadDetail()
	})

	async function loadDetail(): Promise<void> {
		if (!summary) {
			return
		}
		detailState = { status: 'loading' }
		try {
			const [taskResponse, usersResponse] = await Promise.all([
				client.api.getAdminAiTask({
					task_type: summary.task_type,
					shard_id: summary.shard_id,
					id: summary.id
				}),
				client.api.listAdminUsers({ search: summary.user_id, page: 1, page_size: 20 })
			])
			const user: ListAdminUsersResponseItem | undefined = usersResponse.items.find(
				(item: ListAdminUsersResponseItem): boolean => item.id === summary.user_id
			)
			detailState = {
				status: 'loaded',
				task: taskResponse.task,
				databaseId: user?.shard?.database_id ?? null
			}
		} catch {
			detailState = { status: 'error' }
		}
	}

	async function copyValue(value: string): Promise<void> {
		await navigator.clipboard.writeText(value)
		copiedValue = value
		setTimeout((): void => {
			copiedValue = ''
		}, 1500)
	}

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
	<Sheet.Content class="w-full sm:max-w-2xl">
		{#if summary}
			<Sheet.Header>
				<Sheet.Title>{$_('admin.aiTasks.detail.title')}</Sheet.Title>
				<Sheet.Description>{summary.id}</Sheet.Description>
			</Sheet.Header>

			{#if detailState.status === 'loading' || detailState.status === 'idle'}
				<div class="grid flex-1 content-start gap-4 px-4">
					{#each Array(8) as _item}<Skeleton class="h-12 w-full" />{/each}
				</div>
			{:else if detailState.status === 'error'}
				<div class="px-4">
					<Alert.Root variant="destructive">
						<TriangleAlertIcon />
						<Alert.Title>{$_('admin.aiTasks.detail.error.title')}</Alert.Title>
						<Alert.Description>{$_('admin.aiTasks.detail.error.description')}</Alert.Description>
						<Alert.Action><Button variant="ghost" size="sm" onclick={loadDetail}>{$_('admin.aiTasks.retry')}</Button></Alert.Action>
					</Alert.Root>
				</div>
			{:else}
				<div class="flex-1 space-y-6 overflow-y-auto px-4 pb-6">
					<div class="flex flex-wrap gap-2">
						<Button variant="outline" size="sm" href={createAiTaskUserHref(locale, detailState.task.user_id)}>
							<UserIcon />
							{$_('admin.aiTasks.openUser')}
						</Button>
						{#if detailState.task.status === 'processing'}
							<Button variant="outline" size="sm" onclick={loadDetail}>
								<RefreshCwIcon />
								{$_('admin.aiTasks.refreshState')}
							</Button>
						{/if}
					</div>

					{#if detailState.task.last_error_message}
						<Alert.Root variant="destructive">
							<TriangleAlertIcon />
							<Alert.Title>{$_('admin.aiTasks.lastError')}</Alert.Title>
							<Alert.Description class="break-words">{detailState.task.last_error_message}</Alert.Description>
						</Alert.Root>
					{/if}

					<section aria-labelledby="ai-task-common-title">
						<h3 id="ai-task-common-title" class="mb-3 text-sm font-semibold">{$_('admin.aiTasks.detail.common')}</h3>
						<dl class="grid gap-4 text-sm">
							<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.id')}</dt><dd class="break-all font-mono text-xs">{detailState.task.id}</dd></div>
							<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.user')}</dt><dd class="break-all font-mono text-xs">{detailState.task.user_id}</dd></div>
							<div class="grid grid-cols-2 gap-3">
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.type')}</dt><dd><Badge variant="outline">{detailState.task.task_type}</Badge></dd></div>
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.status')}</dt><dd><Badge variant={getAiTaskStatusVariant(detailState.task.status)}>{detailState.task.status}</Badge></dd></div>
							</div>
							<div class="grid grid-cols-2 gap-3">
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.provider')}</dt><dd>{detailState.task.provider_type}<br><span class="font-mono text-xs text-muted-foreground">{detailState.task.provider_id ?? $_('admin.common.none')}</span></dd></div>
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.model')}</dt><dd>{detailState.task.model ?? $_('admin.common.none')}</dd></div>
							</div>
							<div class="grid grid-cols-2 gap-3">
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.shard')}</dt><dd class="break-all font-mono text-xs">{detailState.task.shard_id}</dd></div>
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.attempts')}</dt><dd>{detailState.task.attempt_count}</dd></div>
							</div>
							<div class="grid grid-cols-2 gap-3">
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.created')}</dt><dd>{formatDate(detailState.task.created_at)}</dd></div>
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.updated')}</dt><dd>{formatDate(detailState.task.updated_at)}</dd></div>
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.completed')}</dt><dd>{formatDate(detailState.task.completed_at)}</dd></div>
							</div>
						</dl>
					</section>

					<Separator />

					<section aria-labelledby="ai-task-input-title">
						<h3 id="ai-task-input-title" class="mb-3 text-sm font-semibold">{$_('admin.aiTasks.detail.input')}</h3>
						{#if detailState.task.task_type === 'image'}
							<dl class="grid gap-4 text-sm">
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.prompt')}</dt><dd class="whitespace-pre-wrap break-words">{detailState.task.prompt}</dd></div>
								<div class="grid grid-cols-2 gap-3">
									<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.imageCount')}</dt><dd>{detailState.task.number_of_images ?? $_('admin.common.none')}</dd></div>
									<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.aspectRatio')}</dt><dd>{detailState.task.aspect_ratio ?? $_('admin.common.none')}</dd></div>
									<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.imageSize')}</dt><dd>{detailState.task.image_size ?? $_('admin.common.none')}</dd></div>
									<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.lowCensorship')}</dt><dd>{detailState.task.low_censorship ? $_('admin.common.yes') : $_('admin.common.no')}</dd></div>
								</div>
								<div class="grid grid-cols-2 gap-3">
									<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.uploadR2')}</dt><dd>{detailState.task.upload_to_r2 ? $_('admin.common.yes') : $_('admin.common.no')}</dd></div>
									<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.publicResult')}</dt><dd>{detailState.task.r2_upload_is_public ? $_('admin.common.yes') : $_('admin.common.no')}</dd></div>
								</div>
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.r2Directory')}</dt><dd class="break-all font-mono text-xs">{detailState.task.r2_upload_dir ?? $_('admin.common.none')}</dd></div>
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.references')}</dt><dd><pre class="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">{formatStoredJson(detailState.task.references_json)}</pre></dd></div>
							</dl>
						{:else if detailState.task.task_type === 'tts'}
							<dl class="grid gap-4 text-sm">
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.instruction')}</dt><dd class="whitespace-pre-wrap break-words">{detailState.task.instruction ?? $_('admin.common.none')}</dd></div>
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.source')}</dt><dd><pre class="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">{detailState.task.source_json ? formatStoredJson(detailState.task.source_json) : $_('admin.common.none')}</pre></dd></div>
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.speakers')}</dt><dd><pre class="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">{formatStoredJson(detailState.task.speakers_json)}</pre></dd></div>
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.lines')}</dt><dd><pre class="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">{formatStoredJson(detailState.task.lines_json)}</pre></dd></div>
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.uploadR2')}</dt><dd>{detailState.task.upload_to_r2 ? $_('admin.common.yes') : $_('admin.common.no')}</dd></div>
							</dl>
						{:else}
							<dl class="grid gap-4 text-sm">
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.prompt')}</dt><dd class="whitespace-pre-wrap break-words">{detailState.task.prompt}</dd></div>
								<div class="grid grid-cols-2 gap-3">
									<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.ratio')}</dt><dd>{detailState.task.ratio ?? $_('admin.common.none')}</dd></div>
									<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.resolution')}</dt><dd>{detailState.task.resolution ?? $_('admin.common.none')}</dd></div>
									<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.duration')}</dt><dd>{detailState.task.duration}</dd></div>
									<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.publicResult')}</dt><dd>{detailState.task.r2_upload_is_public ? $_('admin.common.yes') : $_('admin.common.no')}</dd></div>
								</div>
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.providerTaskId')}</dt><dd class="break-all font-mono text-xs">{detailState.task.provider_task_id ?? $_('admin.common.none')}</dd></div>
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.r2Directory')}</dt><dd class="break-all font-mono text-xs">{detailState.task.r2_upload_dir ?? $_('admin.common.none')}</dd></div>
								<div class="grid gap-1"><dt class="text-xs text-muted-foreground">{$_('admin.aiTasks.references')}</dt><dd><pre class="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">{formatStoredJson(detailState.task.references_json)}</pre></dd></div>
							</dl>
						{/if}
					</section>

					<Separator />

					<section aria-labelledby="ai-task-result-title">
						<h3 id="ai-task-result-title" class="mb-3 text-sm font-semibold">{$_('admin.aiTasks.detail.result')}</h3>
						{#if detailState.task.result_json}
							<div class="space-y-3">
								<pre class="max-h-96 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">{formatStoredJson(detailState.task.result_json)}</pre>
								{#each r2Results as result (result.key)}
									<div class="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
										<div class="min-w-0">
											<Badge variant={result.isPublic ? 'secondary' : 'outline'}>{result.isPublic ? $_('admin.aiTasks.public') : $_('admin.aiTasks.private')}</Badge>
											<p class="mt-1 break-all font-mono text-xs">{result.key}</p>
										</div>
										<div class="flex gap-2">
											<Button variant="ghost" size="icon-sm" onclick={() => copyValue(result.isPublic && result.openUrl ? result.openUrl : result.key)} aria-label={result.isPublic ? $_('admin.aiTasks.copyUrl') : $_('admin.aiTasks.copyPath')} title={result.isPublic ? $_('admin.aiTasks.copyUrl') : $_('admin.aiTasks.copyPath')}>
												{#if copiedValue === (result.isPublic && result.openUrl ? result.openUrl : result.key)}<CheckIcon />{:else}<CopyIcon />{/if}
											</Button>
											{#if result.openUrl}
												<Button variant="outline" size="sm" href={result.openUrl} target="_blank" rel="noopener">
													<ExternalLinkIcon />
													{$_('admin.aiTasks.openResult')}
												</Button>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-sm text-muted-foreground">{$_('admin.aiTasks.noResult')}</p>
						{/if}
					</section>

					{#if links && (links.database || links.queue || links.bucket || links.worker)}
						<Separator />
						<section aria-labelledby="ai-task-cloudflare-title">
							<h3 id="ai-task-cloudflare-title" class="mb-3 text-sm font-semibold">{$_('admin.aiTasks.cloudflare')}</h3>
							<div class="flex flex-wrap gap-2">
								{#if links.database}<Button variant="outline" size="sm" href={links.database} target="_blank" rel="noopener"><DatabaseIcon />D1<ExternalLinkIcon /></Button>{/if}
								{#if links.queue}<Button variant="outline" size="sm" href={links.queue} target="_blank" rel="noopener"><ListRestartIcon />{links.queueName}<ExternalLinkIcon /></Button>{/if}
								{#if links.bucket}<Button variant="outline" size="sm" href={links.bucket} target="_blank" rel="noopener"><HardDriveIcon />R2<ExternalLinkIcon /></Button>{/if}
								{#if links.worker}<Button variant="outline" size="sm" href={links.worker} target="_blank" rel="noopener"><ServerCogIcon />{$_('admin.aiTasks.workerLogs')}<ExternalLinkIcon /></Button>{/if}
							</div>
						</section>
					{/if}
				</div>
			{/if}
		{/if}
	</Sheet.Content>
</Sheet.Root>
