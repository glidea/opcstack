<script lang="ts">
	import { _ } from "$web/i18n";
	import Section from "./Section.svelte";
	import Block from "./Block.svelte";

	type Swatch = { name: string; token: string; cssVar: string; tone?: "light" | "dark" };

	const surfaceTokens: Swatch[] = [
		{ name: "background", token: "--background", cssVar: "var(--background)", tone: "light" },
		{ name: "secondary / parchment", token: "--secondary", cssVar: "var(--secondary)", tone: "light" },
		{ name: "muted", token: "--muted", cssVar: "var(--muted)", tone: "light" },
		{ name: "card", token: "--card", cssVar: "var(--card)", tone: "light" },
	];

	const inkTokens: Swatch[] = [
		{ name: "foreground", token: "--foreground", cssVar: "var(--foreground)", tone: "dark" },
		{ name: "primary", token: "--primary", cssVar: "var(--primary)", tone: "dark" },
		{ name: "muted-foreground", token: "--muted-foreground", cssVar: "var(--muted-foreground)", tone: "dark" },
		{ name: "destructive", token: "--destructive", cssVar: "var(--destructive)", tone: "dark" },
	];

	const borderTokens: Swatch[] = [
		{ name: "border", token: "--border", cssVar: "var(--border)" },
		{ name: "input", token: "--input", cssVar: "var(--input)" },
		{ name: "ring", token: "--ring", cssVar: "var(--ring)", tone: "dark" },
		{ name: "surface-border", token: "--surface-border", cssVar: "var(--surface-border)" },
	];

	const radii = [
		{ name: "sm", value: "6px", cls: "rounded-sm" },
		{ name: "md", value: "10px", cls: "rounded-md" },
		{ name: "lg", value: "14px", cls: "rounded-lg" },
		{ name: "xl", value: "16px", cls: "rounded-xl" },
		{ name: "pill", value: "9999px", cls: "rounded-full" },
	];

	const spacing = [
		{ name: "xxs", value: 4 },
		{ name: "xs", value: 8 },
		{ name: "sm", value: 12 },
		{ name: "md", value: 17 },
		{ name: "lg", value: 24 },
		{ name: "xl", value: 32 },
		{ name: "xxl", value: 48 },
		{ name: "section", value: 80 },
	];

	const typeSamples = [
		{ cls: "text-hero-display", label: "hero-display · 44px / 600 / -0.22" },
		{ cls: "text-display-lg", label: "display-lg · 32px / 600 / -0.16" },
		{ cls: "text-display-md", label: "display-md · 28px / 600 / -0.14" },
		{ cls: "text-lead", label: "lead · 20px / 400 / -0.10" },
		{ cls: "text-tagline", label: "tagline · 18px / 600 / -0.09" },
		{ cls: "text-base", label: "body · 15px / 400 / -0.15" },
		{ cls: "text-caption", label: "caption · 13px / 400 / -0.13" },
		{ cls: "text-fine-print", label: "fine-print · 12px / 400 / -0.12" },
	];
</script>

<Section
	id="foundations"
	eyebrow={$_("designSystem.s1.eyebrow")}
	title={$_("designSystem.s1.title")}
	description={$_("designSystem.s1.desc")}
	surface="parchment"
>
	<Block title={$_("designSystem.s1.b.surfaces")} description={$_("designSystem.s1.b.surfaces.desc")} span={2}>
		<div class="grid w-full grid-cols-2 gap-3 md:grid-cols-4">
			{#each surfaceTokens as s (s.token)}
				<div class="flex flex-col gap-2">
					<div
						class="h-20 w-full rounded-md border border-border"
						style="background: {s.cssVar};"
					></div>
					<div class="flex flex-col">
						<span class="text-caption-strong text-foreground">{s.name}</span>
						<code class="text-fine-print text-muted-foreground">{s.token}</code>
					</div>
				</div>
			{/each}
		</div>
	</Block>

	<Block title={$_("designSystem.s1.b.ink")} description={$_("designSystem.s1.b.ink.desc")} span={2}>
		<div class="grid w-full grid-cols-2 gap-3 md:grid-cols-4">
			{#each inkTokens as s (s.token)}
				<div class="flex flex-col gap-2">
					<div
						class="h-20 w-full rounded-md border border-border"
						style="background: {s.cssVar};"
					></div>
					<div class="flex flex-col">
						<span class="text-caption-strong text-foreground">{s.name}</span>
						<code class="text-fine-print text-muted-foreground">{s.token}</code>
					</div>
				</div>
			{/each}
		</div>
	</Block>

	<Block title={$_("designSystem.s1.b.hairlines")} description={$_("designSystem.s1.b.hairlines.desc")} span={2}>
		<div class="grid w-full grid-cols-2 gap-3 md:grid-cols-4">
			{#each borderTokens as s (s.token)}
				<div class="flex flex-col gap-2">
					<div
						class="h-20 w-full rounded-md border-2"
						style="border-color: {s.cssVar};"
					></div>
					<div class="flex flex-col">
						<span class="text-caption-strong text-foreground">{s.name}</span>
						<code class="text-fine-print text-muted-foreground">{s.token}</code>
					</div>
				</div>
			{/each}
		</div>
	</Block>

	<Block title={$_("designSystem.s1.b.elevation")} description={$_("designSystem.s1.b.elevation.desc")} span={2}>
		<div class="flex w-full items-end justify-center gap-6 py-4">
			<div class="flex flex-col items-center gap-2">
				<div class="h-24 w-24 rounded-md border border-border bg-background"></div>
				<span class="text-fine-print text-muted-foreground">card · flat</span>
			</div>
			<div class="flex flex-col items-center gap-2">
				<div class="h-24 w-24 rounded-md bg-background" style="box-shadow: var(--shadow-product);"></div>
				<span class="text-fine-print text-muted-foreground">product · shadow-product</span>
			</div>
		</div>
	</Block>

	<Block title={$_("designSystem.s1.b.radius")} span={2}>
		<div class="flex w-full flex-wrap items-end gap-6">
			{#each radii as r (r.name)}
				<div class="flex flex-col items-center gap-2">
					<div class="h-16 w-16 border border-border bg-background {r.cls}"></div>
					<span class="text-fine-print text-foreground">{r.name}</span>
					<code class="text-fine-print text-muted-foreground">{r.value}</code>
				</div>
			{/each}
		</div>
	</Block>

	<Block title={$_("designSystem.s1.b.spacing")} span={2}>
		<div class="flex w-full flex-col gap-2">
			{#each spacing as s (s.name)}
				<div class="flex items-center gap-3">
					<span class="w-16 text-caption text-muted-foreground">{s.name}</span>
					<div class="h-2 rounded-full bg-foreground" style="width: {s.value}px;"></div>
					<code class="text-fine-print text-muted-foreground">{s.value}px</code>
				</div>
			{/each}
		</div>
	</Block>

	<div class="col-span-12 flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-card p-8">
		<div class="text-[13px] font-semibold tracking-[-0.13px] text-foreground">{$_("designSystem.s1.b.typography")}</div>
		<div class="flex flex-col gap-4">
			{#each typeSamples as t (t.cls)}
				<div class="flex flex-col gap-1 border-b border-border pb-3 last:border-b-0 last:pb-0">
					<span class={t.cls}>{t.cls === 'text-hero-display' ? 'A photograph speaks first.' : 'A photograph speaks first.'}</span>
					<code class="text-fine-print text-muted-foreground">{t.label}</code>
				</div>
			{/each}
		</div>
	</div>
</Section>
