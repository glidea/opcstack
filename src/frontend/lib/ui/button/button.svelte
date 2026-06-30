<script lang="ts" module>
	import { cn, type WithElementRef } from "$frontend/ui/utils.js";
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";
	import { type VariantProps, tv } from "tailwind-variants";

	export const buttonVariants = tv({
		base: "focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 border border-transparent bg-clip-padding font-normal aria-invalid:ring-2 [&_svg:not([class*='size-'])]:size-4 group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-[background-color,border-color,transform,opacity] duration-150 ease-out outline-none select-none active:not-aria-[haspopup]:scale-[0.95] active:not-aria-[haspopup]:duration-75 disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground disabled:border-transparent [&_svg]:pointer-events-none [&_svg]:shrink-0",
		variants: {
			variant: {
				default: "control-solid text-primary-foreground border-[var(--control-edge)] hover:brightness-110 rounded-[10px] shadow-[var(--control-edge-shadow)] active:not-aria-[haspopup]:shadow-none",
				outline: "bg-accent/60 border-[var(--control-outline-edge)] text-foreground hover:bg-accent hover:border-foreground/15 rounded-[10px] shadow-[var(--control-outline-shadow)]",
				secondary: "control-solid-inverse text-background border-[var(--control-edge)] hover:brightness-110 rounded-[10px] shadow-[var(--control-edge-shadow)] active:not-aria-[haspopup]:shadow-none",
				ghost: "hover:bg-accent hover:text-accent-foreground rounded-[10px]",
				destructive: "bg-destructive/10 hover:bg-destructive/20 focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--destructive)] dark:bg-destructive/20 text-destructive dark:hover:bg-destructive/30 rounded-[10px]",
				link: "text-primary underline-offset-4 hover:underline",
				pill: "control-solid text-primary-foreground border-[var(--control-edge)] hover:brightness-110 rounded-full shadow-[var(--control-edge-shadow)] active:not-aria-[haspopup]:shadow-none",
			},
			size: {
				default: "h-9 gap-1.5 px-4 text-[14px]",
				sm: "h-7 gap-1 px-2.5 text-[12px]",
				lg: "h-10 gap-2 px-6 text-[15px] font-light tracking-[0]",
				icon: "size-9 rounded-[10px]",
				"icon-sm": "size-7 rounded-[8px]",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
	export type ButtonSize = VariantProps<typeof buttonVariants>["size"];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
		};
</script>

<script lang="ts">
	let {
		class: className,
		variant = "default",
		size = "default",
		ref = $bindable(null),
		href = undefined,
		type = "button",
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? "link" : undefined}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
