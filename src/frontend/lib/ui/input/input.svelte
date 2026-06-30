<script lang="ts">
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from "svelte/elements";
	import { cn, type WithElementRef } from "$frontend/ui/utils.js";

	type InputType = Exclude<HTMLInputTypeAttribute, "file">;

	type Props = WithElementRef<
		Omit<HTMLInputAttributes, "type"> &
			({ type: "file"; files?: FileList } | { type?: InputType; files?: undefined })
	>;

	let {
		ref = $bindable(null),
		value = $bindable(),
		type,
		files = $bindable(),
		class: className,
		"data-slot": dataSlot = "input",
		...restProps
	}: Props = $props();

	const baseClass = "border-input bg-background placeholder:text-muted-foreground/70 focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)] focus-visible:border-ring aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-muted dark:disabled:bg-input/60 h-9 rounded-[10px] border px-3.5 py-1 text-[14px] transition-[border-color,box-shadow] duration-150 ease-out aria-invalid:ring-2 w-full min-w-0 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:text-muted-foreground";
</script>

{#if type === "file"}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(
			baseClass,
			"file:h-6 file:text-xs file:font-medium file:text-foreground file:inline-flex file:border-0 file:bg-transparent",
			className
		)}
		type="file"
		bind:files
		bind:value
		{...restProps}
	/>
{:else}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(baseClass, className)}
		{type}
		bind:value
		{...restProps}
	/>
{/if}
