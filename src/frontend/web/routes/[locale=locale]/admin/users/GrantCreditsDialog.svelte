<script lang="ts">
	import { ApiClientError, client } from '$apiContract/client'
	import type { ListAdminUsersResponseItem } from '$apiContract/admin-users'
	import type { AdminGrantCreditsResponse } from '$apiContract/credits'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Button } from '$frontend/ui/button'
	import * as Dialog from '$frontend/ui/dialog'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import { Textarea } from '$frontend/ui/textarea'
	import * as ToggleGroup from '$frontend/ui/toggle-group'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import {
		buildGrantCreditsRequest,
		createGrantAttempt,
		createGrantConfirmation,
		resolveGrantExpiry,
		validateCreditAmount,
		type GrantAttempt,
		type GrantConfirmation,
		type GrantCreditsInput,
		type GrantExpiryOption
	} from './users-page'

	let {
		open = $bindable(false),
		user,
		locale,
		onGranted
	}: {
		open?: boolean
		user: ListAdminUsersResponseItem
		locale: string
		onGranted: (balance: string) => void
	} = $props()

	let amount: string = $state('')
	let description: string = $state('')
	let expiryOption: GrantExpiryOption = $state('never')
	let customExpiry: string = $state('')
	let amountError: string = $state('')
	let expiryError: string = $state('')
	let requestError: string = $state('')
	let confirming: boolean = $state(false)
	let submitting: boolean = $state(false)
	let attempt: GrantAttempt | null = $state(null)
	let confirmation: GrantConfirmation | null = $state(null)
	let wasOpen: boolean = false

	$effect((): void => {
		if (open && !wasOpen) {
			amount = ''
			description = ''
			expiryOption = 'never'
			customExpiry = ''
			amountError = ''
			expiryError = ''
			requestError = ''
			confirming = false
			submitting = false
			attempt = createGrantAttempt()
			confirmation = null
		}
		wasOpen = open
	})

	function reviewGrant(event: SubmitEvent): void {
		event.preventDefault()
		requestError = ''
		if (!validateCreditAmount(amount.trim())) {
			amountError = $_('admin.users.grant.amountError')
			return
		}
		amountError = ''
		const customExpiresAt: number | null = expiryOption === 'custom'
			? new Date(customExpiry).getTime()
			: null
		if (expiryOption === 'custom' && (customExpiresAt === null || !Number.isFinite(customExpiresAt) || customExpiresAt <= Date.now())) {
			expiryError = $_('admin.users.grant.customError')
			return
		}
		expiryError = ''
		const input: GrantCreditsInput = createGrantInput(customExpiresAt)
		confirmation = createGrantConfirmation(input)
		confirming = true
	}

	function createGrantInput(customExpiresAt: number | null): GrantCreditsInput {
		return {
			userId: user.id,
			amount: amount.trim(),
			description: description.trim(),
			expiresAt: resolveGrantExpiry(expiryOption, Date.now(), customExpiresAt)
		}
	}

	async function submitGrant(): Promise<void> {
		if (!attempt || !confirmation) {
			return
		}
		submitting = true
		requestError = ''
		try {
			const response: AdminGrantCreditsResponse = await client.api.grantCredits(
				buildGrantCreditsRequest(attempt, confirmation)
			)
			onGranted(response.balance)
			open = false
		} catch (error) {
			requestError = formatGrantError(error)
		} finally {
			submitting = false
		}
	}

	function formatExpiry(value: number | null): string {
		if (value === null) {
			return $_('admin.users.grant.never')
		}
		return new Intl.DateTimeFormat(locale, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(value)
	}

	function formatGrantError(error: unknown): string {
		if (!(error instanceof ApiClientError)) {
			return $_('admin.users.grant.uncertainError')
		}
		switch (error.body.code) {
			case 'CREDIT_GRANT_DUPLICATED':
				return $_('admin.users.grant.duplicatedError')
			case 'CREDIT_USER_NOT_FOUND':
				return $_('admin.users.grant.userNotFoundError')
			case 'INVALID_CREDIT_AMOUNT':
			case 'INVALID_REQUEST':
				return $_('admin.users.grant.amountError')
			default:
				return error.message
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{$_('admin.users.grant.title')}</Dialog.Title>
			<Dialog.Description>{$_('admin.users.grant.description', { values: { email: user.email } })}</Dialog.Description>
		</Dialog.Header>

		{#if confirming && confirmation}
			<div class="space-y-3">
				<dl class="divide-y rounded-md bg-muted/50 px-3 text-sm">
					<div class="flex items-center justify-between gap-4 py-2.5">
						<dt class="text-muted-foreground">{$_('admin.users.grant.amount')}</dt>
						<dd class="font-medium tabular-nums">{confirmation.amount}</dd>
					</div>
					<div class="flex items-start justify-between gap-4 py-2.5">
						<dt class="text-muted-foreground">{$_('admin.users.grant.note')}</dt>
						<dd class="max-w-64 text-right">{confirmation.description || $_('admin.users.grant.none')}</dd>
					</div>
					<div class="flex items-center justify-between gap-4 py-2.5">
						<dt class="text-muted-foreground">{$_('admin.users.grant.expires')}</dt>
						<dd>{formatExpiry(confirmation.expiresAt)}</dd>
					</div>
				</dl>

				{#if requestError !== ''}
					<Alert.Root variant="destructive">
						<TriangleAlertIcon />
						<Alert.Title>{$_('admin.users.grant.failed')}</Alert.Title>
						<Alert.Description>{requestError}</Alert.Description>
					</Alert.Root>
				{/if}
			</div>

			<Dialog.Footer>
				<Button variant="outline" onclick={() => (confirming = false)} disabled={submitting}>
					{$_('admin.users.grant.back')}
				</Button>
				<Button onclick={submitGrant} disabled={submitting}>
					{submitting ? $_('admin.users.grant.submitting') : $_('admin.users.grant.confirm')}
				</Button>
			</Dialog.Footer>
		{:else}
			<form class="space-y-3" onsubmit={reviewGrant}>
				<Field.Field data-invalid={amountError !== ''}>
					<Field.Label for="grant-amount">{$_('admin.users.grant.amount')}</Field.Label>
					<Input
						id="grant-amount"
						bind:value={amount}
						inputmode="decimal"
						autocomplete="off"
						placeholder="10"
						aria-invalid={amountError !== ''}
					/>
					{#if amountError !== ''}<Field.Error class="min-h-0">{amountError}</Field.Error>{/if}
				</Field.Field>
				<Field.Field>
					<Field.Label for="grant-description">{$_('admin.users.grant.note')}</Field.Label>
					<Textarea
						id="grant-description"
						bind:value={description}
						autocomplete="off"
						placeholder={$_('admin.users.grant.notePlaceholder')}
						class="min-h-20 resize-none"
					/>
				</Field.Field>
				<Field.Field>
					<Field.Label>{$_('admin.users.grant.expires')}</Field.Label>
					<ToggleGroup.Root type="single" bind:value={expiryOption} variant="outline" spacing={0} class="w-full">
						<ToggleGroup.Item value="never" class="flex-1" aria-label={$_('admin.users.grant.never')}>{$_('admin.users.grant.never')}</ToggleGroup.Item>
						<ToggleGroup.Item value="week" class="flex-1" aria-label={$_('admin.users.grant.oneWeek')}>{$_('admin.users.grant.oneWeek')}</ToggleGroup.Item>
						<ToggleGroup.Item value="month" class="flex-1" aria-label={$_('admin.users.grant.oneMonth')}>{$_('admin.users.grant.oneMonth')}</ToggleGroup.Item>
						<ToggleGroup.Item value="custom" class="flex-1" aria-label={$_('admin.users.grant.custom')}>{$_('admin.users.grant.custom')}</ToggleGroup.Item>
					</ToggleGroup.Root>
					{#if expiryOption === 'custom'}
						<Input id="grant-custom-expiry" type="datetime-local" bind:value={customExpiry} aria-invalid={expiryError !== ''} />
					{/if}
					{#if expiryError !== ''}<Field.Error class="min-h-0">{expiryError}</Field.Error>{/if}
				</Field.Field>
				<Dialog.Footer>
					<Button type="submit">{$_('admin.users.grant.review')}</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
