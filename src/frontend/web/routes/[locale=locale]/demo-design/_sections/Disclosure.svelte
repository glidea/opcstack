<script lang="ts">
	import { _ } from "$frontend/i18n";
	import Section from "./Section.svelte";
	import Block from "./Block.svelte";

	import * as Accordion from "$frontend/ui/accordion";
	import * as Resizable from "$frontend/ui/resizable";
	import * as Carousel from "$frontend/ui/carousel";
	import { Calendar } from "$frontend/ui/calendar";
	import { RangeCalendar } from "$frontend/ui/range-calendar";
	import { Button } from "$frontend/ui/button";

	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";

	let calValue: import("@internationalized/date").DateValue | undefined = $state(undefined);
	let rangeValue: import("bits-ui").DateRange = $state({ start: undefined, end: undefined });
</script>

<Section
	id="disclosure"
	eyebrow={$_("designSystem.s7.eyebrow")}
	title={$_("designSystem.s7.title")}
	description={$_("designSystem.s7.desc")}
	surface="parchment"
>
	<!-- Accordion -->
	<Block title="Accordion · single" span={2}>
		<Accordion.Root type="single" class="w-full">
			{#each [
				{ value: "a1", trigger: "What is OPC Stack?", content: "A Cloudflare-native SaaS scaffold with Workers, D1, R2, KV, Queues, and Cron — zero-cost to start." },
				{ value: "a2", trigger: "How do I deploy?", content: "Run pnpm deploy:cloudflare. The prepare-cloudflare script handles wrangler.jsonc generation, resource creation, and migrations automatically." },
				{ value: "a3", trigger: "Is it open source?", content: "Yes. Fork it, customize it, ship it. The design system is token-based and fully replaceable." },
			] as item (item.value)}
				<Accordion.Item value={item.value}>
					<Accordion.Trigger>{item.trigger}</Accordion.Trigger>
					<Accordion.Content>{item.content}</Accordion.Content>
				</Accordion.Item>
			{/each}
		</Accordion.Root>
	</Block>

	<Block title="Accordion · multiple" span={2}>
		<Accordion.Root type="multiple" class="w-full">
			{#each [
				{ value: "b1", trigger: "Authentication", content: "Better Auth with email OTP, Google OAuth, and beta-code gating." },
				{ value: "b2", trigger: "Credits system", content: "Signup grants, daily check-in, affiliate rewards, redemption codes, and expiry" },
				{ value: "b3", trigger: "Payment", content: "Dodo and Creem providers with country-based routing and webhook handling." },
			] as item (item.value)}
				<Accordion.Item value={item.value}>
					<Accordion.Trigger>{item.trigger}</Accordion.Trigger>
					<Accordion.Content>{item.content}</Accordion.Content>
				</Accordion.Item>
			{/each}
		</Accordion.Root>
	</Block>

	<!-- Resizable -->
	<Block title="Resizable" description={$_("designSystem.s7.b.resizable.desc")} span={2}>
		<div class="h-40 w-full overflow-hidden rounded-md border border-border">
			<Resizable.PaneGroup direction="horizontal" class="h-full">
				<Resizable.Pane defaultSize={40} minSize={20}>
					<div class="flex h-full items-center justify-center text-caption text-muted-foreground">
						Left
					</div>
				</Resizable.Pane>
				<Resizable.Handle withHandle />
				<Resizable.Pane defaultSize={60} minSize={20}>
					<div class="flex h-full items-center justify-center text-caption text-muted-foreground">
						Right
					</div>
				</Resizable.Pane>
			</Resizable.PaneGroup>
		</div>
	</Block>

	<!-- Carousel -->
	<Block title="Carousel" description={$_("designSystem.s7.b.carousel.desc")} span={2}>
		<Carousel.Root class="w-full max-w-xs px-12">
			<Carousel.Content>
				{#each ["Slide 1", "Slide 2", "Slide 3", "Slide 4"] as slide (slide)}
					<Carousel.Item>
						<div class="flex h-32 items-center justify-center rounded-md border border-border bg-muted text-caption text-muted-foreground">
							{slide}
						</div>
					</Carousel.Item>
				{/each}
			</Carousel.Content>
			<Carousel.Previous />
			<Carousel.Next />
		</Carousel.Root>
	</Block>

	<!-- Calendar -->
	<Block title="Calendar" description={$_("designSystem.s7.b.calendar.desc")} span={2}>
		<div class="flex flex-col items-start gap-2">
			<Calendar type="single" bind:value={calValue} />
			<span class="text-fine-print text-muted-foreground">
				selected: {calValue ? calValue.toString() : "—"}
			</span>
		</div>
	</Block>

	<!-- RangeCalendar -->
	<Block title="RangeCalendar" description={$_("designSystem.s7.b.rangeCalendar.desc")} span={2}>
		<div class="flex flex-col items-start gap-2">
			<RangeCalendar bind:value={rangeValue} />
			<span class="text-fine-print text-muted-foreground">
				{rangeValue.start ? rangeValue.start.toString() : "—"} →
				{rangeValue.end ? rangeValue.end.toString() : "—"}
			</span>
		</div>
	</Block>
</Section>
