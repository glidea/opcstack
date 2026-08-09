<script lang="ts">
	import type { ListFeedbacksResponseItem } from '$apiContract/feedback'
	import { _ } from '$frontend/i18n'
	import { Badge } from '$frontend/ui/badge'
	import { Button } from '$frontend/ui/button'
	import { Separator } from '$frontend/ui/separator'
	import * as Sheet from '$frontend/ui/sheet'
	import UserIcon from '@lucide/svelte/icons/user'
	import { createFeedbackUserHref } from './feedback-page'

	let {
		open = $bindable(false),
		feedback,
		locale
	}: {
		open?: boolean
		feedback: ListFeedbacksResponseItem | null
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
		{#if feedback}
			<Sheet.Header>
				<Sheet.Title>{$_('admin.feedback.detail.title')}</Sheet.Title>
				<Sheet.Description>{feedback.id}</Sheet.Description>
			</Sheet.Header>
			<div class="flex-1 space-y-5 overflow-y-auto px-4 pb-6">
				<dl class="grid gap-4 text-sm">
					<div class="grid gap-1">
						<dt class="text-xs text-muted-foreground">{$_('admin.feedback.id')}</dt>
						<dd class="break-all font-mono text-xs">{feedback.id}</dd>
					</div>
					<div class="grid gap-1">
						<dt class="text-xs text-muted-foreground">{$_('admin.feedback.user')}</dt>
						<dd>
							<Button variant="outline" size="sm" href={createFeedbackUserHref(locale, feedback.user_id)}>
								<UserIcon />
								<span class="max-w-72 truncate font-mono text-xs">{feedback.user_id}</span>
							</Button>
						</dd>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="grid gap-1">
							<dt class="text-xs text-muted-foreground">{$_('admin.feedback.type')}</dt>
							<dd><Badge variant="outline">{feedback.type}</Badge></dd>
						</div>
						<div class="grid gap-1">
							<dt class="text-xs text-muted-foreground">{$_('admin.feedback.created')}</dt>
							<dd>{formatDate(feedback.created_at)}</dd>
						</div>
					</div>
				</dl>
				<Separator />
				<section aria-labelledby="feedback-content-title">
					<h3 id="feedback-content-title" class="mb-3 text-sm font-semibold">{$_('admin.feedback.content')}</h3>
					<p class="whitespace-pre-wrap break-words text-sm leading-6">{feedback.content}</p>
				</section>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
