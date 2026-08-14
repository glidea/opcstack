<script lang="ts">
	import { onMount } from 'svelte'
	import type {
		ListRemotePaymentProductsResponse,
		PaymentConfig,
		PaymentProduct,
		PaymentProviderName,
		RemotePaymentProduct
	} from '$apiContract/configuration'
	import { ApiClientError, client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import * as AlertDialog from '$frontend/ui/alert-dialog'
	import { Badge } from '$frontend/ui/badge'
	import { Button } from '$frontend/ui/button'
	import * as Empty from '$frontend/ui/empty'
	import { Skeleton } from '$frontend/ui/skeleton'
	import * as Table from '$frontend/ui/table'
	import PackageIcon from '@lucide/svelte/icons/package'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
	import Settings2Icon from '@lucide/svelte/icons/settings-2'
	import TrashIcon from '@lucide/svelte/icons/trash-2'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import PaymentProductSheet, { type ConfiguredPaymentProvider } from './PaymentProductSheet.svelte'
	import {
		findRemotePaymentProduct,
		removePaymentProduct,
		replacePaymentProduct
	} from './payment-products-page'

	let { data }: { data: { locale: string } } = $props()
	let config: PaymentConfig | null = $state(null)
	let products: PaymentProduct[] = $state([])
	let catalogs: Partial<Record<PaymentProviderName, ListRemotePaymentProductsResponse>> = $state({})
	let error: string = $state('')
	let refreshing: boolean = $state(false)
	let editorOpen: boolean = $state(false)
	let selectedProduct: PaymentProduct | null = $state(null)
	let deleteTarget: PaymentProduct | null = $state(null)
	let deleting: boolean = $state(false)
	const configuredProviders: ConfiguredPaymentProvider[] = $derived.by((): ConfiguredPaymentProvider[] => {
		if (config === null) return []
		const result: ConfiguredPaymentProvider[] = []
		if (config.dodo.api_key_configured && config.dodo.webhook_secret_configured && catalogs.dodo !== undefined) {
			result.push({ name: 'dodo', catalog: catalogs.dodo })
		}
		if (config.creem.api_key_configured && config.creem.webhook_secret_configured && catalogs.creem !== undefined) {
			result.push({ name: 'creem', catalog: catalogs.creem })
		}
		return result
	})

	onMount((): void => { void loadConfig() })

	async function loadConfig(): Promise<void> {
		error = ''
		try {
			const loaded: PaymentConfig = await client.api.getPaymentConfig()
			config = loaded
			products = loaded.products
			await loadCatalogs(loaded)
		} catch (loadError) {
			error = loadError instanceof ApiClientError ? loadError.body.message : $_('admin.paymentProducts.loadError')
		}
	}

	async function loadCatalogs(paymentConfig: PaymentConfig): Promise<void> {
		const providers: PaymentProviderName[] = []
		if (paymentConfig.dodo.api_key_configured && paymentConfig.dodo.webhook_secret_configured) providers.push('dodo')
		if (paymentConfig.creem.api_key_configured && paymentConfig.creem.webhook_secret_configured) providers.push('creem')
		const entries: Array<[PaymentProviderName, ListRemotePaymentProductsResponse]> = await Promise.all(
			providers.map(async (provider: PaymentProviderName): Promise<[PaymentProviderName, ListRemotePaymentProductsResponse]> => {
				return [provider, await client.api.listRemotePaymentProducts({ provider })]
			})
		)
		catalogs = Object.fromEntries(entries) as Partial<Record<PaymentProviderName, ListRemotePaymentProductsResponse>>
	}

	async function refreshCatalogs(): Promise<void> {
		if (config === null) return
		refreshing = true
		error = ''
		try {
			await loadCatalogs(config)
		} catch (refreshError) {
			error = refreshError instanceof ApiClientError ? refreshError.body.message : $_('admin.paymentProducts.loadError')
		} finally {
			refreshing = false
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

	function remoteProduct(product: PaymentProduct): RemotePaymentProduct | undefined {
		return findRemotePaymentProduct(product, catalogs[product.provider])
	}

	function productLabel(product: PaymentProduct): string {
		return remoteProduct(product)?.name ?? product.provider_product_id
	}

	function priceLabel(product: PaymentProduct): string {
		const remote: RemotePaymentProduct | undefined = remoteProduct(product)
		return remote === undefined ? '—' : `${(remote.price_amount / 100).toFixed(2)} ${remote.currency}`
	}

	function entitlementLabel(product: PaymentProduct): string {
		if (product.type === 'one_time') return `${product.credits_amount ?? '0'} ${$_('admin.paymentProducts.credits')}`
		return `${product.subscription_plan ?? ''} · ${product.period_credits_amount ?? '0'} ${$_('admin.paymentProducts.credits')}`
	}
</script>

<main class="admin-page">
	<header class="admin-page-header">
		<h1>{$_('admin.paymentProducts.title')}</h1>
		<div class="admin-page-actions">
			<Button onclick={openCreate} disabled={configuredProviders.length === 0} title={configuredProviders.length === 0 ? $_('admin.paymentProducts.configureFirst') : $_('admin.paymentProducts.create')}><PlusIcon />{$_('admin.paymentProducts.create')}</Button>
		</div>
	</header>

	{#if error !== ''}<Alert.Root variant="destructive"><TriangleAlertIcon /><Alert.Title>{$_('admin.paymentProducts.loadError')}</Alert.Title><Alert.Description>{error}</Alert.Description><Alert.Action><Button variant="ghost" size="sm" onclick={loadConfig}>{$_('admin.paymentProducts.retry')}</Button></Alert.Action></Alert.Root>{/if}
	<div class="admin-filter-bar flex flex-wrap items-center justify-between gap-3">
		<div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{#each configuredProviders as item}<span>{providerLabel(item.name)} · {item.catalog.environment === 'test' ? $_('admin.paymentProducts.test') : $_('admin.paymentProducts.live')}</span>{/each}</div>
		<div class="flex gap-2"><Button variant="outline" href={`/${data.locale}/admin/configuration/payment`}><Settings2Icon />{$_('admin.paymentProducts.platformSettings')}</Button><Button variant="outline" onclick={refreshCatalogs} disabled={refreshing || config === null}><RefreshCwIcon class={refreshing ? 'animate-spin' : ''} />{$_('admin.paymentProducts.refresh')}</Button></div>
	</div>

	{#if config === null && error === ''}
		<Skeleton class="h-80 w-full" />
	{:else if products.length === 0}
		<Empty.Root class="min-h-72 border"><Empty.Media variant="icon"><PackageIcon /></Empty.Media><Empty.Header><Empty.Title>{$_('admin.paymentProducts.empty')}</Empty.Title><Empty.Description>{configuredProviders.length === 0 ? $_('admin.paymentProducts.configureFirst') : $_('admin.paymentProducts.emptyDescription')}</Empty.Description></Empty.Header><Empty.Content><div class="flex flex-wrap justify-center gap-2"><Button variant="outline" onclick={refreshCatalogs}><RefreshCwIcon />{$_('admin.paymentProducts.refresh')}</Button>{#if configuredProviders.length === 0}<Button href={`/${data.locale}/admin/configuration/payment`}><Settings2Icon />{$_('admin.paymentProducts.platformSettings')}</Button>{:else}<Button onclick={openCreate}><PlusIcon />{$_('admin.paymentProducts.create')}</Button>{/if}</div></Empty.Content></Empty.Root>
	{:else}
		<div class="admin-table-panel">
			<Table.Root class="min-w-[900px]"><Table.Header><Table.Row><Table.Head>{$_('admin.paymentProducts.provider')}</Table.Head><Table.Head>{$_('admin.paymentProducts.environment')}</Table.Head><Table.Head>{$_('admin.paymentProducts.remoteProduct')}</Table.Head><Table.Head>{$_('admin.paymentProducts.price')}</Table.Head><Table.Head>{$_('admin.paymentProducts.delivery')}</Table.Head><Table.Head>{$_('admin.paymentProducts.status')}</Table.Head><Table.Head class="text-right">{$_('admin.configuration.entity.actions')}</Table.Head></Table.Row></Table.Header><Table.Body>
				{#each products as product (product.product_id)}
					<Table.Row><Table.Cell class="font-medium">{providerLabel(product.provider)}</Table.Cell><Table.Cell>{product.test_mode ? $_('admin.paymentProducts.test') : $_('admin.paymentProducts.live')}</Table.Cell><Table.Cell><div class="font-medium">{productLabel(product)}</div><div class="font-mono text-xs text-muted-foreground">{product.provider_product_id}</div></Table.Cell><Table.Cell>{priceLabel(product)}</Table.Cell><Table.Cell>{entitlementLabel(product)}</Table.Cell><Table.Cell><Badge variant={remoteProduct(product) === undefined ? 'destructive' : 'outline'}>{remoteProduct(product) === undefined ? $_('admin.paymentProducts.unavailable') : $_('admin.paymentProducts.available')}</Badge></Table.Cell><Table.Cell><div class="flex justify-end gap-1"><Button size="icon-sm" variant="ghost" onclick={() => openEdit(product)} aria-label={$_('admin.configuration.entity.edit')} title={$_('admin.configuration.entity.edit')}><PencilIcon /></Button><Button size="icon-sm" variant="ghost" onclick={() => (deleteTarget = product)} aria-label={$_('admin.configuration.entity.delete')} title={$_('admin.configuration.entity.delete')}><TrashIcon /></Button></div></Table.Cell></Table.Row>
				{/each}
			</Table.Body></Table.Root>
		</div>
	{/if}
</main>

<PaymentProductSheet bind:open={editorOpen} product={selectedProduct} providers={configuredProviders} catalogs={catalogs} onSaved={handleSaved} onRefresh={loadConfig} />
<AlertDialog.Root open={deleteTarget !== null} onOpenChange={(open: boolean): void => { if (!open && !deleting) deleteTarget = null }}><AlertDialog.Content><AlertDialog.Header><AlertDialog.Title>{$_('admin.paymentProducts.deleteTitle')}</AlertDialog.Title><AlertDialog.Description>{$_('admin.paymentProducts.deleteDescription', { values: { id: deleteTarget === null ? '' : productLabel(deleteTarget) } })}</AlertDialog.Description></AlertDialog.Header><AlertDialog.Footer><AlertDialog.Cancel disabled={deleting}>{$_('admin.configuration.entity.cancel')}</AlertDialog.Cancel><AlertDialog.Action variant="destructive" disabled={deleting} onclick={deleteProduct}>{deleting ? $_('admin.configuration.entity.deleting') : $_('admin.configuration.entity.delete')}</AlertDialog.Action></AlertDialog.Footer></AlertDialog.Content></AlertDialog.Root>
