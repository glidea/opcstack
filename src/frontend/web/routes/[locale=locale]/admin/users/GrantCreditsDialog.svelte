<script lang="ts">
	import { ApiClientError, client } from '$apiContract/client'
	import type { ListAdminUsersResponseItem } from '$apiContract/admin-users'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Button } from '$frontend/ui/button'
	import * as Dialog from '$frontend/ui/dialog'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import { Textarea } from '$frontend/ui/textarea'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import {
		buildGrantCreditsRequest,
		createGrantAttempt,
		createGrantConfirmation,
		validateCreditAmount,
		type GrantAttempt,
		type GrantConfirmation,
		type GrantCreditsInput
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
	let expiresAtInput: string = $state('')
	let amountError: string = $state('')
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
			expiresAtInput = ''
			amountError = ''
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
		const input: GrantCreditsInput = createGrantInput()
		confirmation = createGrantConfirmation(input)
		confirming = true
	}

	function createGrantInput(): GrantCreditsInput {
		return {
			userId: user.id,
			amount: amount.trim(),
			description: description.trim(),
			expiresAt: expiresAtInput === '' ? null : new Date(expiresAtInput).getTime()
		}
	}

	async function submitGrant(): Promise<void> {
		if (!attempt) {
			return
		}
		submitting = true
		requestError = ''
		try {
			const response = await client.api.grantCredits(
				buildGrantCreditsRequest(attempt, createGrantInput())
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
			<Dialog.Description>{$_('admin.users.grant.description')}</Dialog.Description>
		</Dialog.Header>

		{#if confirming && confirmation}
			<div class="space-y-4">
				<dl class="grid gap-3 rounded-lg border p-3 text-sm">
					<div class="grid gap-1">
						<dt class="text-xs text-muted-foreground">{$_('admin.users.grant.user')}</dt>
						<dd class="break-all font-mono text-xs">{confirmation.userId}</dd>
					</div>
					<div class="grid gap-1">
						<dt class="text-xs text-muted-foreground">{$_('admin.users.grant.amount')}</dt>
						<dd class="font-medium">{confirmation.amount}</dd>
					</div>
					<div class="grid gap-1">
						<dt class="text-xs text-muted-foreground">{$_('admin.users.grant.note')}</dt>
						<dd>{confirmation.description || $_('admin.users.grant.none')}</dd>
					</div>
					<div class="grid gap-1">
						<dt class="text-xs text-muted-foreground">{$_('admin.users.grant.expires')}</dt>
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
			<form class="space-y-4" onsubmit={reviewGrant}>
				<Field.Field>
					<Field.Label for="grant-user">{$_('admin.users.grant.user')}</Field.Label>
					<Input id="grant-user" value={`${user.name} · ${user.id}`} disabled />
				</Field.Field>
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
					<Field.Description>{$_('admin.users.grant.amountHint')}</Field.Description>
					<Field.Error>{amountError}</Field.Error>
				</Field.Field>
				<Field.Field>
					<Field.Label for="grant-description">{$_('admin.users.grant.note')}</Field.Label>
					<Textarea
						id="grant-description"
						bind:value={description}
						autocomplete="off"
						placeholder={$_('admin.users.grant.notePlaceholder')}
					/>
				</Field.Field>
				<Field.Field>
					<Field.Label for="grant-expires">{$_('admin.users.grant.expires')}</Field.Label>
					<Input id="grant-expires" bind:value={expiresAtInput} type="datetime-local" />
				</Field.Field>
				<Dialog.Footer>
					<Button type="submit">{$_('admin.users.grant.review')}</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
