<script lang="ts">
	import type { AIProvider, AIProviderType } from '$apiContract/configuration'
	import { ApiClientError, client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Badge } from '$frontend/ui/badge'
	import { Button } from '$frontend/ui/button'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import * as Select from '$frontend/ui/select'
	import * as Sheet from '$frontend/ui/sheet'
	import { Switch } from '$frontend/ui/switch'
	import { Textarea } from '$frontend/ui/textarea'
	import { validateAIProviderForm } from './configuration-collections'

	const providerTypes: AIProviderType[] = [
		'chat_openai',
		'image_gemini',
		'image_openai',
		'image_seedream',
		'image_aliyun',
		'tts_gemini',
		'tts_seed',
		'realtime_doubao',
		'video_seedance'
	]

	let {
		open = $bindable(false),
		provider,
		onSaved,
		onRefresh
	}: {
		open?: boolean
		provider: AIProvider | null
		onSaved: (provider: AIProvider) => void
		onRefresh: () => Promise<void>
	} = $props()

	let id: string = $state('')
	let providerType: AIProviderType = $state('image_gemini')
	let name: string = $state('')
	let baseUrl: string = $state('')
	let models: string = $state('')
	let priceMultiplier: string = $state('1')
	let enabled: boolean = $state(true)
	let apiKeyAction: 'keep' | 'replace' = $state('replace')
	let apiKeyValue: string = $state('')
	let errors: Record<string, string> = $state({})
	let requestError: string = $state('')
	let conflict: boolean = $state(false)
	let saving: boolean = $state(false)
	let wasOpen: boolean = false

	$effect((): void => {
		if (open && !wasOpen) {
			resetForm()
		}
		wasOpen = open
	})

	function resetForm(): void {
		id = provider?.id ?? ''
		providerType = provider?.type ?? 'image_gemini'
		name = provider?.name ?? ''
		baseUrl = provider?.base_url ?? ''
		models = provider?.models.join('\n') ?? ''
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
		errors = validateAIProviderForm({
			editing: provider !== null,
			id,
			type: providerType,
			name,
			baseUrl,
			models,
			priceMultiplier,
			apiKeyAction,
			apiKeyValue
		})
		if (Object.keys(errors).length > 0) {
			return
		}
		saving = true
		requestError = ''
		conflict = false
		try {
			const fields = {
				id: id.trim(),
				name: name.trim(),
				type: providerType,
				base_url: baseUrl.trim(),
				models: models.split('\n').map((model: string): string => model.trim()).filter((model: string): boolean => model !== ''),
				price_multiplier: Number(priceMultiplier),
				enabled
			}
			const saved: AIProvider = provider === null
				? await client.api.createAIProvider({ ...fields, api_key: apiKeyValue })
				: await client.api.updateAIProvider({
					...fields,
					api_key: apiKeyAction === 'keep'
						? { action: 'keep' }
						: { action: 'replace', value: apiKeyValue },
					expected_version: provider.version
				})
			onSaved(saved)
			open = false
		} catch (saveError) {
			conflict = saveError instanceof ApiClientError && saveError.body.code === 'CONFIG_CONFLICT'
			requestError = saveError instanceof ApiClientError
				? saveError.body.message
				: $_('admin.configuration.entity.saveError')
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
	<Sheet.Content class="w-full overflow-y-auto sm:max-w-2xl">
		<Sheet.Header>
			<Sheet.Title>{provider === null ? $_('admin.configuration.ai.providers.create') : $_('admin.configuration.ai.providers.edit')}</Sheet.Title>
			<Sheet.Description class="sr-only">{$_('admin.configuration.ai.providers.dialogDescription')}</Sheet.Description>
		</Sheet.Header>
		<form class="space-y-5 px-4 pb-4" onsubmit={saveProvider}>
			{#if requestError !== ''}
				<Alert.Root variant="destructive">
					<Alert.Description>{requestError}</Alert.Description>
					{#if conflict}<Alert.Action><Button type="button" variant="ghost" size="sm" onclick={refreshConflict}>{$_('admin.configuration.entity.refresh')}</Button></Alert.Action>{/if}
				</Alert.Root>
			{/if}
			<div class="grid gap-4 sm:grid-cols-2">
				<Field.Field data-invalid={fieldError('id') !== ''}>
					<Field.Label for="ai-provider-id">{$_('admin.configuration.ai.providers.id')}</Field.Label>
					<Input id="ai-provider-id" bind:value={id} disabled={provider !== null} autocomplete="off" aria-invalid={fieldError('id') !== ''} />
					<Field.Error>{fieldError('id')}</Field.Error>
				</Field.Field>
				<Field.Field data-invalid={fieldError('type') !== ''}>
					<Field.Label for="ai-provider-type">{$_('admin.configuration.ai.providers.type')}</Field.Label>
					<Select.Root type="single" bind:value={providerType}>
						<Select.Trigger id="ai-provider-type" class="w-full" aria-invalid={fieldError('type') !== ''}>{providerType}</Select.Trigger>
						<Select.Content>{#each providerTypes as option}<Select.Item value={option}>{option}</Select.Item>{/each}</Select.Content>
					</Select.Root>
					<Field.Error>{fieldError('type')}</Field.Error>
				</Field.Field>
				<Field.Field data-invalid={fieldError('name') !== ''}>
					<Field.Label for="ai-provider-name">{$_('admin.configuration.ai.providers.name')}</Field.Label>
					<Input id="ai-provider-name" bind:value={name} autocomplete="off" aria-invalid={fieldError('name') !== ''} />
					<Field.Error>{fieldError('name')}</Field.Error>
				</Field.Field>
				<Field.Field data-invalid={fieldError('priceMultiplier') !== ''}>
					<Field.Label for="ai-provider-price-multiplier">{$_('admin.configuration.ai.providers.priceMultiplier')}</Field.Label>
					<Input id="ai-provider-price-multiplier" bind:value={priceMultiplier} inputmode="decimal" autocomplete="off" aria-invalid={fieldError('priceMultiplier') !== ''} />
					<Field.Error>{fieldError('priceMultiplier')}</Field.Error>
				</Field.Field>
			</div>
			<Field.Field data-invalid={fieldError('baseUrl') !== ''}>
				<Field.Label for="ai-provider-base-url">{$_('admin.configuration.ai.providers.baseUrl')}</Field.Label>
				<Input id="ai-provider-base-url" bind:value={baseUrl} type="url" autocomplete="url" aria-invalid={fieldError('baseUrl') !== ''} />
				<Field.Error>{fieldError('baseUrl')}</Field.Error>
			</Field.Field>
			<Field.Field data-invalid={fieldError('models') !== ''}>
				<Field.Label for="ai-provider-models">{$_('admin.configuration.ai.providers.models')}</Field.Label>
				<Textarea id="ai-provider-models" bind:value={models} aria-invalid={fieldError('models') !== ''} />
				<Field.Description>{$_('admin.configuration.ai.providers.modelsDescription')}</Field.Description>
				<Field.Error>{fieldError('models')}</Field.Error>
			</Field.Field>
			<Field.Field data-invalid={fieldError('apiKey') !== ''}>
				<div class="flex items-center justify-between gap-3">
					<Field.Label for="ai-provider-api-key-action">{$_('admin.configuration.payment.apiKey')}</Field.Label>
					<Badge variant="secondary">{provider?.api_key_configured ? $_('admin.configuration.secret.configured') : $_('admin.configuration.secret.notConfigured')}</Badge>
				</div>
				{#if provider !== null}
					<Select.Root type="single" bind:value={apiKeyAction}>
						<Select.Trigger id="ai-provider-api-key-action" class="w-full">{$_(`admin.configuration.secret.${apiKeyAction}`)}</Select.Trigger>
						<Select.Content><Select.Item value="keep">{$_('admin.configuration.secret.keep')}</Select.Item><Select.Item value="replace">{$_('admin.configuration.secret.replace')}</Select.Item></Select.Content>
					</Select.Root>
				{/if}
				{#if provider === null || apiKeyAction === 'replace'}
					<Input id="ai-provider-api-key" type="password" autocomplete="new-password" bind:value={apiKeyValue} aria-invalid={fieldError('apiKey') !== ''} />
				{/if}
				<Field.Error>{fieldError('apiKey')}</Field.Error>
			</Field.Field>
			<Field.Field orientation="horizontal">
				<Field.Label for="ai-provider-enabled">{$_('admin.configuration.enabled')}</Field.Label>
				<Switch id="ai-provider-enabled" bind:checked={enabled} />
			</Field.Field>
			<Sheet.Footer class="border-t px-0 pb-0">
				<Button type="button" variant="outline" onclick={() => (open = false)} disabled={saving}>{$_('admin.configuration.entity.cancel')}</Button>
				<Button type="submit" disabled={saving}>{saving ? $_('admin.configuration.saving') : $_('admin.configuration.save')}</Button>
			</Sheet.Footer>
		</form>
	</Sheet.Content>
</Sheet.Root>
