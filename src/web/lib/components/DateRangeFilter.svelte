<script lang="ts">
	import { getLocalTimeZone, type DateValue } from '@internationalized/date'
	import { Button } from '$web/ui/button'
	import * as Popover from '$web/ui/popover'
	import { RangeCalendar } from '$web/ui/range-calendar'
	import CalendarIcon from '@lucide/svelte/icons/calendar'
	import XIcon from '@lucide/svelte/icons/x'

	type DateRangeValue = {
		start: DateValue | undefined
		end: DateValue | undefined
	}

	let {
		value = $bindable({ start: undefined, end: undefined }),
		placeholder,
		applyLabel,
		clearLabel,
		onApply
	}: {
		value: DateRangeValue
		placeholder: string
		applyLabel: string
		clearLabel: string
		onApply?: () => void
	} = $props()

	let open: boolean = $state(false)

	function clear(): void {
		value = {
			start: undefined,
			end: undefined
		}
		if (onApply) {
			onApply()
		}
		open = false
	}

	function apply(): void {
		if (onApply) {
			onApply()
		}
		open = false
	}

	function formatDateRange(): string {
		if (!value.start || !value.end) {
			return placeholder
		}
		return `${formatDate(value.start)} - ${formatDate(value.end)}`
	}

	function formatDate(dateValue: DateValue): string {
		const date: Date = dateValue.toDate(getLocalTimeZone())
		const year: string = String(date.getFullYear())
		const month: string = String(date.getMonth() + 1).padStart(2, '0')
		const day: string = String(date.getDate()).padStart(2, '0')
		return `${year}-${month}-${day}`
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button variant="outline" class="w-full justify-start gap-2 md:w-auto" {...props}>
				<CalendarIcon class="size-4" />
				<span>{formatDateRange()}</span>
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content align="start" class="w-auto">
		<RangeCalendar bind:value={value} />
		<div class="flex items-center justify-between gap-2 border-t border-border pt-2">
			<Button type="button" variant="ghost" size="sm" onclick={clear}>
				<XIcon class="size-4" />
				{clearLabel}
			</Button>
			<Button type="button" size="sm" onclick={apply}>{applyLabel}</Button>
		</div>
	</Popover.Content>
</Popover.Root>
