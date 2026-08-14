<script lang="ts">
	import type {
		ListRemotePaymentProductsResponse,
		PaymentProduct,
		PaymentProviderName,
		RemotePaymentProduct
	} from '$apiContract/configuration'
	import { ApiClientError, client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Badge } from '$frontend/ui/badge'
	import { Button } from '$frontend/ui/button'
	import * as Empty from '$frontend/ui/empty'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import * as Sheet from '$frontend/ui/sheet'
	import * as ToggleGroup from '$frontend/ui/toggle-group'
	import PackageIcon from '@lucide/svelte/icons/package'
	import Settings2Icon from '@lucide/svelte/icons/settings-2'
	import { validatePaymentProductForm } from './payment-products-page'

	export type ConfiguredPaymentProvider = {
		name: PaymentProviderName
		catalog: ListRemotePaymentProductsResponse
	}

	let {
		open = $bindable(false), product, providers, catalogs, onSaved, onRefresh
	}: {
		open?: boolean
		product: PaymentProduct | null
		providers: ConfiguredPaymentProvider[]
		catalogs: Partial<Record<PaymentProviderName, ListRemotePaymentProductsResponse>>
		onSaved: (product: PaymentProduct) => void
		onRefresh: () => Promise<void>
	} = $props()

	let provider: PaymentProviderName = $state('dodo')
	let selectedRemoteId: string = $state('')
	let creditsAmount: string = $state('')
	let subscriptionPlan: string = $state('')
	let upgradeRank: string = $state('')
	let periodCreditsAmount: string = $state('')
	let errors: Record<string, string> = $state({})
	let requestError: string = $state('')
	let conflict: boolean = $state(false)
	let saving: boolean = $state(false)
	let wasOpen: boolean = false
	let previousProvider: PaymentProviderName = 'dodo'
	const catalog: ListRemotePaymentProductsResponse | undefined = $derived(catalogs[provider])
	const selectedRemote: RemotePaymentProduct | undefined = $derived(
		catalog?.items.find((item: RemotePaymentProduct): boolean => item.provider_product_id === selectedRemoteId)
	)
	const type: 'one_time' | 'subscription' = $derived(product?.type ?? selectedRemote?.type ?? 'one_time')

	$effect((): void => {
		if (open && !wasOpen) resetForm()
		wasOpen = open
	})

	$effect((): void => {
		if (open && product === null && previousProvider !== provider) {
			selectedRemoteId = ''
			previousProvider = provider
		}
	})

	function resetForm(): void {
		provider = product?.provider ?? providers[0]?.name ?? 'dodo'
		previousProvider = provider
		selectedRemoteId = product?.provider_product_id ?? ''
		creditsAmount = product?.credits_amount ?? ''
		subscriptionPlan = product?.subscription_plan ?? ''
		upgradeRank = product?.upgrade_rank === null || product === null ? '' : String(product.upgrade_rank)
		periodCreditsAmount = product?.period_credits_amount ?? ''
		errors = {}
		requestError = ''
		conflict = false
	}

	async function saveProduct(event: SubmitEvent): Promise<void> {
		event.preventDefault()
		errors = validatePaymentProductForm({ type, creditsAmount, subscriptionPlan, upgradeRank, periodCreditsAmount })
		if (product === null && selectedRemote === undefined) errors['remoteProduct'] = $_('admin.paymentProducts.errors.remoteProduct')
		if (Object.keys(errors).length > 0) return
		saving = true
		requestError = ''
		conflict = false
		try {
			const entitlement = {
				credits_amount: type === 'one_time' ? creditsAmount.trim() : null,
				subscription_plan: type === 'subscription' ? subscriptionPlan.trim() : null,
				upgrade_rank: type === 'subscription' ? Number(upgradeRank) : null,
				period_credits_amount: type === 'subscription' ? periodCreditsAmount.trim() : null
			}
			const saved: PaymentProduct = product === null
				? await client.api.createPaymentProduct({ ...entitlement, provider, provider_product_id: selectedRemoteId })
				: await client.api.updatePaymentProduct({ ...entitlement, product_id: product.product_id, expected_version: product.version })
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

	function priceLabel(item: RemotePaymentProduct): string {
		return `${(item.price_amount / 100).toFixed(2)} ${item.currency}`
	}

	function currentRemoteProduct(): RemotePaymentProduct | undefined {
		return catalogs[product?.provider ?? provider]?.items.find((item: RemotePaymentProduct): boolean => {
			return item.provider_product_id === (product?.provider_product_id ?? selectedRemoteId)
		})
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content class="w-full overflow-y-auto sm:max-w-xl">
		<Sheet.Header class="border-b">
			<Sheet.Title>{product === null ? $_('admin.paymentProducts.create') : $_('admin.paymentProducts.edit')}</Sheet.Title>
			<Sheet.Description>{$_('admin.paymentProducts.editorDescription')}</Sheet.Description>
		</Sheet.Header>
		<form class="space-y-6 px-4 pb-4" onsubmit={saveProduct}>
			{#if requestError !== ''}<Alert.Root variant="destructive"><Alert.Description>{requestError}</Alert.Description>{#if conflict}<Alert.Action><Button type="button" variant="ghost" size="sm" onclick={refreshConflict}>{$_('admin.configuration.entity.refresh')}</Button></Alert.Action>{/if}</Alert.Root>{/if}

			<section class="space-y-4">
				<h3 class="text-sm font-medium">{$_('admin.paymentProducts.platformSection')}</h3>
				{#if product === null}
					{#if providers.length === 0}
						<Empty.Root class="min-h-48 border"><Empty.Media variant="icon"><PackageIcon /></Empty.Media><Empty.Header><Empty.Title>{$_('admin.paymentProducts.configureFirst')}</Empty.Title></Empty.Header><Empty.Content><Button href="../configuration/payment"><Settings2Icon />{$_('admin.paymentProducts.platformSettings')}</Button></Empty.Content></Empty.Root>
					{:else}
						<Field.Field><Field.Label>{$_('admin.paymentProducts.provider')}</Field.Label><ToggleGroup.Root type="single" bind:value={provider} variant="outline" spacing={0} class="max-w-sm">{#each providers as option}<ToggleGroup.Item value={option.name}>{providerLabel(option.name)} · {option.catalog.environment === 'test' ? $_('admin.paymentProducts.test') : $_('admin.paymentProducts.live')}</ToggleGroup.Item>{/each}</ToggleGroup.Root></Field.Field>
						<Field.Field data-invalid={fieldError('remoteProduct') !== ''}>
							<Field.Label>{$_('admin.paymentProducts.chooseRemoteProduct')}</Field.Label>
							{#if catalog === undefined || catalog.items.length === 0}
								<div class="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{$_('admin.paymentProducts.noRemoteProducts')}</div>
							{:else}
								<div class="divide-y rounded-md border">{#each catalog.items as item (item.provider_product_id)}<button type="button" class="flex w-full items-center justify-between gap-4 px-3 py-3 text-left hover:bg-muted/50" class:bg-muted={selectedRemoteId === item.provider_product_id} aria-pressed={selectedRemoteId === item.provider_product_id} onclick={() => (selectedRemoteId = item.provider_product_id)}><span class="min-w-0"><span class="block font-medium">{item.name}</span><span class="block truncate text-xs text-muted-foreground">{item.description ?? item.provider_product_id}</span></span><span class="shrink-0 text-right text-sm"><span class="block font-medium">{priceLabel(item)}</span><span class="block text-xs text-muted-foreground">{$_(`admin.paymentProducts.types.${item.type}`)}</span></span></button>{/each}</div>
							{/if}
							<Field.Error>{fieldError('remoteProduct')}</Field.Error>
						</Field.Field>
					{/if}
				{:else}
					<div class="grid gap-3 rounded-md border p-3 sm:grid-cols-2"><div><div class="text-xs text-muted-foreground">{$_('admin.paymentProducts.provider')}</div><div class="font-medium">{providerLabel(product.provider)} <Badge variant="outline">{product.test_mode ? $_('admin.paymentProducts.test') : $_('admin.paymentProducts.live')}</Badge></div></div><div><div class="text-xs text-muted-foreground">{$_('admin.paymentProducts.remoteProduct')}</div><div class="font-medium">{currentRemoteProduct()?.name ?? product.provider_product_id}</div></div></div>
				{/if}
			</section>

			{#if product !== null || selectedRemote !== undefined}
				<section class="space-y-4 border-t pt-5">
					<div><h3 class="text-sm font-medium">{$_('admin.paymentProducts.deliverySection')}</h3><p class="mt-1 text-sm text-muted-foreground">{$_(`admin.paymentProducts.deliveryDescription.${type}`)}</p></div>
					{#if type === 'one_time'}
						<Field.Field class="max-w-sm" data-invalid={fieldError('creditsAmount') !== ''}><Field.Label for="payment-product-credits">{$_('admin.paymentProducts.credits')}</Field.Label><Input id="payment-product-credits" bind:value={creditsAmount} inputmode="decimal" autocomplete="off" aria-invalid={fieldError('creditsAmount') !== ''} /><Field.Error>{fieldError('creditsAmount')}</Field.Error></Field.Field>
					{:else}
						<div class="grid gap-4 sm:grid-cols-2"><Field.Field data-invalid={fieldError('subscriptionPlan') !== ''}><Field.Label for="payment-product-plan">{$_('admin.paymentProducts.plan')}</Field.Label><Input id="payment-product-plan" bind:value={subscriptionPlan} autocomplete="off" aria-invalid={fieldError('subscriptionPlan') !== ''} /><Field.Error>{fieldError('subscriptionPlan')}</Field.Error></Field.Field><Field.Field data-invalid={fieldError('upgradeRank') !== ''}><Field.Label for="payment-product-rank">{$_('admin.paymentProducts.rank')}</Field.Label><Input id="payment-product-rank" bind:value={upgradeRank} inputmode="numeric" autocomplete="off" aria-invalid={fieldError('upgradeRank') !== ''} /><Field.Error>{fieldError('upgradeRank')}</Field.Error></Field.Field></div>
						<Field.Field class="max-w-sm" data-invalid={fieldError('periodCreditsAmount') !== ''}><Field.Label for="payment-product-period-credits">{$_('admin.paymentProducts.periodCredits')}</Field.Label><Input id="payment-product-period-credits" bind:value={periodCreditsAmount} inputmode="decimal" autocomplete="off" aria-invalid={fieldError('periodCreditsAmount') !== ''} /><Field.Error>{fieldError('periodCreditsAmount')}</Field.Error></Field.Field>
					{/if}
				</section>
			{/if}

			<Sheet.Footer class="border-t px-0 pb-0"><Button type="button" variant="outline" onclick={() => (open = false)} disabled={saving}>{$_('admin.configuration.entity.cancel')}</Button><Button type="submit" disabled={saving || (product === null && selectedRemote === undefined)}>{saving ? $_('admin.configuration.saving') : $_('admin.paymentProducts.confirmLink')}</Button></Sheet.Footer>
		</form>
	</Sheet.Content>
</Sheet.Root>
