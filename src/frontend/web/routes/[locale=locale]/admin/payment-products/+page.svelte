<script lang="ts">
	import { onMount } from 'svelte'
	import type { PaymentConfig, PaymentProduct, PaymentProviderName } from '$apiContract/configuration'
	import { ApiClientError, client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import * as AlertDialog from '$frontend/ui/alert-dialog'
	import { Badge } from '$frontend/ui/badge'
	import { Button } from '$frontend/ui/button'
	import * as Empty from '$frontend/ui/empty'
	import { Skeleton } from '$frontend/ui/skeleton'
	import * as Table from '$frontend/ui/table'
	import * as ToggleGroup from '$frontend/ui/toggle-group'
	import PackageIcon from '@lucide/svelte/icons/package'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import Settings2Icon from '@lucide/svelte/icons/settings-2'
	import TrashIcon from '@lucide/svelte/icons/trash-2'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import PaymentProductSheet, { type ConfiguredPaymentProvider } from './PaymentProductSheet.svelte'
	import { removePaymentProduct, replacePaymentProduct } from './payment-products-page'

	let { data }: { data: { locale: string } } = $props()
	let config: PaymentConfig | null = $state(null)
	let products: PaymentProduct[] = $state([])
	let activeProvider: PaymentProviderName = $state('dodo')
	let error: string = $state('')
	let editorOpen: boolean = $state(false)
	let selectedProduct: PaymentProduct | null = $state(null)
	let deleteTarget: PaymentProduct | null = $state(null)
	let deleting: boolean = $state(false)
	const configuredProviders: ConfiguredPaymentProvider[] = $derived.by((): ConfiguredPaymentProvider[] => {
		if (config === null) return []
		const result: ConfiguredPaymentProvider[] = []
		if (config.dodo.api_key_configured && config.dodo.webhook_secret_configured) result.push({ name: 'dodo', testMode: config.dodo.test_mode })
		if (config.creem.api_key_configured && config.creem.webhook_secret_configured) result.push({ name: 'creem', testMode: config.creem.test_mode })
		return result
	})
	const visibleProducts: PaymentProduct[] = $derived(products.filter((product: PaymentProduct): boolean => product.provider === activeProvider))

	onMount((): void => { void loadConfig() })

	async function loadConfig(): Promise<void> {
		error = ''
		try {
			const loaded: PaymentConfig = await client.api.getPaymentConfig()
			config = loaded
			products = loaded.products
			if (!loaded.products.some((product: PaymentProduct): boolean => product.provider === activeProvider)) {
				activeProvider = configuredProviders[0]?.name ?? loaded.products[0]?.provider ?? 'dodo'
			}
		} catch (loadError) {
			error = loadError instanceof ApiClientError ? loadError.body.message : $_('admin.paymentProducts.loadError')
		}
	}

	function openCreate(): void {
		selectedProduct = null
		editorOpen = true
	}

	function openEdit(product: PaymentProduct): void {
		selectedProduct = product
		editorOpen = true
	}

	function handleSaved(product: PaymentProduct): void {
		products = replacePaymentProduct(products, product)
		activeProvider = product.provider
	}

	async function deleteProduct(): Promise<void> {
		if (deleteTarget === null) return
		deleting = true
		error = ''
		try {
			await client.api.deletePaymentProduct({ product_id: deleteTarget.product_id, expected_version: deleteTarget.version })
			products = removePaymentProduct(products, deleteTarget.product_id)
			deleteTarget = null
		} catch (deleteError) {
			error = deleteError instanceof ApiClientError ? deleteError.body.message : $_('admin.configuration.entity.deleteError')
		} finally {
			deleting = false
		}
	}

	function providerLabel(provider: PaymentProviderName): string {
		return provider === 'dodo' ? 'Dodo Payments' : 'Creem'
	}

	function currentTestMode(provider: PaymentProviderName): boolean | null {
		if (config === null) return null
		return provider === 'dodo' ? config.dodo.test_mode : config.creem.test_mode
	}
</script>

<main class="admin-page">
	<header class="admin-page-header">
		<h1>{$_('admin.paymentProducts.title')}</h1>
		<div class="admin-page-actions">
			<Button variant="outline" href={`/${data.locale}/admin/configuration/payment`}><Settings2Icon />{$_('admin.paymentProducts.platformSettings')}</Button>
			<Button onclick={openCreate} disabled={configuredProviders.length === 0} title={configuredProviders.length === 0 ? $_('admin.paymentProducts.configureFirst') : $_('admin.paymentProducts.create')}><PlusIcon />{$_('admin.paymentProducts.create')}</Button>
		</div>
	</header>

	{#if error !== ''}<Alert.Root variant="destructive"><TriangleAlertIcon /><Alert.Title>{$_('admin.paymentProducts.loadError')}</Alert.Title><Alert.Description>{error}</Alert.Description><Alert.Action><Button variant="ghost" size="sm" onclick={loadConfig}>{$_('admin.paymentProducts.retry')}</Button></Alert.Action></Alert.Root>{/if}

	{#if config === null && error === ''}
		<Skeleton class="h-80 w-full" />
	{:else if config !== null}
		<div class="admin-filter-bar flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<ToggleGroup.Root type="single" bind:value={activeProvider} variant="outline" spacing={0} aria-label={$_('admin.paymentProducts.provider')}>
				<ToggleGroup.Item value="dodo">Dodo Payments <span class="text-muted-foreground">{products.filter((product: PaymentProduct): boolean => product.provider === 'dodo').length}</span></ToggleGroup.Item>
				<ToggleGroup.Item value="creem">Creem <span class="text-muted-foreground">{products.filter((product: PaymentProduct): boolean => product.provider === 'creem').length}</span></ToggleGroup.Item>
			</ToggleGroup.Root>
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<span>{providerLabel(activeProvider)}</span>
				<Badge variant="outline">{currentTestMode(activeProvider) ? $_('admin.paymentProducts.test') : $_('admin.paymentProducts.live')}</Badge>
			</div>
		</div>

		{#if visibleProducts.length === 0}
			<Empty.Root class="min-h-72 border"><Empty.Media variant="icon"><PackageIcon /></Empty.Media><Empty.Header><Empty.Title>{$_('admin.paymentProducts.empty')}</Empty.Title><Empty.Description>{$_('admin.paymentProducts.emptyDescription', { values: { provider: providerLabel(activeProvider) } })}</Empty.Description></Empty.Header>{#if configuredProviders.some((provider: ConfiguredPaymentProvider): boolean => provider.name === activeProvider)}<Empty.Content><Button onclick={openCreate}><PlusIcon />{$_('admin.paymentProducts.create')}</Button></Empty.Content>{/if}</Empty.Root>
		{:else}
			<div class="admin-table-panel">
				<Table.Root class="min-w-[760px]"><Table.Header><Table.Row><Table.Head>{$_('admin.paymentProducts.product')}</Table.Head><Table.Head>{$_('admin.paymentProducts.providerProductId')}</Table.Head><Table.Head>{$_('admin.paymentProducts.type')}</Table.Head><Table.Head>{$_('admin.paymentProducts.delivery')}</Table.Head><Table.Head>{$_('admin.paymentProducts.environment')}</Table.Head><Table.Head class="text-right">{$_('admin.configuration.entity.actions')}</Table.Head></Table.Row></Table.Header><Table.Body>
					{#each visibleProducts as product (product.product_id)}
						<Table.Row><Table.Cell><span class="font-medium">{product.product_id}</span></Table.Cell><Table.Cell class="font-mono text-xs">{product.provider_product_id}</Table.Cell><Table.Cell>{$_(`admin.paymentProducts.types.${product.type}`)}</Table.Cell><Table.Cell>{product.type === 'one_time' ? product.credits_amount : `${product.subscription_plan} · ${product.period_credits_amount}`}</Table.Cell><Table.Cell><Badge variant={currentTestMode(product.provider) === product.test_mode ? 'outline' : 'destructive'}>{product.test_mode ? $_('admin.paymentProducts.test') : $_('admin.paymentProducts.live')}</Badge></Table.Cell><Table.Cell><div class="flex justify-end gap-1"><Button size="icon-sm" variant="ghost" onclick={() => openEdit(product)} aria-label={$_('admin.configuration.entity.edit')} title={$_('admin.configuration.entity.edit')}><PencilIcon /></Button><Button size="icon-sm" variant="ghost" onclick={() => (deleteTarget = product)} aria-label={$_('admin.configuration.entity.delete')} title={$_('admin.configuration.entity.delete')}><TrashIcon /></Button></div></Table.Cell></Table.Row>
					{/each}
				</Table.Body></Table.Root>
			</div>
		{/if}
	{/if}
</main>

<PaymentProductSheet bind:open={editorOpen} product={selectedProduct} providers={configuredProviders} onSaved={handleSaved} onRefresh={loadConfig} />
<AlertDialog.Root open={deleteTarget !== null} onOpenChange={(open: boolean): void => { if (!open && !deleting) deleteTarget = null }}><AlertDialog.Content><AlertDialog.Header><AlertDialog.Title>{$_('admin.paymentProducts.deleteTitle')}</AlertDialog.Title><AlertDialog.Description>{$_('admin.paymentProducts.deleteDescription', { values: { id: deleteTarget?.product_id ?? '' } })}</AlertDialog.Description></AlertDialog.Header><AlertDialog.Footer><AlertDialog.Cancel disabled={deleting}>{$_('admin.configuration.entity.cancel')}</AlertDialog.Cancel><AlertDialog.Action variant="destructive" disabled={deleting} onclick={deleteProduct}>{deleting ? $_('admin.configuration.entity.deleting') : $_('admin.configuration.entity.delete')}</AlertDialog.Action></AlertDialog.Footer></AlertDialog.Content></AlertDialog.Root>
