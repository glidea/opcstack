<script lang="ts">
	import { _ } from '$frontend/i18n'
	import { Button } from '$frontend/ui/button'
	import * as Command from '$frontend/ui/command'
	import * as Popover from '$frontend/ui/popover'
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down'
	import { createCountryOptions, type CountryOption } from './configuration-page'

	let { id, locale, value = $bindable('') }: { id: string; locale: string; value?: string } = $props()
	let open: boolean = $state(false)
	let options: CountryOption[] = $derived(createCountryOptions(locale))
	let selected: CountryOption | undefined = $derived(options.find((option: CountryOption): boolean => option.code === value))

	function selectCountry(code: string): void {
		value = code
		open = false
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button {...props} {id} type="button" variant="outline" class="w-full justify-between px-3 font-normal">
				<span class="truncate">{selected === undefined ? $_('admin.configuration.payment.selectCountry') : `${selected.name} (${selected.code})`}</span>
				<ChevronsUpDownIcon class="shrink-0 text-muted-foreground" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content align="start" class="w-[min(22rem,calc(100vw-2rem))] p-1">
		<Command.Root>
			<Command.Input placeholder={$_('admin.configuration.payment.searchCountry')} />
			<Command.List class="max-h-72">
				<Command.Empty>{$_('admin.configuration.payment.noCountry')}</Command.Empty>
				{#each options as option (option.code)}
					<Command.Item value={`${option.name} ${option.code}`} data-checked={option.code === value} onSelect={() => selectCountry(option.code)}>
						<span class="truncate">{option.name}</span>
						<span class="ml-auto text-xs text-muted-foreground">{option.code}</span>
					</Command.Item>
				{/each}
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
