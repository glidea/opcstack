<script lang="ts">
	import { cn, type WithElementRef } from "$web/ui/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="card-footer"
	class={cn("bg-muted/30 rounded-b-[14px] border-t p-4 group-data-[size=sm]/card:p-3 flex items-center", className)}
	{...restProps}
>
	{@render children?.()}
</div>
