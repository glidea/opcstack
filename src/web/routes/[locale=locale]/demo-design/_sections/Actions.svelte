<script lang="ts">
	import { _ } from "$web/i18n";
	import Section from "./Section.svelte";
	import Block from "./Block.svelte";

	import { Button } from "$web/ui/button";
	import * as ButtonGroup from "$web/ui/button-group";
	import { Toggle } from "$web/ui/toggle";
	import * as ToggleGroup from "$web/ui/toggle-group";
	import { Kbd, KbdGroup } from "$web/ui/kbd";

	import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
	import BoldIcon from "@lucide/svelte/icons/bold";
	import ItalicIcon from "@lucide/svelte/icons/italic";
	import UnderlineIcon from "@lucide/svelte/icons/underline";
	import AlignLeftIcon from "@lucide/svelte/icons/align-left";
	import AlignCenterIcon from "@lucide/svelte/icons/align-center";
	import AlignRightIcon from "@lucide/svelte/icons/align-right";
	import PlayIcon from "@lucide/svelte/icons/play";
	import StarIcon from "@lucide/svelte/icons/star";

	const variants = ["default", "outline", "secondary", "ghost", "destructive", "link"] as const;
	const sizes = ["sm", "default", "lg"] as const;

	let textAlign: string = $state("left");
	let bold: boolean = $state(false);
</script>

<Section
	id="actions"
	eyebrow={$_("designSystem.s2.eyebrow")}
	title={$_("designSystem.s2.title")}
	description={$_("designSystem.s2.desc")}
	surface="light"
>
	<Block title={$_("designSystem.s2.b.variants")} description="default · outline · secondary · ghost · destructive · link" span={2}>
		<div class="flex w-full flex-wrap items-center gap-3">
			{#each variants as v (v)}
				<Button variant={v}>{v}</Button>
			{/each}
		</div>
	</Block>

	<Block title={$_("designSystem.s2.b.sizes")} description="sm · default · lg · icon · icon-sm" span={2}>
		<div class="flex w-full flex-wrap items-center gap-3">
			{#each sizes as s (s)}
				<Button size={s}>Buy now</Button>
			{/each}
			<Button size="icon" aria-label="Play">
				<PlayIcon />
			</Button>
			<Button size="icon-sm" variant="secondary" aria-label="Star">
				<StarIcon />
			</Button>
		</div>
	</Block>

	<Block title={$_("designSystem.s2.b.withIcon")} span={2}>
		<div class="flex w-full flex-wrap items-center gap-3">
			<Button>
				Get started <ArrowRightIcon />
			</Button>
			<Button variant="outline">
				Learn more <ArrowRightIcon />
			</Button>
			<Button variant="secondary">
				<PlayIcon /> Watch the film
			</Button>
		</div>
	</Block>

	<Block title={$_("designSystem.s2.b.disabled")} span={2}>
		<div class="flex w-full flex-wrap items-center gap-3">
			<Button disabled>Disabled</Button>
			<Button variant="outline" disabled>Disabled</Button>
			<Button variant="ghost" disabled>Disabled</Button>
		</div>
	</Block>

	<Block title={$_("designSystem.s2.b.group")} description={$_("designSystem.s2.b.group.desc")} span={2}>
		<div class="flex w-full flex-col items-start gap-4">
			<ButtonGroup.Root>
				<Button variant="outline">Copy</Button>
				<Button variant="outline">Cut</Button>
				<Button variant="outline">Paste</Button>
			</ButtonGroup.Root>

			<ButtonGroup.Root>
				<Button variant="outline">Year</Button>
				<ButtonGroup.Separator />
				<Button variant="outline">Month</Button>
				<ButtonGroup.Separator />
				<Button variant="outline">Week</Button>
			</ButtonGroup.Root>

			<ButtonGroup.Root orientation="vertical">
				<Button variant="outline">Top</Button>
				<Button variant="outline">Middle</Button>
				<Button variant="outline">Bottom</Button>
			</ButtonGroup.Root>
		</div>
	</Block>

	<Block title={$_("designSystem.s2.b.toggle")} span={2}>
		<div class="flex w-full flex-col items-start gap-4">
			<div class="flex items-center gap-2">
				<Toggle bind:pressed={bold} aria-label="Bold">
					<BoldIcon />
				</Toggle>
				<Toggle variant="outline" aria-label="Italic">
					<ItalicIcon />
				</Toggle>
				<Toggle variant="outline" size="sm" aria-label="Underline">
					<UnderlineIcon />
				</Toggle>
				<Toggle variant="outline" size="lg" aria-label="Star">
					<StarIcon />
				</Toggle>
			</div>

			<ToggleGroup.Root type="single" bind:value={textAlign} variant="outline">
				<ToggleGroup.Item value="left" aria-label="Align left">
					<AlignLeftIcon />
				</ToggleGroup.Item>
				<ToggleGroup.Item value="center" aria-label="Align center">
					<AlignCenterIcon />
				</ToggleGroup.Item>
				<ToggleGroup.Item value="right" aria-label="Align right">
					<AlignRightIcon />
				</ToggleGroup.Item>
			</ToggleGroup.Root>

			<span class="text-fine-print text-muted-foreground">align: {textAlign} · bold: {bold}</span>
		</div>
	</Block>

	<Block title={$_("designSystem.s2.b.keyboard")} description="Kbd, KbdGroup." span={2}>
		<div class="flex w-full flex-wrap items-center gap-4">
			<KbdGroup>
				<Kbd>⌘</Kbd>
				<Kbd>K</Kbd>
			</KbdGroup>
			<KbdGroup>
				<Kbd>⌘</Kbd>
				<Kbd>⇧</Kbd>
				<Kbd>P</Kbd>
			</KbdGroup>
			<span class="text-caption text-muted-foreground">
				Open the command palette with <Kbd>⌘</Kbd> <Kbd>K</Kbd>
			</span>
		</div>
	</Block>
</Section>
