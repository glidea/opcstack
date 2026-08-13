<script lang="ts">
	import type { PaymentProduct, PaymentProviderName } from '$apiContract/configuration'
	import { ApiClientError, client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Badge } from '$frontend/ui/badge'
	import { Button } from '$frontend/ui/button'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import * as Sheet from '$frontend/ui/sheet'
	import * as ToggleGroup from '$frontend/ui/toggle-group'
	import { validatePaymentProductForm } from './payment-products-page'

	export type ConfiguredPaymentProvider = {
		name: PaymentProviderName
		testMode: boolean
	}

	let {
		open = $bindable(false), product, providers, onSaved, onRefresh
	}: {
		open?: boolean
		product: PaymentProduct | null
		providers: ConfiguredPaymentProvider[]
		onSaved: (product: PaymentProduct) => void
		onRefresh: () => Promise<void>
	} = $props()

	let productId: string = $state('')
	let provider: PaymentProviderName = $state('dodo')
	let type: 'one_time' | 'subscription' = $state('one_time')
	let creditsAmount: string = $state('')
	let subscriptionPlan: string = $state('')
	let upgradeRank: string = $state('')
	let periodCreditsAmount: string = $state('')
	let providerProductId: string = $state('')
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
		provider = product?.provider ?? providers[0]?.name ?? 'dodo'
		type = product?.type ?? 'one_time'
		creditsAmount = product?.credits_amount ?? ''
		subscriptionPlan = product?.subscription_plan ?? ''
		upgradeRank = product?.upgrade_rank === null || product === null ? '' : String(product.upgrade_rank)
		periodCreditsAmount = product?.period_credits_amount ?? ''
		providerProductId = product?.provider_product_id ?? ''
		errors = {}
		requestError = ''
		conflict = false
	}

	async function saveProduct(event: SubmitEvent): Promise<void> {
		event.preventDefault()
		errors = validatePaymentProductForm({ productId, type, creditsAmount, subscriptionPlan, upgradeRank, periodCreditsAmount, providerProductId })
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
				provider_product_id: providerProductId.trim()
			}
			const saved: PaymentProduct = product === null
				? await client.api.createPaymentProduct({ ...fields, provider })
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

	function providerLabel(name: PaymentProviderName): string {
		return name === 'dodo' ? 'Dodo Payments' : 'Creem'
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content class="w-full overflow-y-auto sm:max-w-xl">
		<Sheet.Header class="border-b">
			<Sheet.Title>{product === null ? $_('admin.paymentProducts.create') : $_('admin.paymentProducts.edit')}</Sheet.Title>
			<Sheet.Description>{$_('admin.paymentProducts.editorDescription')}</Sheet.Description>
		</Sheet.Header>
		<form class="space-y-6 px-4 pb-4" onsubmit={saveProduct}>
			{#if requestError !== ''}
				<Alert.Root variant="destructive"><Alert.Description>{requestError}</Alert.Description>{#if conflict}<Alert.Action><Button type="button" variant="ghost" size="sm" onclick={refreshConflict}>{$_('admin.configuration.entity.refresh')}</Button></Alert.Action>{/if}</Alert.Root>
			{/if}

			<section class="space-y-4">
				<h3 class="text-sm font-medium">{$_('admin.paymentProducts.platformSection')}</h3>
				{#if product === null}
					<Field.Field>
						<Field.Label>{$_('admin.paymentProducts.provider')}</Field.Label>
						<ToggleGroup.Root type="single" bind:value={provider} variant="outline" spacing={0} class="w-full">
							{#each providers as option}
								<ToggleGroup.Item value={option.name} class="flex-1" aria-label={providerLabel(option.name)}>{providerLabel(option.name)} · {option.testMode ? $_('admin.paymentProducts.test') : $_('admin.paymentProducts.live')}</ToggleGroup.Item>
							{/each}
						</ToggleGroup.Root>
					</Field.Field>
				{:else}
					<div class="flex items-center justify-between border-y py-3">
						<span class="text-sm font-medium">{providerLabel(product.provider)}</span>
						<Badge variant="outline">{product.test_mode ? $_('admin.paymentProducts.test') : $_('admin.paymentProducts.live')}</Badge>
					</div>
				{/if}
				<Field.Field data-invalid={fieldError('providerProductId') !== ''}>
					<Field.Label for="provider-product-id">{$_('admin.paymentProducts.providerProductId')}</Field.Label>
					<Input id="provider-product-id" bind:value={providerProductId} autocomplete="off" aria-invalid={fieldError('providerProductId') !== ''} />
					<Field.Description>{$_('admin.paymentProducts.providerProductIdDescription')}</Field.Description>
					<Field.Error>{fieldError('providerProductId')}</Field.Error>
				</Field.Field>
			</section>

			<section class="space-y-4 border-t pt-5">
				<h3 class="text-sm font-medium">{$_('admin.paymentProducts.deliverySection')}</h3>
				<Field.Field data-invalid={fieldError('productId') !== ''}>
					<Field.Label for="payment-product-id">{$_('admin.paymentProducts.id')}</Field.Label>
					<Input id="payment-product-id" bind:value={productId} disabled={product !== null} autocomplete="off" aria-invalid={fieldError('productId') !== ''} />
					<Field.Error>{fieldError('productId')}</Field.Error>
				</Field.Field>
				<Field.Field>
					<Field.Label>{$_('admin.paymentProducts.type')}</Field.Label>
					<ToggleGroup.Root type="single" bind:value={type} variant="outline" spacing={0} class="w-full">
						<ToggleGroup.Item value="one_time" class="flex-1">{$_('admin.paymentProducts.types.one_time')}</ToggleGroup.Item>
						<ToggleGroup.Item value="subscription" class="flex-1">{$_('admin.paymentProducts.types.subscription')}</ToggleGroup.Item>
					</ToggleGroup.Root>
				</Field.Field>
				{#if type === 'one_time'}
					<Field.Field data-invalid={fieldError('creditsAmount') !== ''}><Field.Label for="payment-product-credits">{$_('admin.paymentProducts.credits')}</Field.Label><Input id="payment-product-credits" bind:value={creditsAmount} inputmode="decimal" autocomplete="off" aria-invalid={fieldError('creditsAmount') !== ''} /><Field.Error>{fieldError('creditsAmount')}</Field.Error></Field.Field>
				{:else}
					<div class="grid gap-4 sm:grid-cols-2">
						<Field.Field data-invalid={fieldError('subscriptionPlan') !== ''}><Field.Label for="payment-product-plan">{$_('admin.paymentProducts.plan')}</Field.Label><Input id="payment-product-plan" bind:value={subscriptionPlan} autocomplete="off" aria-invalid={fieldError('subscriptionPlan') !== ''} /><Field.Error>{fieldError('subscriptionPlan')}</Field.Error></Field.Field>
						<Field.Field data-invalid={fieldError('upgradeRank') !== ''}><Field.Label for="payment-product-rank">{$_('admin.paymentProducts.rank')}</Field.Label><Input id="payment-product-rank" bind:value={upgradeRank} inputmode="numeric" autocomplete="off" aria-invalid={fieldError('upgradeRank') !== ''} /><Field.Error>{fieldError('upgradeRank')}</Field.Error></Field.Field>
					</div>
					<Field.Field data-invalid={fieldError('periodCreditsAmount') !== ''}><Field.Label for="payment-product-period-credits">{$_('admin.paymentProducts.periodCredits')}</Field.Label><Input id="payment-product-period-credits" bind:value={periodCreditsAmount} inputmode="decimal" autocomplete="off" aria-invalid={fieldError('periodCreditsAmount') !== ''} /><Field.Error>{fieldError('periodCreditsAmount')}</Field.Error></Field.Field>
				{/if}
			</section>

			<Sheet.Footer class="border-t px-0 pb-0"><Button type="button" variant="outline" onclick={() => (open = false)} disabled={saving}>{$_('admin.configuration.entity.cancel')}</Button><Button type="submit" disabled={saving}>{saving ? $_('admin.configuration.saving') : $_('admin.configuration.save')}</Button></Sheet.Footer>
		</form>
	</Sheet.Content>
</Sheet.Root>
