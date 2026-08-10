<script lang="ts">
	import type { GenerateBetaCodesResponseCode } from '$apiContract/beta'
	import { client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Button } from '$frontend/ui/button'
	import * as Dialog from '$frontend/ui/dialog'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import CheckIcon from '@lucide/svelte/icons/check'
	import CopyIcon from '@lucide/svelte/icons/copy'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import { joinBetaCodes, validateGenerateCount } from './beta-codes-page'

	let {
		open = $bindable(false),
		onGenerated
	}: {
		open?: boolean
		onGenerated: () => void
	} = $props()

	let countInput: string = $state('20')
	let countError: string = $state('')
	let requestError: string = $state('')
	let confirming: boolean = $state(false)
	let submitting: boolean = $state(false)
	let codes: GenerateBetaCodesResponseCode[] = $state([])
	let copiedCode: string = $state('')
	let copiedAll: boolean = $state(false)
	let wasOpen: boolean = false

	$effect((): void => {
		const closedWithResults: boolean = !open && wasOpen && codes.length > 0
		if (open && !wasOpen) {
			countInput = '20'
			countError = ''
			requestError = ''
			confirming = false
			submitting = false
			codes = []
			copiedCode = ''
			copiedAll = false
		}
		wasOpen = open
		if (closedWithResults) {
			onGenerated()
		}
	})

	function reviewGeneration(event: SubmitEvent): void {
		event.preventDefault()
		if (!validateGenerateCount(countInput.trim())) {
			countError = $_('admin.betaCodes.generate.countError')
			return
		}
		countError = ''
		requestError = ''
		confirming = true
	}

	async function generateCodes(): Promise<void> {
		submitting = true
		requestError = ''
		try {
			const response = await client.api.generateBetaCodes({ count: Number(countInput) })
			codes = response.codes
		} catch {
			requestError = $_('admin.betaCodes.generate.error')
		} finally {
			submitting = false
		}
	}

	async function copyCode(code: string): Promise<void> {
		await navigator.clipboard.writeText(code)
		copiedCode = code
		setTimeout((): void => {
			copiedCode = ''
		}, 1500)
	}

	async function copyAll(): Promise<void> {
		await navigator.clipboard.writeText(joinBetaCodes(codes))
		copiedAll = true
		setTimeout((): void => {
			copiedAll = false
		}, 1500)
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{$_('admin.betaCodes.generate.title')}</Dialog.Title>
			<Dialog.Description class="sr-only">{$_('admin.betaCodes.generate.description')}</Dialog.Description>
		</Dialog.Header>

		{#if codes.length > 0}
			<div class="space-y-4">
				<Alert.Root>
					<CheckIcon />
					<Alert.Title>{$_('admin.betaCodes.generate.success')}</Alert.Title>
					<Alert.Description>
						{$_('admin.betaCodes.generate.successDescription', { values: { count: codes.length } })}
					</Alert.Description>
				</Alert.Root>
				<div class="flex justify-end">
					<Button variant="outline" size="sm" onclick={copyAll}>
						{#if copiedAll}<CheckIcon />{:else}<CopyIcon />{/if}
						{copiedAll ? $_('admin.betaCodes.copied') : $_('admin.betaCodes.copyAll')}
					</Button>
				</div>
				<div class="max-h-80 overflow-y-auto rounded-lg border">
					{#each codes as item (item.id)}
						<div class="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0">
							<code class="font-mono text-sm">{item.code}</code>
							<Button
								variant="ghost"
								size="icon-sm"
								onclick={() => copyCode(item.code)}
								aria-label={$_('admin.betaCodes.copyCode')}
								title={$_('admin.betaCodes.copyCode')}
							>
								{#if copiedCode === item.code}<CheckIcon />{:else}<CopyIcon />{/if}
							</Button>
						</div>
					{/each}
				</div>
			</div>
			<Dialog.Footer>
				<Button onclick={() => (open = false)}>{$_('admin.betaCodes.generate.done')}</Button>
			</Dialog.Footer>
		{:else if confirming}
			<div class="space-y-4">
				<p class="text-sm">
					{$_('admin.betaCodes.generate.confirmDescription', {
						values: { count: Number(countInput) }
					})}
				</p>
				{#if requestError !== ''}
					<Alert.Root variant="destructive">
						<TriangleAlertIcon />
						<Alert.Title>{$_('admin.betaCodes.generate.failed')}</Alert.Title>
						<Alert.Description>{requestError}</Alert.Description>
					</Alert.Root>
				{/if}
			</div>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (confirming = false)} disabled={submitting}>
					{$_('admin.betaCodes.generate.back')}
				</Button>
				<Button onclick={generateCodes} disabled={submitting}>
					{submitting
						? $_('admin.betaCodes.generate.submitting')
						: $_('admin.betaCodes.generate.confirm')}
				</Button>
			</Dialog.Footer>
		{:else}
			<form class="space-y-4" onsubmit={reviewGeneration}>
				<Field.Field data-invalid={countError !== ''}>
					<Field.Label for="beta-code-count">{$_('admin.betaCodes.generate.count')}</Field.Label>
					<Input
						id="beta-code-count"
						bind:value={countInput}
						inputmode="numeric"
						autocomplete="off"
						aria-invalid={countError !== ''}
					/>
					<Field.Error>{countError}</Field.Error>
				</Field.Field>
				<Dialog.Footer>
					<Button type="submit">{$_('admin.betaCodes.generate.review')}</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
