<script lang="ts">
	import type { AIProvider, AIProviderType } from '$apiContract/configuration'
	import { ApiClientError, client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Button } from '$frontend/ui/button'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import * as Select from '$frontend/ui/select'
	import * as Sheet from '$frontend/ui/sheet'
	import { Switch } from '$frontend/ui/switch'
	import TagInput from '../configuration/TagInput.svelte'
	import { resolveConfigurationSaveError } from '../configuration/configuration-page'
	import { isAIProviderCustomEndpoint, validateAIProviderForm } from './ai-providers-page'

	const providerTypes: AIProviderType[] = [
		'chat_openai', 'image_gemini', 'image_openai', 'image_seedream', 'image_aliyun',
		'tts_gemini', 'tts_seed', 'realtime_doubao', 'video_seedance'
	]

	let {
		open = $bindable(false), provider, onSaved, onRefresh
	}: {
		open?: boolean
		provider: AIProvider | null
		onSaved: (provider: AIProvider) => void
		onRefresh: () => Promise<void>
	} = $props()

	let providerType: AIProviderType = $state('image_gemini')
	let name: string = $state('')
	let baseUrl: string = $state('')
	let models: string[] = $state([])
	let priceMultiplier: string = $state('1')
	let enabled: boolean = $state(true)
	let apiKeyAction: 'keep' | 'replace' = $state('replace')
	let apiKeyValue: string = $state('')
	let errors: Record<string, string> = $state({})
	let requestError: string = $state('')
	let conflict: boolean = $state(false)
	let saving: boolean = $state(false)
	let wasOpen: boolean = false
	let lastProviderType: AIProviderType = 'image_gemini'
	const customEndpoint: boolean = $derived(isAIProviderCustomEndpoint(providerType))

	$effect((): void => {
		if (open && !wasOpen) resetForm()
		wasOpen = open
	})

	$effect((): void => {
		if (!open || providerType === lastProviderType) return
		const oldDefaultName: string = $_(`admin.aiProviders.defaultNames.${lastProviderType}`)
		if (name.trim() === '' || name === oldDefaultName) {
			name = $_(`admin.aiProviders.defaultNames.${providerType}`)
		}
		baseUrl = ''
		lastProviderType = providerType
	})

	function resetForm(): void {
		providerType = provider?.type ?? 'image_gemini'
		lastProviderType = providerType
		name = provider?.name ?? $_(`admin.aiProviders.defaultNames.${providerType}`)
		baseUrl = provider?.base_url ?? ''
		models = provider?.models ?? []
		priceMultiplier = provider === null ? '1' : String(provider.price_multiplier)
		enabled = provider?.enabled ?? true
		apiKeyAction = provider === null ? 'replace' : 'keep'
		apiKeyValue = ''
		errors = {}
		requestError = ''
		conflict = false
	}

	async function saveProvider(event: SubmitEvent): Promise<void> {
		event.preventDefault()
		errors = validateAIProviderForm({ editing: provider !== null, type: providerType, name, baseUrl, models, priceMultiplier, apiKeyAction, apiKeyValue })
		if (Object.keys(errors).length > 0) return
		saving = true
		requestError = ''
		conflict = false
		try {
			const fields = {
				name: name.trim(), type: providerType, base_url: customEndpoint ? baseUrl.trim() : null,
				models,
				price_multiplier: Number(priceMultiplier), enabled
			}
			const saved: AIProvider = provider === null
				? await client.api.createAIProvider({ ...fields, api_key: apiKeyValue })
				: await client.api.updateAIProvider({
					...fields,
					id: provider.id,
					api_key: apiKeyAction === 'keep' ? { action: 'keep' } : { action: 'replace', value: apiKeyValue },
					expected_version: provider.version
				})
			onSaved(saved)
			open = false
		} catch (saveError) {
			conflict = saveError instanceof ApiClientError && saveError.body.code === 'CONFIG_CONFLICT'
			requestError = resolveConfigurationSaveError(saveError, $_('admin.configuration.conflict'), $_('admin.configuration.entity.saveError'))
		} finally {
			saving = false
		}
	}

	async function refreshConflict(): Promise<void> {
		await onRefresh()
		open = false
	}

	function fieldError(field: string): string {
		return errors[field] ?? ''
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content class="w-full overflow-y-auto sm:max-w-xl">
		<Sheet.Header class="border-b">
			<Sheet.Title>{provider === null ? $_('admin.aiProviders.create') : $_('admin.aiProviders.edit')}</Sheet.Title>
			<Sheet.Description>{$_('admin.aiProviders.editorDescription')}</Sheet.Description>
		</Sheet.Header>
		<form class="space-y-5 px-4 pb-4" onsubmit={saveProvider}>
			{#if requestError !== ''}<Alert.Root variant="destructive"><Alert.Description>{requestError}</Alert.Description>{#if conflict}<Alert.Action><Button type="button" variant="ghost" size="sm" onclick={refreshConflict}>{$_('admin.configuration.entity.refresh')}</Button></Alert.Action>{/if}</Alert.Root>{/if}
			<Field.Field data-invalid={fieldError('type') !== ''}>
				<Field.Label for="ai-provider-type">{$_('admin.aiProviders.type')}</Field.Label>
				<Select.Root type="single" bind:value={providerType}><Select.Trigger id="ai-provider-type" class="w-full" aria-invalid={fieldError('type') !== ''}>{$_(`admin.aiProviders.types.${providerType}`)}</Select.Trigger><Select.Content>{#each providerTypes as option}<Select.Item value={option}>{$_(`admin.aiProviders.types.${option}`)}</Select.Item>{/each}</Select.Content></Select.Root>
				<Field.Description>{$_('admin.aiProviders.typeDescription')}</Field.Description>
				<Field.Error>{fieldError('type')}</Field.Error>
			</Field.Field>
			<Field.Field data-invalid={fieldError('name') !== ''}><Field.Label for="ai-provider-name">{$_('admin.aiProviders.name')}</Field.Label><Input id="ai-provider-name" bind:value={name} autocomplete="off" aria-invalid={fieldError('name') !== ''} /><Field.Description>{$_('admin.aiProviders.nameDescription')}</Field.Description><Field.Error>{fieldError('name')}</Field.Error></Field.Field>
			{#if customEndpoint}
				<Field.Field data-invalid={fieldError('baseUrl') !== ''}><Field.Label for="ai-provider-base-url">{$_('admin.aiProviders.baseUrl')}</Field.Label><Input id="ai-provider-base-url" bind:value={baseUrl} type="url" autocomplete="url" placeholder="https://api.example.com/v1" aria-invalid={fieldError('baseUrl') !== ''} /><Field.Description>{$_('admin.aiProviders.baseUrlDescription')}</Field.Description><Field.Error>{fieldError('baseUrl')}</Field.Error></Field.Field>
			{:else}
				<p class="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{$_('admin.aiProviders.officialEndpointDescription')}</p>
			{/if}
			<Field.Field data-invalid={fieldError('models') !== ''}><Field.Label for="ai-provider-models">{$_('admin.aiProviders.models')}</Field.Label><TagInput id="ai-provider-models" bind:value={models} placeholder={$_('admin.aiProviders.modelsPlaceholder')} /><Field.Description>{$_('admin.aiProviders.modelsDescription')}</Field.Description><Field.Error>{fieldError('models')}</Field.Error></Field.Field>
			<div class="grid gap-4 sm:grid-cols-2">
				<Field.Field data-invalid={fieldError('priceMultiplier') !== ''}><Field.Label for="ai-provider-price-multiplier">{$_('admin.aiProviders.priceMultiplier')}</Field.Label><Input id="ai-provider-price-multiplier" bind:value={priceMultiplier} inputmode="decimal" autocomplete="off" aria-invalid={fieldError('priceMultiplier') !== ''} /><Field.Description>{$_('admin.aiProviders.priceMultiplierDescription')}</Field.Description><Field.Error>{fieldError('priceMultiplier')}</Field.Error></Field.Field>
				<Field.Field class="rounded-md border p-3"><div class="flex items-center justify-between gap-4"><div><Field.Label for="ai-provider-enabled">{$_('admin.aiProviders.enabledLabel')}</Field.Label><Field.Description>{$_('admin.aiProviders.enabledDescription')}</Field.Description></div><Switch id="ai-provider-enabled" bind:checked={enabled} /></div></Field.Field>
			</div>
			<Field.Field data-invalid={fieldError('apiKey') !== ''}>
				<div class="flex items-center justify-between gap-3"><Field.Label for="ai-provider-api-key-action">{$_('admin.configuration.payment.apiKey')}</Field.Label><span class="text-sm text-muted-foreground">{provider?.api_key_configured ? $_('admin.configuration.secret.configured') : $_('admin.configuration.secret.notConfigured')}</span></div>
				{#if provider !== null}<Select.Root type="single" bind:value={apiKeyAction}><Select.Trigger id="ai-provider-api-key-action" class="w-full">{$_(`admin.configuration.secret.${apiKeyAction}`)}</Select.Trigger><Select.Content><Select.Item value="keep">{$_('admin.configuration.secret.keep')}</Select.Item><Select.Item value="replace">{$_('admin.configuration.secret.replace')}</Select.Item></Select.Content></Select.Root>{/if}
				{#if provider === null || apiKeyAction === 'replace'}<Input id="ai-provider-api-key" type="password" autocomplete="new-password" bind:value={apiKeyValue} aria-invalid={fieldError('apiKey') !== ''} />{/if}
				<Field.Error>{fieldError('apiKey')}</Field.Error>
			</Field.Field>
			<Sheet.Footer class="border-t px-0 pb-0"><Button type="button" variant="outline" onclick={() => (open = false)} disabled={saving}>{$_('admin.configuration.entity.cancel')}</Button><Button type="submit" disabled={saving}>{saving ? $_('admin.configuration.saving') : $_('admin.configuration.save')}</Button></Sheet.Footer>
		</form>
	</Sheet.Content>
</Sheet.Root>
