<script lang="ts">
	import type { CreditCodeResponseItem } from '$apiContract/credits'
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
	import { formatCreditAmount } from '../presentation'
	import {
		joinCreditCodes,
		validateCreditCodeAmount,
		validateCreditCodeCount
	} from './credit-codes-page'

	let {
		open = $bindable(false),
		locale,
		onGenerated
	}: {
		open?: boolean
		locale: string
		onGenerated: () => void
	} = $props()

	let countInput: string = $state('20')
	let amountInput: string = $state('10')
	let expiresInput: string = $state('')
	let countError: string = $state('')
	let amountError: string = $state('')
	let requestError: string = $state('')
	let confirming: boolean = $state(false)
	let submitting: boolean = $state(false)
	let codes: CreditCodeResponseItem[] = $state([])
	let copiedCode: string = $state('')
	let copiedAll: boolean = $state(false)
	let wasOpen: boolean = false

	$effect((): void => {
		const closedWithResults: boolean = !open && wasOpen && codes.length > 0
		if (open && !wasOpen) {
			countInput = '20'
			amountInput = '10'
			expiresInput = ''
			countError = ''
			amountError = ''
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
		countError = validateCreditCodeCount(countInput.trim())
			? ''
			: $_('admin.creditCodes.generate.countError')
		amountError = validateCreditCodeAmount(amountInput.trim())
			? ''
			: $_('admin.creditCodes.generate.amountError')
		if (countError !== '' || amountError !== '') {
			return
		}
		requestError = ''
		confirming = true
	}

	async function generateCodes(): Promise<void> {
		submitting = true
		requestError = ''
		try {
			const response = await client.api.generateCreditCodes({
				count: Number(countInput),
				amount: amountInput.trim(),
				expires_at: expiresInput === '' ? null : new Date(expiresInput).getTime()
			})
			codes = response.codes
		} catch {
			requestError = $_('admin.creditCodes.generate.error')
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
		await navigator.clipboard.writeText(joinCreditCodes(codes))
		copiedAll = true
		setTimeout((): void => {
			copiedAll = false
		}, 1500)
	}

	function formatExpiry(value: number | null): string {
		if (value === null) {
			return $_('admin.creditCodes.never')
		}
		return new Intl.DateTimeFormat(locale, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(value)
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{$_('admin.creditCodes.generate.title')}</Dialog.Title>
			<Dialog.Description class="sr-only">{$_('admin.creditCodes.generate.description')}</Dialog.Description>
		</Dialog.Header>

		{#if codes.length > 0}
			<div class="space-y-4">
				<Alert.Root>
					<CheckIcon />
					<Alert.Title>{$_('admin.creditCodes.generate.success')}</Alert.Title>
					<Alert.Description>
						{$_('admin.creditCodes.generate.successDescription', { values: { count: codes.length } })}
					</Alert.Description>
				</Alert.Root>
				<dl class="grid grid-cols-2 gap-3 text-sm">
					<div>
						<dt class="text-xs text-muted-foreground">{$_('admin.creditCodes.amount')}</dt>
						<dd>{formatCreditAmount(codes[0]?.amount ?? '0', locale)}</dd>
					</div>
					<div>
						<dt class="text-xs text-muted-foreground">{$_('admin.creditCodes.expires')}</dt>
						<dd>{formatExpiry(codes[0]?.expires_at ?? null)}</dd>
					</div>
				</dl>
				<div class="flex justify-end">
					<Button variant="outline" size="sm" onclick={copyAll}>
						{#if copiedAll}<CheckIcon />{:else}<CopyIcon />{/if}
						{copiedAll ? $_('admin.creditCodes.copied') : $_('admin.creditCodes.copyAll')}
					</Button>
				</div>
				<div class="max-h-72 overflow-y-auto rounded-lg border">
					{#each codes as item (item.id)}
						<div class="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0">
							<code class="font-mono text-sm">{item.code}</code>
							<Button
								variant="ghost"
								size="icon-sm"
								onclick={() => copyCode(item.code)}
								aria-label={$_('admin.creditCodes.copyCode')}
								title={$_('admin.creditCodes.copyCode')}
							>
								{#if copiedCode === item.code}<CheckIcon />{:else}<CopyIcon />{/if}
							</Button>
						</div>
					{/each}
				</div>
			</div>
			<Dialog.Footer>
				<Button onclick={() => (open = false)}>{$_('admin.creditCodes.generate.done')}</Button>
			</Dialog.Footer>
		{:else if confirming}
			<div class="space-y-4">
				<dl class="grid gap-3 rounded-lg border p-3 text-sm">
					<div>
						<dt class="text-xs text-muted-foreground">{$_('admin.creditCodes.generate.count')}</dt>
						<dd>{countInput}</dd>
					</div>
					<div>
						<dt class="text-xs text-muted-foreground">{$_('admin.creditCodes.amount')}</dt>
						<dd>{formatCreditAmount(amountInput, locale)}</dd>
					</div>
					<div>
						<dt class="text-xs text-muted-foreground">{$_('admin.creditCodes.expires')}</dt>
						<dd>{expiresInput === '' ? $_('admin.creditCodes.never') : expiresInput}</dd>
					</div>
				</dl>
				{#if requestError !== ''}
					<Alert.Root variant="destructive">
						<TriangleAlertIcon />
						<Alert.Title>{$_('admin.creditCodes.generate.failed')}</Alert.Title>
						<Alert.Description>{requestError}</Alert.Description>
					</Alert.Root>
				{/if}
			</div>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (confirming = false)} disabled={submitting}>
					{$_('admin.creditCodes.generate.back')}
				</Button>
				<Button onclick={generateCodes} disabled={submitting}>
					{submitting
						? $_('admin.creditCodes.generate.submitting')
						: $_('admin.creditCodes.generate.confirm')}
				</Button>
			</Dialog.Footer>
		{:else}
			<form class="space-y-4" onsubmit={reviewGeneration}>
				<div class="grid gap-4 sm:grid-cols-2">
					<Field.Field data-invalid={countError !== ''}>
						<Field.Label for="credit-code-count">{$_('admin.creditCodes.generate.count')}</Field.Label>
						<Input id="credit-code-count" bind:value={countInput} inputmode="numeric" autocomplete="off" aria-invalid={countError !== ''} />
						<Field.Description>{$_('admin.creditCodes.generate.countHint')}</Field.Description>
						<Field.Error>{countError}</Field.Error>
					</Field.Field>
					<Field.Field data-invalid={amountError !== ''}>
						<Field.Label for="credit-code-amount">{$_('admin.creditCodes.amount')}</Field.Label>
						<Input id="credit-code-amount" bind:value={amountInput} inputmode="decimal" autocomplete="off" aria-invalid={amountError !== ''} />
						<Field.Error>{amountError}</Field.Error>
					</Field.Field>
				</div>
				<Field.Field>
					<Field.Label for="credit-code-expires">{$_('admin.creditCodes.expires')}</Field.Label>
					<Input id="credit-code-expires" bind:value={expiresInput} type="datetime-local" />
				</Field.Field>
				<Dialog.Footer>
					<Button type="submit">{$_('admin.creditCodes.generate.review')}</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
