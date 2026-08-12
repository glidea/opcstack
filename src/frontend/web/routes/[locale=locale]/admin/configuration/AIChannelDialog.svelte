<script lang="ts">
	import type { AIChannel, AIChannelArea } from '$apiContract/configuration'
	import { ApiClientError, client } from '$apiContract/client'
	import { _ } from '$frontend/i18n'
	import * as Alert from '$frontend/ui/alert'
	import { Badge } from '$frontend/ui/badge'
	import { Button } from '$frontend/ui/button'
	import * as Dialog from '$frontend/ui/dialog'
	import * as Field from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import * as Select from '$frontend/ui/select'
	import { Switch } from '$frontend/ui/switch'
	import { Textarea } from '$frontend/ui/textarea'
	import { validateAIChannelForm } from './configuration-collections'

	let {
		open = $bindable(false),
		channel,
		onSaved,
		onRefresh
	}: {
		open?: boolean
		channel: AIChannel | null
		onSaved: (channel: AIChannel) => void
		onRefresh: () => Promise<void>
	} = $props()

	let id: string = $state('')
	let area: AIChannelArea = $state('image')
	let provider: string = $state('gemini')
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
		if (open && !wasOpen) resetForm()
		wasOpen = open
	})

	function resetForm(): void {
		id = channel?.id ?? ''
		area = channel?.area ?? 'image'
		provider = channel?.provider ?? 'gemini'
		name = channel?.name ?? ''
		baseUrl = channel?.base_url ?? ''
		models = channel?.models.join('\n') ?? ''
		priceMultiplier = channel === null ? '1' : String(channel.price_multiplier)
		enabled = channel?.enabled ?? true
		apiKeyAction = channel === null ? 'replace' : 'keep'
		apiKeyValue = ''
		errors = {}
		requestError = ''
		conflict = false
	}

	function providerOptions(): string[] {
		switch (area) {
			case 'image': return ['gemini', 'openai', 'seedream', 'aliyun']
			case 'tts': return ['gemini', 'seed']
			case 'video': return ['seedance']
		}
	}

	function changeArea(nextArea: AIChannelArea): void {
		area = nextArea
		provider = providerOptions()[0] ?? ''
	}

	async function saveChannel(event: SubmitEvent): Promise<void> {
		event.preventDefault()
		errors = validateAIChannelForm({ editing: channel !== null, id, provider, name, baseUrl, models, priceMultiplier, apiKeyAction, apiKeyValue })
		if (Object.keys(errors).length > 0) return
		saving = true
		requestError = ''
		conflict = false
		try {
			const fields = {
				id: id.trim(),
				area,
				provider: provider.trim(),
				name: name.trim(),
				base_url: baseUrl.trim(),
				models: models.split('\n').map((model: string): string => model.trim()).filter((model: string): boolean => model !== ''),
				price_multiplier: Number(priceMultiplier),
				enabled
			}
			const saved: AIChannel = channel === null
				? await client.api.createAIChannel({ ...fields, api_key: apiKeyValue })
				: await client.api.updateAIChannel({
					...fields,
					api_key: apiKeyAction === 'keep' ? { action: 'keep' } : { action: 'replace', value: apiKeyValue },
					expected_version: channel.version
				})
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

	function fieldError(field: string): string {
		return errors[field] ?? ''
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
		<Dialog.Header><Dialog.Title>{channel === null ? $_('admin.configuration.ai.channels.create') : $_('admin.configuration.ai.channels.edit')}</Dialog.Title><Dialog.Description class="sr-only">{$_('admin.configuration.ai.channels.dialogDescription')}</Dialog.Description></Dialog.Header>
		<form class="space-y-5" onsubmit={saveChannel}>
			{#if requestError !== ''}<Alert.Root variant="destructive"><Alert.Description>{requestError}</Alert.Description>{#if conflict}<Alert.Action><Button type="button" variant="ghost" size="sm" onclick={refreshConflict}>{$_('admin.configuration.entity.refresh')}</Button></Alert.Action>{/if}</Alert.Root>{/if}
			<div class="grid gap-4 sm:grid-cols-2">
				<Field.Field data-invalid={fieldError('id') !== ''}><Field.Label for="ai-channel-id">{$_('admin.configuration.ai.channels.id')}</Field.Label><Input id="ai-channel-id" bind:value={id} disabled={channel !== null} autocomplete="off" aria-invalid={fieldError('id') !== ''} /><Field.Error>{fieldError('id')}</Field.Error></Field.Field>
				<Field.Field><Field.Label for="ai-channel-area">{$_('admin.configuration.ai.channels.area')}</Field.Label><Select.Root type="single" value={area} onValueChange={(value: string): void => changeArea(value as AIChannelArea)}><Select.Trigger id="ai-channel-area" class="w-full">{area}</Select.Trigger><Select.Content><Select.Item value="image">Image</Select.Item><Select.Item value="tts">TTS</Select.Item><Select.Item value="video">Video</Select.Item></Select.Content></Select.Root></Field.Field>
				<Field.Field data-invalid={fieldError('provider') !== ''}><Field.Label for="ai-channel-provider">{$_('admin.configuration.ai.channels.provider')}</Field.Label><Select.Root type="single" bind:value={provider}><Select.Trigger id="ai-channel-provider" class="w-full" aria-invalid={fieldError('provider') !== ''}>{provider}</Select.Trigger><Select.Content>{#each providerOptions() as option}<Select.Item value={option}>{option}</Select.Item>{/each}</Select.Content></Select.Root><Field.Error>{fieldError('provider')}</Field.Error></Field.Field>
				<Field.Field data-invalid={fieldError('name') !== ''}><Field.Label for="ai-channel-name">{$_('admin.configuration.ai.channels.name')}</Field.Label><Input id="ai-channel-name" bind:value={name} autocomplete="off" aria-invalid={fieldError('name') !== ''} /><Field.Error>{fieldError('name')}</Field.Error></Field.Field>
			</div>
			<Field.Field data-invalid={fieldError('baseUrl') !== ''}><Field.Label for="ai-channel-base-url">{$_('admin.configuration.ai.providers.baseUrl')}</Field.Label><Input id="ai-channel-base-url" bind:value={baseUrl} type="url" autocomplete="url" aria-invalid={fieldError('baseUrl') !== ''} /><Field.Error>{fieldError('baseUrl')}</Field.Error></Field.Field>
			<div class="grid gap-4 sm:grid-cols-2">
				<Field.Field data-invalid={fieldError('models') !== ''}><Field.Label for="ai-channel-models">{$_('admin.configuration.ai.channels.models')}</Field.Label><Textarea id="ai-channel-models" bind:value={models} aria-invalid={fieldError('models') !== ''} /><Field.Description>{$_('admin.configuration.ai.channels.modelsDescription')}</Field.Description><Field.Error>{fieldError('models')}</Field.Error></Field.Field>
				<Field.Field data-invalid={fieldError('priceMultiplier') !== ''}><Field.Label for="ai-channel-price-multiplier">{$_('admin.configuration.ai.channels.priceMultiplier')}</Field.Label><Input id="ai-channel-price-multiplier" bind:value={priceMultiplier} inputmode="decimal" autocomplete="off" aria-invalid={fieldError('priceMultiplier') !== ''} /><Field.Error>{fieldError('priceMultiplier')}</Field.Error></Field.Field>
			</div>
			<Field.Field data-invalid={fieldError('apiKey') !== ''}>
				<div class="flex items-center justify-between gap-3"><Field.Label for="ai-channel-api-key-action">{$_('admin.configuration.payment.apiKey')}</Field.Label><Badge variant="secondary">{channel?.api_key_configured ? $_('admin.configuration.secret.configured') : $_('admin.configuration.secret.notConfigured')}</Badge></div>
				{#if channel !== null}<Select.Root type="single" bind:value={apiKeyAction}><Select.Trigger id="ai-channel-api-key-action" class="w-full">{$_(`admin.configuration.secret.${apiKeyAction}`)}</Select.Trigger><Select.Content><Select.Item value="keep">{$_('admin.configuration.secret.keep')}</Select.Item><Select.Item value="replace">{$_('admin.configuration.secret.replace')}</Select.Item></Select.Content></Select.Root>{/if}
				{#if channel === null || apiKeyAction === 'replace'}<Input id="ai-channel-api-key" type="password" autocomplete="new-password" bind:value={apiKeyValue} aria-invalid={fieldError('apiKey') !== ''} />{/if}
				<Field.Error>{fieldError('apiKey')}</Field.Error>
			</Field.Field>
			<Field.Field orientation="horizontal"><Field.Label for="ai-channel-enabled">{$_('admin.configuration.enabled')}</Field.Label><Switch id="ai-channel-enabled" bind:checked={enabled} /></Field.Field>
			<Dialog.Footer><Button type="button" variant="outline" onclick={() => (open = false)} disabled={saving}>{$_('admin.configuration.entity.cancel')}</Button><Button type="submit" disabled={saving}>{saving ? $_('admin.configuration.saving') : $_('admin.configuration.save')}</Button></Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
