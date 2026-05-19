<script lang="ts">
	import { _ } from "$web/i18n";
	import Section from "./Section.svelte";
	import Block from "./Block.svelte";
	import DataTableDemo from "./DataTableDemo.svelte";

	import * as Avatar from "$web/ui/avatar";
	import { Badge } from "$web/ui/badge";
	import * as Card from "$web/ui/card";
	import * as Item from "$web/ui/item";
	import * as Empty from "$web/ui/empty";
	import { Separator } from "$web/ui/separator";
	import { Skeleton } from "$web/ui/skeleton";
	import { AspectRatio } from "$web/ui/aspect-ratio";
	import { Progress } from "$web/ui/progress";
	import { Spinner } from "$web/ui/spinner";
	import * as Alert from "$web/ui/alert";
	import * as Table from "$web/ui/table";
	import { Button } from "$web/ui/button";

	import UserIcon from "@lucide/svelte/icons/user";
	import InboxIcon from "@lucide/svelte/icons/inbox";
	import InfoIcon from "@lucide/svelte/icons/info";
	import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
	import StarIcon from "@lucide/svelte/icons/star";
	import FileTextIcon from "@lucide/svelte/icons/file-text";
	import MoreHorizontalIcon from "@lucide/svelte/icons/more-horizontal";

	const chartBars = [
		{ label: "Jan", value: 40 },
		{ label: "Feb", value: 65 },
		{ label: "Mar", value: 55 },
		{ label: "Apr", value: 80 },
		{ label: "May", value: 72 },
		{ label: "Jun", value: 90 },
	];
	const chartMax = 100;

	const badgeVariants = ["default", "secondary", "destructive", "outline", "ghost", "link"] as const;

	let progress = $state(68);
</script>

<Section
	id="display"
	eyebrow={$_("designSystem.s4.eyebrow")}
	title={$_("designSystem.s4.title")}
	description={$_("designSystem.s4.desc")}
	surface="light"
>
	<!-- Avatar -->
	<Block title={$_("designSystem.s4.b.avatar")} description={$_("designSystem.s4.b.avatar.desc")} span={2}>
		<div class="flex flex-wrap items-center gap-4">
			<Avatar.Root>
				<Avatar.Image src="https://github.com/shadcn.png" alt="shadcn" />
				<Avatar.Fallback>SC</Avatar.Fallback>
			</Avatar.Root>

			<Avatar.Root size="sm">
				<Avatar.Fallback>JD</Avatar.Fallback>
			</Avatar.Root>

			<Avatar.Root size="lg">
				<Avatar.Fallback><UserIcon class="size-4" /></Avatar.Fallback>
				<Avatar.Badge />
			</Avatar.Root>

			<Avatar.Group>
				{#each ["A", "B", "C"] as letter (letter)}
					<Avatar.Root>
						<Avatar.Fallback>{letter}</Avatar.Fallback>
					</Avatar.Root>
				{/each}
			</Avatar.Group>
		</div>
	</Block>

	<!-- Badge -->
	<Block title={$_("designSystem.s4.b.badge")} description={$_("designSystem.s4.b.badge.desc")} span={2}>
		<div class="flex flex-wrap items-center gap-2">
			{#each badgeVariants as v (v)}
				<Badge variant={v}>{v}</Badge>
			{/each}
		</div>
	</Block>

	<!-- Card -->
	<Block title={$_("designSystem.s4.b.card")} description={$_("designSystem.s4.b.card.desc")} span={2}>
		<Card.Root class="w-full max-w-sm">
			<Card.Header>
				<Card.Title>Monthly usage</Card.Title>
				<Card.Description>Your plan resets on June 1.</Card.Description>
				<Card.Action>
					<Button variant="ghost" size="icon-sm" aria-label="More">
						<MoreHorizontalIcon />
					</Button>
				</Card.Action>
			</Card.Header>
			<Card.Content>
				<div class="flex flex-col gap-2">
					<div class="flex items-center justify-between text-caption text-muted-foreground">
						<span>API calls</span>
						<span class="tabular-nums">68 / 100</span>
					</div>
					<Progress value={progress} />
				</div>
			</Card.Content>
			<Card.Footer>
				<Button variant="outline" size="sm">Upgrade plan</Button>
			</Card.Footer>
		</Card.Root>
	</Block>

	<!-- Item -->
	<Block title={$_("designSystem.s4.b.item")} description={$_("designSystem.s4.b.item.desc")} span={2}>
		<div class="w-full">
			<Item.Group>
				{#each [
					{ icon: FileTextIcon, title: "Invoice #1042", desc: "Paid · $129.00", date: "May 12" },
					{ icon: FileTextIcon, title: "Invoice #1041", desc: "Pending · $58.00", date: "May 8" },
					{ icon: FileTextIcon, title: "Invoice #1040", desc: "Refunded · $48.00", date: "Apr 30" },
				] as row, i (i)}
					<Item.Root variant="outline">
						<Item.Media variant="icon">
							<row.icon />
						</Item.Media>
						<Item.Header>
							<Item.Title>{row.title}</Item.Title>
							<Item.Description>{row.desc}</Item.Description>
						</Item.Header>
						<Item.Actions>
							<span class="text-caption text-muted-foreground">{row.date}</span>
						</Item.Actions>
					</Item.Root>
					{#if i < 2}
						<Item.Separator />
					{/if}
				{/each}
			</Item.Group>
		</div>
	</Block>

	<!-- Empty -->
	<Block title={$_("designSystem.s4.b.empty")} description={$_("designSystem.s4.b.empty.desc")} span={2}>
		<Empty.Root class="min-h-[180px]">
			<Empty.Media variant="icon">
				<InboxIcon />
			</Empty.Media>
			<Empty.Header>
				<Empty.Title>No messages yet</Empty.Title>
				<Empty.Description>When you receive a message it will appear here.</Empty.Description>
			</Empty.Header>
			<Empty.Content>
				<Button size="sm">Compose</Button>
			</Empty.Content>
		</Empty.Root>
	</Block>

	<!-- Alert -->
	<Block title={$_("designSystem.s4.b.alert")} description={$_("designSystem.s4.b.alert.desc")} span={2}>
		<div class="flex w-full flex-col gap-3">
			<Alert.Root>
				<InfoIcon />
				<Alert.Title>Heads up</Alert.Title>
				<Alert.Description>You can add components to your app using the CLI.</Alert.Description>
			</Alert.Root>
			<Alert.Root variant="destructive">
				<TriangleAlertIcon />
				<Alert.Title>Error</Alert.Title>
				<Alert.Description>Your session has expired. Please log in again.</Alert.Description>
			</Alert.Root>
		</div>
	</Block>

	<!-- Separator -->
	<Block title={$_("designSystem.s4.b.separator")} description={$_("designSystem.s4.b.separator.desc")} span={2}>
		<div class="flex w-full flex-col gap-4">
			<div class="flex flex-col gap-2">
				<span class="text-caption text-muted-foreground">Horizontal</span>
				<Separator />
			</div>
			<div class="flex h-8 items-center gap-4">
				<span class="text-caption">Docs</span>
				<Separator orientation="vertical" />
				<span class="text-caption">Blog</span>
				<Separator orientation="vertical" />
				<span class="text-caption">Support</span>
			</div>
		</div>
	</Block>

	<!-- Skeleton -->
	<Block title={$_("designSystem.s4.b.skeleton")} description={$_("designSystem.s4.b.skeleton.desc")} span={2}>
		<div class="flex w-full items-center gap-3">
			<Skeleton class="size-10 rounded-full" />
			<div class="flex flex-1 flex-col gap-2">
				<Skeleton class="h-4 w-3/4" />
				<Skeleton class="h-3 w-1/2" />
			</div>
		</div>
	</Block>

	<!-- AspectRatio -->
	<Block title={$_("designSystem.s4.b.aspectRatio")} description={$_("designSystem.s4.b.aspectRatio.desc")} span={2}>
		<div class="w-full max-w-xs">
			<AspectRatio ratio={16 / 9}>
				<div class="flex size-full items-center justify-center rounded-md bg-muted text-caption text-muted-foreground">
					16 / 9
				</div>
			</AspectRatio>
		</div>
	</Block>

	<!-- Progress + Spinner -->
	<Block title={$_("designSystem.s4.b.progress")} span={2}>
		<div class="flex w-full flex-col gap-4">
			<div class="flex flex-col gap-2">
				<div class="flex items-center justify-between text-caption text-muted-foreground">
					<span>Upload progress</span>
					<span class="tabular-nums">{progress}%</span>
				</div>
				<Progress value={progress} />
				<input type="range" min="0" max="100" bind:value={progress} class="w-full" />
			</div>
			<div class="flex items-center gap-4">
				<Spinner class="size-4" />
				<Spinner class="size-6" />
				<Spinner class="size-8" />
				<span class="text-caption text-muted-foreground">Spinner sizes</span>
			</div>
		</div>
	</Block>

	<!-- Table (static) -->
	<Block title={$_("designSystem.s4.b.table")} description={$_("designSystem.s4.b.table.desc")} span={2}>
		<Table.Root class="w-full">
			<Table.Caption>Recent transactions</Table.Caption>
			<Table.Header>
				<Table.Row>
					<Table.Head>Date</Table.Head>
					<Table.Head>Description</Table.Head>
					<Table.Head class="text-right">Amount</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each [
					{ date: "May 19", desc: "Pro plan", amount: "+$90.00" },
					{ date: "May 12", desc: "API credits", amount: "-$12.00" },
					{ date: "Apr 30", desc: "Refund", amount: "+$48.00" },
				] as row, i (i)}
					<Table.Row>
						<Table.Cell class="text-muted-foreground">{row.date}</Table.Cell>
						<Table.Cell>{row.desc}</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{row.amount}</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
			<Table.Footer>
				<Table.Row>
					<Table.Cell colspan={2}>Net</Table.Cell>
					<Table.Cell class="text-right tabular-nums">+$126.00</Table.Cell>
				</Table.Row>
			</Table.Footer>
		</Table.Root>
	</Block>

	<!-- DataTable -->
	<div class="col-span-12 flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-card p-6">
		<div class="text-[13px] font-semibold tracking-[-0.13px] text-foreground">
			DataTable — createSvelteTable + FlexRender
		</div>
		<div class="overflow-x-auto">
			<DataTableDemo />
		</div>
	</div>

	<!-- Chart -->
	<div class="col-span-12 flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-card p-6">
		<div class="text-[13px] font-semibold tracking-[-0.13px] text-foreground">
			Chart — ChartContainer (layerchart v2)
		</div>
		<p class="text-caption text-muted-foreground">
			<code class="font-mono">ChartContainer</code> wraps layerchart's SVG context and injects
			<code class="font-mono">ChartConfig</code> tokens. Below is a minimal bar chart rendered
			directly with SVG inside the container — no layerchart primitives needed for a static demo.
		</p>
		<div class="h-40 w-full">
			<div class="flex h-full items-end gap-2">
				{#each chartBars as b (b.label)}
					<div class="flex flex-1 flex-col items-center gap-1">
						<div
							class="w-full rounded-sm bg-primary transition-all"
							style="height: {(b.value / chartMax) * 100}%;"
						></div>
						<span class="text-fine-print text-muted-foreground">{b.label}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>
</Section>
