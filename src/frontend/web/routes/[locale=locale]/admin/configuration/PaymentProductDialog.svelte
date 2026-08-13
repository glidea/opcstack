<script lang="ts">
	import type { PaymentProduct } from '$apiContract/configuration'
	import { ApiClientError, client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Button } from '$frontend/ui/button'
	import * as Sheet from '$frontend/ui/sheet'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import * as Select from '$frontend/ui/select'
	import { validatePaymentProductForm } from './configuration-collections'

	let {
		open = $bindable(false),
		product,
		onSaved,
		onRefresh
	}: {
		open?: boolean
		product: PaymentProduct | null
		onSaved: (product: PaymentProduct) => void
		onRefresh: () => Promise<void>
	} = $props()

	let productId: string = $state('')
	let type: 'one_time' | 'subscription' = $state('one_time')
	let creditsAmount: string = $state('')
	let subscriptionPlan: string = $state('')
	let upgradeRank: string = $state('')
	let periodCreditsAmount: string = $state('')
	let dodoProductId: string = $state('')
	let creemProductId: string = $state('')
	let errors: Record<string, string> = $state({})
	let requestError: string = $state('')
	let conflict: boolean = $state(false)
	let saving: boolean = $state(false)
	let wasOpen: boolean = false

	$effect((): void => {
		if (open && !wasOpen) resetForm()
		wasOpen = open
	})

	function resetForm(): void {
		productId = product?.product_id ?? ''
		type = product?.type ?? 'one_time'
		creditsAmount = product?.credits_amount ?? ''
		subscriptionPlan = product?.subscription_plan ?? ''
		upgradeRank = product?.upgrade_rank === null || product === null ? '' : String(product.upgrade_rank)
		periodCreditsAmount = product?.period_credits_amount ?? ''
		dodoProductId = product?.dodo_product_id ?? ''
		creemProductId = product?.creem_product_id ?? ''
		errors = {}
		requestError = ''
		conflict = false
	}

	async function saveProduct(event: SubmitEvent): Promise<void> {
		event.preventDefault()
		errors = validatePaymentProductForm({ productId, type, creditsAmount, subscriptionPlan, upgradeRank, periodCreditsAmount, dodoProductId, creemProductId })
		if (Object.keys(errors).length > 0) return
		saving = true
		requestError = ''
		conflict = false
		try {
			const fields = {
				product_id: productId.trim(),
				type,
				credits_amount: type === 'one_time' ? creditsAmount.trim() : null,
				subscription_plan: type === 'subscription' ? subscriptionPlan.trim() : null,
				upgrade_rank: type === 'subscription' ? Number(upgradeRank) : null,
				period_credits_amount: type === 'subscription' ? periodCreditsAmount.trim() : null,
				dodo_product_id: dodoProductId.trim() === '' ? null : dodoProductId.trim(),
				creem_product_id: creemProductId.trim() === '' ? null : creemProductId.trim()
			}
			const saved: PaymentProduct = product === null
				? await client.api.createPaymentProduct(fields)
				: await client.api.updatePaymentProduct({ ...fields, expected_version: product.version })
			onSaved(saved)
			open = false
		} catch (error) {
			conflict = error instanceof ApiClientError && error.body.code === 'CONFIG_CONFLICT'
			requestError = error instanceof ApiClientError ? error.body.message : $_('admin.configuration.entity.saveError')
		} finally {
			saving = false
		}
	}

	async function refreshConflict(): Promise<void> {
		await onRefresh()
		open = false
	}

	function fieldError(name: string): string {
		return errors[name] ?? ''
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content class="w-full overflow-y-auto sm:max-w-2xl">
		<Sheet.Header>
			<Sheet.Title>{product === null ? $_('admin.configuration.payment.products.create') : $_('admin.configuration.payment.products.edit')}</Sheet.Title>
			<Sheet.Description class="sr-only">{$_('admin.configuration.payment.products.dialogDescription')}</Sheet.Description>
		</Sheet.Header>
		<form class="space-y-5 px-4 pb-4" onsubmit={saveProduct}>
			{#if requestError !== ''}
				<Alert.Root variant="destructive">
					<Alert.Description>{requestError}</Alert.Description>
					{#if conflict}<Alert.Action><Button type="button" variant="ghost" size="sm" onclick={refreshConflict}>{$_('admin.configuration.entity.refresh')}</Button></Alert.Action>{/if}
				</Alert.Root>
			{/if}
			<div class="grid gap-4 sm:grid-cols-2">
				<Field.Field data-invalid={fieldError('productId') !== ''}>
					<Field.Label for="payment-product-id">{$_('admin.configuration.payment.products.id')}</Field.Label>
					<Input id="payment-product-id" bind:value={productId} disabled={product !== null} autocomplete="off" aria-invalid={fieldError('productId') !== ''} />
					<Field.Error>{fieldError('productId')}</Field.Error>
				</Field.Field>
				<Field.Field>
					<Field.Label for="payment-product-type">{$_('admin.configuration.payment.products.type')}</Field.Label>
					<Select.Root type="single" bind:value={type}>
						<Select.Trigger id="payment-product-type" class="w-full">{$_(`admin.configuration.payment.products.types.${type}`)}</Select.Trigger>
						<Select.Content><Select.Item value="one_time">{$_('admin.configuration.payment.products.types.one_time')}</Select.Item><Select.Item value="subscription">{$_('admin.configuration.payment.products.types.subscription')}</Select.Item></Select.Content>
					</Select.Root>
				</Field.Field>
			</div>
			{#if type === 'one_time'}
				<Field.Field data-invalid={fieldError('creditsAmount') !== ''}>
					<Field.Label for="payment-product-credits">{$_('admin.configuration.payment.products.credits')}</Field.Label>
					<Input id="payment-product-credits" bind:value={creditsAmount} inputmode="decimal" autocomplete="off" aria-invalid={fieldError('creditsAmount') !== ''} />
					<Field.Error>{fieldError('creditsAmount')}</Field.Error>
				</Field.Field>
			{:else}
				<div class="grid gap-4 sm:grid-cols-3">
					<Field.Field data-invalid={fieldError('subscriptionPlan') !== ''}><Field.Label for="payment-product-plan">{$_('admin.configuration.payment.products.plan')}</Field.Label><Input id="payment-product-plan" bind:value={subscriptionPlan} autocomplete="off" aria-invalid={fieldError('subscriptionPlan') !== ''} /><Field.Error>{fieldError('subscriptionPlan')}</Field.Error></Field.Field>
					<Field.Field data-invalid={fieldError('upgradeRank') !== ''}><Field.Label for="payment-product-rank">{$_('admin.configuration.payment.products.rank')}</Field.Label><Input id="payment-product-rank" bind:value={upgradeRank} inputmode="numeric" autocomplete="off" aria-invalid={fieldError('upgradeRank') !== ''} /><Field.Error>{fieldError('upgradeRank')}</Field.Error></Field.Field>
					<Field.Field data-invalid={fieldError('periodCreditsAmount') !== ''}><Field.Label for="payment-product-period-credits">{$_('admin.configuration.payment.products.periodCredits')}</Field.Label><Input id="payment-product-period-credits" bind:value={periodCreditsAmount} inputmode="decimal" autocomplete="off" aria-invalid={fieldError('periodCreditsAmount') !== ''} /><Field.Error>{fieldError('periodCreditsAmount')}</Field.Error></Field.Field>
				</div>
			{/if}
			<div class="grid gap-4 sm:grid-cols-2">
				<Field.Field><Field.Label for="payment-product-dodo">{$_('admin.configuration.payment.products.dodoId')}</Field.Label><Input id="payment-product-dodo" bind:value={dodoProductId} autocomplete="off" /></Field.Field>
				<Field.Field data-invalid={fieldError('providerProductId') !== ''}><Field.Label for="payment-product-creem">{$_('admin.configuration.payment.products.creemId')}</Field.Label><Input id="payment-product-creem" bind:value={creemProductId} autocomplete="off" aria-invalid={fieldError('providerProductId') !== ''} /><Field.Error>{fieldError('providerProductId')}</Field.Error></Field.Field>
			</div>
			<Sheet.Footer class="border-t px-0 pb-0">
				<Button type="button" variant="outline" onclick={() => (open = false)} disabled={saving}>{$_('admin.configuration.entity.cancel')}</Button>
				<Button type="submit" disabled={saving}>{saving ? $_('admin.configuration.saving') : $_('admin.configuration.save')}</Button>
			</Sheet.Footer>
		</form>
	</Sheet.Content>
</Sheet.Root>
