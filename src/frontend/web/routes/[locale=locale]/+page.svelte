<script lang="ts">
	import type { Component } from "svelte";

	import { _ } from "$frontend/i18n";
	import { client } from "$apiContract/client";
	import AppHeader from "$frontend/app-ui/shell/AppHeader.svelte";
	import UserMenu from "$frontend/app-ui/shell/UserMenu.svelte";
	import { clientConfig } from "$frontend/config/client";
	import { Button } from "$frontend/ui/button";

	import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
	import CheckIcon from "@lucide/svelte/icons/check";
	import UserIcon from "@lucide/svelte/icons/user";
	import KeyRoundIcon from "@lucide/svelte/icons/key-round";
	import WalletIcon from "@lucide/svelte/icons/wallet";
	import GiftIcon from "@lucide/svelte/icons/gift";
	import CreditCardIcon from "@lucide/svelte/icons/credit-card";
	import BellIcon from "@lucide/svelte/icons/bell";
	import MessageSquareIcon from "@lucide/svelte/icons/message-square";
	import SettingsIcon from "@lucide/svelte/icons/settings";
	import ServerIcon from "@lucide/svelte/icons/server";
	import DatabaseIcon from "@lucide/svelte/icons/database";
	import UploadIcon from "@lucide/svelte/icons/upload";
	import ListTodoIcon from "@lucide/svelte/icons/list-todo";
	import ClockIcon from "@lucide/svelte/icons/clock";
	import KeyIcon from "@lucide/svelte/icons/key";
	import TerminalIcon from "@lucide/svelte/icons/terminal";

	type AlternateUrl = {
		locale: string;
		url: string;
	};

	type PageData = {
		locale: string;
		siteName: string;
		logoUrl: string;
		canonicalUrl: string;
		alternateUrls: AlternateUrl[];
		xDefaultUrl: string;
	};

	type IconComponent = Component<{ class?: string }>;

	type IconItem = {
		key: string;
		icon: IconComponent;
	};

	type DiffRow = "r1" | "r2" | "r3" | "r4" | "r5" | "r6";
	type StepKey = "s1" | "s2" | "s3";
	type FaqKey = "q1" | "q2" | "q3" | "q4" | "q5" | "q6" | "q7";

	let {
		data,
	}: {
		data: PageData;
	} = $props();

	const session = client.auth.useSession();

	const docsBase: string = $derived(`/${data.locale}/docs`);
	const initHref: string = $derived(clientConfig.docsEnabled ? `${docsBase}/getting-started` : `/${data.locale}/register`);
	const quickStartHref: string = $derived(`${docsBase}/getting-started`);

	const techTags: string[] = ["Workers", "D1", "R2", "KV", "Queues", "Cron", "Better Auth", "Drizzle", "SvelteKit", "Hono"];

	const loopSteps: IconItem[] = [
		{ key: "register", icon: UserIcon },
		{ key: "beta", icon: KeyRoundIcon },
		{ key: "credits", icon: WalletIcon },
		{ key: "referral", icon: GiftIcon },
		{ key: "payment", icon: CreditCardIcon },
		{ key: "notification", icon: BellIcon },
		{ key: "feedback", icon: MessageSquareIcon },
		{ key: "admin", icon: SettingsIcon },
	];

	const costItems: IconItem[] = [
		{ key: "workers", icon: ServerIcon },
		{ key: "d1", icon: DatabaseIcon },
		{ key: "r2", icon: UploadIcon },
		{ key: "queues", icon: ListTodoIcon },
		{ key: "cron", icon: ClockIcon },
		{ key: "kv", icon: KeyIcon },
	];

	const diffRows: DiffRow[] = ["r1", "r2", "r3", "r4", "r5", "r6"];

	const stepsList: StepKey[] = ["s1", "s2", "s3"];

	const faqList: FaqKey[] = ["q1", "q2", "q3", "q4", "q5", "q6", "q7"];
</script>

<svelte:head>
	<title>{$_("home.seo.title")}</title>
	<meta name="description" content={$_("home.seo.description")} />
	<link rel="canonical" href={data.canonicalUrl} />
	{#each data.alternateUrls as item}
		<link rel="alternate" hreflang={item.locale} href={item.url} />
	{/each}
	<link rel="alternate" hreflang="x-default" href={data.xDefaultUrl} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={$_("home.seo.title")} />
	<meta property="og:description" content={$_("home.seo.description")} />
	<meta property="og:url" content={data.canonicalUrl} />
	<meta property="og:image" content={data.logoUrl} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={$_("home.seo.title")} />
	<meta name="twitter:description" content={$_("home.seo.description")} />
	<meta name="twitter:image" content={data.logoUrl} />
</svelte:head>

<AppHeader logoHref={`/${data.locale}`}>
	{#snippet actions()}
		{#if $session.data}
			<UserMenu onSignOut={() => {}} settingsHref={`/${data.locale}/settings`} />
		{:else if !$session.isPending}
			<Button size="sm" variant="ghost" href={`/${data.locale}/login`}>{$_("home.cta.signIn")}</Button>
		{/if}
	{/snippet}
</AppHeader>

<main class="cf-page relative w-full overflow-x-clip">
	<div class="cf-background-lines" aria-hidden="true"></div>

	<section class="relative z-10 px-3 pt-4 pb-0 md:px-6 md:pt-5">
		<div class="cf-corner-lines" aria-hidden="true"></div>
		<div class="cf-hero-panel relative mx-auto w-full max-w-[1480px] overflow-hidden rounded-2xl border px-5 pt-14 pb-6 md:px-10 md:pt-24">
			<div class="cf-hero-orbit" aria-hidden="true"></div>
			<div class="relative z-10 mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
				<div class="flex max-w-4xl flex-col gap-6">
					<span class="cf-kicker w-fit">Cloudflare-native skeleton</span>
					<h1 class="cf-hero-title flex flex-col">
						<span>{$_("home.hero.line1")}</span>
						<span>{$_("home.hero.line2")}</span>
						<span>{$_("home.hero.line3")}</span>
					</h1>
					<p class="cf-hero-copy max-w-2xl">
						{$_("home.hero.subtitle")}
					</p>
					<div class="flex flex-wrap items-center gap-3 pt-2">
						<Button size="lg" href={quickStartHref} class="cf-button cf-button-hero">{$_("home.hero.cta.init")}</Button>
					</div>
				</div>

				<div class="cf-hero-visual hidden lg:block">
					<div class="cf-global-globe" aria-hidden="true">
						<svg viewBox="0 0 420 420" focusable="false">
							<defs>
								<radialGradient id="cf-globe-core" cx="50%" cy="42%" r="62%">
									<stop offset="0%" stop-color="rgba(255,255,255,0.34)" />
									<stop offset="52%" stop-color="rgba(255,255,255,0.12)" />
									<stop offset="100%" stop-color="rgba(32,26,22,0.02)" />
								</radialGradient>
							</defs>
							<circle cx="210" cy="210" r="158" fill="url(#cf-globe-core)" />
							<g class="cf-globe-grid">
								<circle cx="210" cy="210" r="158" />
								<ellipse cx="210" cy="210" rx="158" ry="62" />
								<ellipse cx="210" cy="210" rx="158" ry="106" />
								<ellipse cx="210" cy="210" rx="54" ry="158" />
								<ellipse cx="210" cy="210" rx="104" ry="158" />
							</g>
							<g class="cf-globe-spin">
								<path d="M92 178 C144 118 248 104 326 150" />
								<path d="M80 236 C158 290 264 296 348 238" />
								<path d="M128 314 C178 250 260 208 338 194" />
								<circle cx="102" cy="178" r="4" />
								<circle cx="188" cy="122" r="4" />
								<circle cx="324" cy="150" r="5" />
								<circle cx="92" cy="238" r="4" />
								<circle cx="244" cy="292" r="5" />
								<circle cx="342" cy="238" r="4" />
							</g>
						</svg>
					</div>
					<div class="cf-hero-stack customer-browser-beam" data-active={true}>
						<div data-beam-bloom class="pointer-events-none absolute inset-0 rounded-[inherit] opacity-20"></div>
						<div class="relative z-10 flex items-center justify-between border-b border-white/18 px-4 py-3">
							<span class="font-mono text-[11px] font-semibold uppercase text-white/72">deploy graph</span>
							<span class="size-2 rounded-full bg-white"></span>
						</div>
						<div class="relative z-10 space-y-3 p-4">
							<div class="cf-hero-node cf-hero-node-inverse">
								<span>Worker</span>
								<strong>SvelteKit + Hono</strong>
							</div>
							<div class="grid grid-cols-2 gap-3">
								<div class="cf-hero-node">
									<span>Control</span>
									<strong>Meta DB</strong>
								</div>
								<div class="cf-hero-node">
									<span>Tenant</span>
									<strong>D1 Shards</strong>
								</div>
							</div>
							<div class="grid grid-cols-3 gap-3">
								<div class="cf-hero-chip">R2</div>
								<div class="cf-hero-chip">Queues</div>
								<div class="cf-hero-chip">Cron</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div class="cf-marquee-shell relative z-10 mx-auto mt-10 w-full max-w-6xl overflow-hidden rounded-full border px-3 py-2">
				<div class="cf-marquee-track flex w-max items-center gap-x-7">
					{#each techTags as tag (tag)}
						<span class="text-caption font-bold uppercase text-white">{tag}</span>
					{/each}
					{#each techTags as tag (`copy-${tag}`)}
						<span class="text-caption font-bold uppercase text-white">{tag}</span>
					{/each}
				</div>
			</div>

		</div>
	</section>

	<section class="cf-section">
		<div class="cf-section-inner">
			<div class="cf-section-head">
				<span class="cf-section-no">01</span>
				<div>
					<span class="cf-section-kicker">{$_("home.loop.eyebrow")}</span>
					<h2 class="cf-section-title">{$_("home.loop.title")}</h2>
					<p class="cf-section-copy">{$_("home.loop.subtitle")}</p>
				</div>
			</div>

			<div class="cf-carousel -mx-6 flex snap-x gap-3 overflow-x-auto px-6 pb-4" role="list">
				{#each loopSteps as step, i (step.key)}
					{@const Icon = step.icon}
					<div class="cf-product-card customer-browser-beam relative min-w-[240px] snap-start overflow-hidden rounded-2xl border p-5" role="listitem" data-active={i === 2 || i === 4 ? true : undefined}>
						<div data-beam-bloom class="pointer-events-none absolute inset-0 rounded-[inherit] opacity-20"></div>
						<div class="relative z-10 flex items-center justify-between gap-4">
							<div class="cf-card-icon">
								<Icon class="size-5 shrink-0" />
							</div>
							<span class="font-mono text-[11px] text-muted-foreground">0{i + 1}</span>
						</div>
						<div class="relative z-10 mt-9 flex items-end justify-between gap-4">
							<span class="text-[15px] font-semibold">{$_(`home.loop.step.${step.key}`)}</span>
							<ArrowRightIcon class="size-4 shrink-0 text-[#FF500A]" />
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section class="cf-section cf-warm-band">
		<div class="cf-section-inner">
			<div class="cf-section-head">
				<span class="cf-section-no">02</span>
				<div>
					<span class="cf-section-kicker">{$_("home.cost.eyebrow")}</span>
					<h2 class="cf-section-title">{$_("home.cost.title")}</h2>
					<p class="cf-section-copy">{$_("home.cost.subtitle")}</p>
				</div>
			</div>

			<div class="cf-platform-shell">
				<div class="cf-platform-topbar">
					<span>Cloudflare edge bill of materials</span>
					<span>single Worker deployment</span>
				</div>
				<div class="cf-cost-lattice">
					{#each costItems as item, i (item.key)}
						{@const Icon = item.icon}
						<div class="cf-cost-node customer-browser-beam relative overflow-hidden" data-active={i === 0 ? true : undefined}>
							<div data-beam-bloom class="pointer-events-none absolute inset-0 rounded-[inherit] opacity-20"></div>
							<div class="relative z-10 flex items-start gap-3">
								<div class="cf-card-icon">
									<Icon class="size-5 shrink-0" />
								</div>
								<span>{$_(`home.cost.${item.key}`)}</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<section class="cf-section">
		<div class="cf-section-inner">
			<div class="cf-section-head">
				<span class="cf-section-no">03</span>
				<div>
					<span class="cf-section-kicker">{$_("home.diff.eyebrow")}</span>
					<h2 class="cf-section-title">{$_("home.diff.title")}</h2>
					<p class="cf-section-copy">{$_("home.diff.subtitle")}</p>
				</div>
			</div>

			<div class="cf-compare-shell">
				<div class="cf-compare-labels">
					<span>{$_("home.diff.col.normal")}</span>
					<span>{$_("home.diff.col.opcstack")}</span>
				</div>
				<div class="cf-compare-rows">
					{#each diffRows as row (row)}
						<div class="cf-compare-row">
							<div class="cf-compare-normal">{$_(`home.diff.${row}.normal`)}</div>
							<div class="cf-compare-vs">VS</div>
							<div class="cf-compare-opc">
								<CheckIcon class="size-3.5 shrink-0 text-[#FF500A]" />
								<span>{$_(`home.diff.${row}.opcstack`)}</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<section class="cf-section">
		<div class="cf-section-inner">
			<div class="cf-section-head">
				<span class="cf-section-no">04</span>
				<div>
					<span class="cf-section-kicker">{$_("home.steps.eyebrow")}</span>
					<h2 class="cf-section-title">{$_("home.steps.title")}</h2>
					<p class="cf-section-copy">{$_("home.steps.subtitle")}</p>
				</div>
			</div>

			<div class="cf-deploy-shell">
				<ol class="cf-step-list">
					{#each stepsList as s, i (s)}
						<li>
							<span>0{i + 1}</span>
							<div>
								<h3>{$_(`home.steps.${s}.title`)}</h3>
								<p>{$_(`home.steps.${s}.desc`)}</p>
							</div>
						</li>
					{/each}
				</ol>

				<div class="cf-terminal">
					<div class="cf-terminal-top">
						<span class="bg-[#ff5f57]"></span>
						<span class="bg-[#febc2e]"></span>
						<span class="bg-[#28c840]"></span>
						<strong>
							<TerminalIcon class="size-3.5 text-[#FF500A]" />
							bash
						</strong>
					</div>
					<pre><code>git clone https://github.com/glidea/opcstack your-app
cd your-app && pnpm install
@AGENTS.md @BOOTSTRAP.md
pnpm dev  # or pnpm deploy:cloudflare</code></pre>
				</div>
			</div>
		</div>
	</section>

	<section class="cf-section cf-faq-band">
		<div class="cf-section-inner cf-faq-layout">
			<div class="cf-section-head cf-faq-head">
				<span class="cf-section-no">05</span>
				<div>
					<span class="cf-section-kicker">{$_("home.faq.eyebrow")}</span>
					<h2 class="cf-section-title">{$_("home.faq.title")}</h2>
				</div>
			</div>

			<div class="cf-faq-list">
				{#each faqList as q (q)}
					<details class="cf-faq-item">
						<summary>
							<span>{$_(`home.faq.${q}`)}</span>
							<span class="cf-faq-icon">
								<ArrowRightIcon class="size-4 shrink-0" />
							</span>
						</summary>
						<p>{$_(`home.faq.a${q.slice(1)}`)}</p>
					</details>
				{/each}
			</div>
		</div>
	</section>

	<section class="cf-final relative overflow-hidden">
		<div class="cf-final-lines" aria-hidden="true"></div>
		<div class="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 text-center">
			<span class="cf-kicker">ship on the edge</span>
			<h2 class="cf-section-title text-white">{$_("home.final.title")}</h2>
			<p class="cf-hero-copy text-white/70">{$_("home.final.subtitle")}</p>
			<div class="flex flex-wrap items-center justify-center gap-3 pt-2">
				<Button size="lg" href={initHref} class="cf-button cf-button-primary">{$_("home.final.cta.init")}</Button>
				{#if clientConfig.docsEnabled}
					<Button size="lg" variant="outline" href={docsBase} class="cf-button cf-button-dark">{$_("home.final.cta.docs")}</Button>
				{/if}
			</div>
		</div>
	</section>
</main>

<style>
	@property --customer-browser-beam-angle {
		syntax: "<angle>";
		initial-value: 0deg;
		inherits: false;
	}

	:global(.cf-button) {
		position: relative;
		isolation: isolate;
		border-radius: 10px;
		overflow: hidden;
		letter-spacing: 0;
	}

	:global(.cf-button::before) {
		position: absolute;
		z-index: 1;
		inset: -1px;
		border-radius: inherit;
		background: rgba(255, 255, 255, 0.16);
		opacity: 0;
		pointer-events: none;
		content: "";
		transition: opacity 160ms cubic-bezier(0.55, 0.085, 0.68, 0.53);
	}

	:global(.cf-button::after) {
		position: absolute;
		z-index: 2;
		inset: -1px;
		border: 1px solid currentColor;
		border-radius: inherit;
		opacity: 0;
		pointer-events: none;
		content: "";
		transition: opacity 600ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 100ms;
	}

	:global(.cf-button:hover::before) {
		opacity: 1;
	}

	:global(.cf-button:active::after) {
		opacity: 0.45;
		transition: none;
	}

	:global(.cf-button-primary) {
		border-color: #ff500a;
		background: #ff500a;
		color: white;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), inset 0 -1px 0 rgba(32, 26, 22, 0.22);
	}

	:global(.cf-button-hero) {
		border-color: rgba(255, 255, 255, 0.22);
		background: #201a16;
		color: white;
		box-shadow: 0 12px 32px rgba(32, 26, 22, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.16);
	}

	:global(.cf-button-dark) {
		border-color: rgba(255, 255, 255, 0.24);
		background: rgba(255, 255, 255, 0.06);
		color: white;
	}

	.cf-page {
		--cf-accent: #ff500a;
		--cf-accent-2: #ff9910;
		--cf-ink: #201a16;
		--cf-paper: #fffaf2;
		--cf-paper-2: #fff4e3;
		--cf-line: rgba(32, 26, 22, 0.12);
		--cf-dots: rgba(255, 80, 10, 0.13);
		background: var(--cf-paper);
		color: var(--cf-ink);
		letter-spacing: 0;
	}

	.cf-page :is(h1, h2, h3, p, span, summary, div, pre, code) {
		letter-spacing: 0;
	}

	.cf-background-lines {
		position: absolute;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		background-image:
			radial-gradient(circle at center, var(--cf-dots) 0 0.75px, transparent 0.85px),
			linear-gradient(to bottom, var(--cf-line) 50%, transparent 50%),
			linear-gradient(to bottom, var(--cf-line) 50%, transparent 50%),
			linear-gradient(to bottom, rgba(255, 80, 10, 0.16) 50%, transparent 50%),
			linear-gradient(to bottom, rgba(255, 80, 10, 0.16) 50%, transparent 50%);
		background-position:
			center top,
			calc(50% - 740px) 0,
			calc(50% + 740px) 0,
			calc(50% - 600px) 0,
			calc(50% + 600px) 0;
		background-repeat: repeat, repeat-y, repeat-y, repeat-y, repeat-y;
		background-size: 12px 12px, 1px 32px, 1px 32px, 1px 32px, 1px 32px;
		opacity: 0.9;
	}

	.cf-corner-lines {
		position: absolute;
		inset-inline: 0;
		top: 0;
		height: 1px;
		background-image: linear-gradient(to right, var(--cf-line) 50%, transparent 50%);
		background-size: 32px 1px;
		background-repeat: repeat-x;
	}

	.cf-hero-panel {
		border-color: rgba(255, 80, 10, 0.28);
		background:
			radial-gradient(circle at 76% 16%, rgba(255, 255, 255, 0.36), transparent 26%),
			linear-gradient(135deg, #ff9910 0%, #ff500a 44%, #e04305 100%);
		box-shadow: 0 28px 90px rgba(32, 26, 22, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.34);
	}

	.cf-hero-panel::before {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background-image: radial-gradient(circle at center, rgba(255, 255, 255, 0.22) 0 0.75px, transparent 0.85px);
		background-size: 12px 12px;
		content: "";
		opacity: 0.45;
	}

	.cf-hero-orbit {
		position: absolute;
		right: -90px;
		bottom: -160px;
		width: 640px;
		aspect-ratio: 1;
		border: 1px dashed rgba(255, 255, 255, 0.34);
		border-radius: 999px;
		box-shadow: 0 0 0 88px rgba(255, 255, 255, 0.05), 0 0 0 176px rgba(255, 255, 255, 0.04);
	}

	.cf-kicker,
	.cf-section-kicker {
		border: 1px solid rgba(255, 80, 10, 0.24);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.72);
		padding: 5px 10px;
		color: var(--cf-accent);
		font-size: 11px;
		font-weight: 800;
		line-height: 1;
		text-transform: uppercase;
	}

	.cf-hero-title {
		color: white;
		font-size: clamp(42px, 8vw, 92px);
		font-weight: 850;
		line-height: 0.95;
		text-wrap: balance;
	}

	.cf-hero-copy {
		color: rgba(255, 255, 255, 0.8);
		font-size: clamp(16px, 2vw, 20px);
		font-weight: 500;
		line-height: 1.55;
	}

	.cf-hero-visual {
		position: relative;
		min-height: 360px;
		display: flex;
		align-items: flex-end;
	}

	.cf-global-globe {
		position: absolute;
		top: -118px;
		right: -112px;
		width: 472px;
		height: 472px;
		opacity: 0.68;
		filter: drop-shadow(0 24px 52px rgba(32, 26, 22, 0.18));
	}

	.cf-global-globe svg {
		width: 100%;
		height: 100%;
		overflow: visible;
	}

	.cf-globe-grid circle,
	.cf-globe-grid ellipse {
		fill: none;
		stroke: rgba(255, 255, 255, 0.36);
		stroke-width: 1;
		stroke-dasharray: 6 8;
		vector-effect: non-scaling-stroke;
	}

	.cf-globe-spin {
		transform-origin: 210px 210px;
		animation: cf-globe-spin 24s linear infinite;
	}

	.cf-globe-spin path {
		fill: none;
		stroke: rgba(255, 255, 255, 0.62);
		stroke-width: 1.4;
		stroke-dasharray: 12 10;
		vector-effect: non-scaling-stroke;
	}

	.cf-globe-spin circle {
		fill: white;
		filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.72));
	}

	.cf-hero-stack {
		position: relative;
		z-index: 2;
		width: 100%;
		min-height: 320px;
		border: 1px solid rgba(255, 255, 255, 0.22);
		border-radius: 18px;
		background: rgba(32, 26, 22, 0.22);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 18px 54px rgba(32, 26, 22, 0.18);
		backdrop-filter: blur(18px);
	}

	.cf-hero-node,
	.cf-hero-chip {
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.12);
		padding: 14px;
		color: white;
	}

	.cf-hero-node span {
		display: block;
		color: rgba(255, 255, 255, 0.6);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
	}

	.cf-hero-node strong {
		display: block;
		margin-top: 4px;
		font-size: 16px;
	}

	.cf-hero-node-inverse {
		background: white;
		color: var(--cf-ink);
	}

	.cf-hero-node-inverse span {
		color: rgba(32, 26, 22, 0.54);
	}

	.cf-hero-chip {
		padding: 12px 8px;
		text-align: center;
		font-size: 12px;
		font-weight: 800;
	}

	.cf-marquee-shell {
		border-color: rgba(255, 255, 255, 0.3);
		background: rgba(255, 255, 255, 0.16);
		backdrop-filter: blur(14px);
	}

	.cf-marquee-track {
		animation: cf-marquee 24s linear infinite;
	}

	.cf-section {
		position: relative;
		z-index: 10;
		padding: clamp(72px, 8vw, 112px) 24px;
	}

	.cf-section-inner {
		width: 100%;
		max-width: 1152px;
		margin-inline: auto;
	}

	.cf-section-head {
		display: flex;
		max-width: 820px;
		align-items: flex-start;
		gap: 24px;
		margin-bottom: 44px;
	}

	.cf-section-no {
		flex: none;
		color: var(--cf-accent);
		font-size: clamp(40px, 5vw, 64px);
		font-weight: 850;
		line-height: 0.9;
	}

	.cf-section-title {
		margin-top: 12px;
		font-size: clamp(30px, 4vw, 52px);
		font-weight: 780;
		line-height: 1.04;
		text-wrap: balance;
	}

	.cf-section-copy {
		max-width: 680px;
		margin-top: 14px;
		color: rgba(32, 26, 22, 0.62);
		font-size: 18px;
		line-height: 1.55;
	}

	.cf-carousel {
		scrollbar-width: none;
	}

	.cf-carousel::-webkit-scrollbar {
		display: none;
	}

	.cf-product-card,
	.cf-cost-node {
		border-color: rgba(32, 26, 22, 0.1);
		background: rgba(255, 255, 255, 0.86);
		box-shadow: 0 1px 0 rgba(255, 255, 255, 0.8), 0 14px 42px rgba(32, 26, 22, 0.08);
	}

	.cf-product-card {
		min-height: 162px;
		transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1), border-color 240ms ease;
	}

	.cf-product-card:hover {
		transform: translateY(-3px);
		border-color: rgba(255, 80, 10, 0.3);
	}

	.cf-card-icon {
		display: flex;
		width: 42px;
		height: 42px;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		background: rgba(255, 80, 10, 0.1);
		color: var(--cf-accent);
	}

	.cf-warm-band {
		border-block: 1px solid rgba(255, 80, 10, 0.14);
		background: linear-gradient(180deg, rgba(255, 244, 227, 0.92), rgba(255, 250, 242, 0.94));
	}

	.cf-platform-shell,
	.cf-compare-shell,
	.cf-deploy-shell {
		overflow: hidden;
		border: 1px solid rgba(32, 26, 22, 0.1);
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.82);
		box-shadow: 0 24px 74px rgba(32, 26, 22, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.82);
	}

	.cf-platform-topbar {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		border-bottom: 1px dashed rgba(32, 26, 22, 0.14);
		padding: 14px 18px;
		color: rgba(32, 26, 22, 0.58);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 11px;
		text-transform: uppercase;
	}

	.cf-cost-lattice {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1px;
		background:
			linear-gradient(to right, rgba(255, 80, 10, 0.13) 50%, transparent 50%) center/32px 1px repeat-x,
			rgba(32, 26, 22, 0.08);
		padding: 1px;
	}

	.cf-cost-node {
		min-height: 124px;
		border-radius: 0;
		padding: 22px;
		font-size: 15px;
		font-weight: 650;
		line-height: 1.35;
	}

	.cf-compare-labels {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		border-bottom: 1px dashed rgba(32, 26, 22, 0.14);
		padding: 16px 22px;
		color: rgba(32, 26, 22, 0.58);
		font-size: 12px;
		font-weight: 800;
		text-transform: uppercase;
	}

	.cf-compare-labels span:last-child {
		color: var(--cf-accent);
	}

	.cf-compare-rows {
		position: relative;
		padding: 12px;
	}

	.cf-compare-rows::before {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 1px;
		background-image: linear-gradient(to bottom, rgba(255, 80, 10, 0.28) 50%, transparent 50%);
		background-size: 1px 18px;
		content: "";
	}

	.cf-compare-row {
		position: relative;
		z-index: 1;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 48px minmax(0, 1fr);
		align-items: stretch;
		gap: 12px;
		padding: 5px 0;
	}

	.cf-compare-normal,
	.cf-compare-opc {
		display: flex;
		min-height: 54px;
		align-items: center;
		border-radius: 12px;
		padding: 14px 16px;
		font-size: 13px;
		line-height: 1.4;
	}

	.cf-compare-normal {
		border: 1px solid rgba(32, 26, 22, 0.08);
		background: rgba(32, 26, 22, 0.04);
		color: rgba(32, 26, 22, 0.62);
	}

	.cf-compare-opc {
		gap: 8px;
		background: rgba(255, 221, 153, 0.34);
		color: var(--cf-ink);
		font-weight: 650;
	}

	.cf-compare-vs {
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgba(32, 26, 22, 0.34);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 11px;
		font-weight: 800;
	}

	.cf-deploy-shell {
		display: grid;
		grid-template-columns: minmax(0, 0.84fr) minmax(0, 1.16fr);
	}

	.cf-step-list {
		position: relative;
		margin: 0;
		padding: 24px;
		list-style: none;
	}

	.cf-step-list::before {
		position: absolute;
		top: 36px;
		bottom: 36px;
		left: 45px;
		width: 1px;
		background-image: linear-gradient(to bottom, rgba(255, 80, 10, 0.34) 50%, transparent 50%);
		background-size: 1px 18px;
		content: "";
	}

	.cf-step-list li {
		position: relative;
		display: grid;
		grid-template-columns: 44px minmax(0, 1fr);
		gap: 16px;
		padding: 16px 0;
	}

	.cf-step-list li > span {
		z-index: 1;
		display: flex;
		width: 42px;
		height: 42px;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(255, 80, 10, 0.2);
		border-radius: 999px;
		background: var(--cf-paper);
		color: var(--cf-accent);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 12px;
		font-weight: 850;
	}

	.cf-step-list h3 {
		font-size: 17px;
		font-weight: 760;
	}

	.cf-step-list p {
		margin-top: 5px;
		color: rgba(32, 26, 22, 0.6);
		font-size: 13px;
		line-height: 1.5;
	}

	.cf-terminal {
		border-left: 1px solid rgba(32, 26, 22, 0.1);
		background: #15110f;
	}

	.cf-terminal-top {
		display: flex;
		align-items: center;
		gap: 8px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		padding: 12px 14px;
	}

	.cf-terminal-top > span {
		width: 10px;
		height: 10px;
		border-radius: 999px;
	}

	.cf-terminal-top strong {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-left: 6px;
		color: rgba(255, 255, 255, 0.58);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 11px;
	}

	.cf-terminal pre {
		margin: 0;
		overflow-x: auto;
		padding: 24px;
		color: rgba(255, 255, 255, 0.72);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 13px;
		line-height: 1.8;
	}

	.cf-faq-band {
		border-top: 1px dashed rgba(32, 26, 22, 0.14);
	}

	.cf-faq-layout {
		display: grid;
		grid-template-columns: minmax(260px, 0.42fr) minmax(0, 1fr);
		gap: 44px;
	}

	.cf-faq-head {
		position: sticky;
		top: 88px;
		display: flex;
		align-self: start;
		margin-bottom: 0;
	}

	.cf-faq-list {
		border-top: 1px solid rgba(32, 26, 22, 0.12);
	}

	.cf-faq-item {
		border-bottom: 1px solid rgba(32, 26, 22, 0.12);
	}

	.cf-faq-item summary {
		display: flex;
		cursor: pointer;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 20px 0;
		font-size: 16px;
		font-weight: 720;
		list-style: none;
	}

	.cf-faq-item summary::-webkit-details-marker {
		display: none;
	}

	.cf-faq-item p {
		max-width: 760px;
		padding: 0 40px 22px 0;
		color: rgba(32, 26, 22, 0.62);
		font-size: 14px;
		line-height: 1.65;
	}

	.cf-faq-icon {
		color: var(--cf-accent);
		transition: transform 180ms ease;
	}

	.cf-faq-item[open] .cf-faq-icon {
		transform: rotate(90deg);
	}

	.cf-final {
		padding: clamp(88px, 10vw, 140px) 24px;
		background:
			radial-gradient(circle at 50% -30%, rgba(255, 153, 16, 0.28), transparent 36%),
			var(--cf-ink);
	}

	.cf-final-lines {
		position: absolute;
		inset: 0;
		background-image:
			radial-gradient(circle at center, rgba(255, 153, 16, 0.18) 0 0.75px, transparent 0.85px),
			linear-gradient(to right, rgba(255, 255, 255, 0.14) 50%, transparent 50%);
		background-size: 12px 12px, 32px 1px;
		opacity: 0.55;
	}

	.customer-browser-beam::before,
	.customer-browser-beam::after,
	.customer-browser-beam [data-beam-bloom] {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		content: "";
		pointer-events: none;
	}

	.customer-browser-beam[data-active]::after {
		padding: 3px;
		background: conic-gradient(from var(--customer-browser-beam-angle), transparent 0%, transparent 16%, rgba(255, 80, 10, 0.12) 24%, rgba(255, 80, 10, 0.48) 34%, #ff500a 44%, #ff9910 70%, rgba(255, 80, 10, 0.48) 82%, transparent 100%);
		mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
		mask-composite: exclude;
		animation: customer-browser-beam-sweep 4.5s linear infinite;
	}

	.customer-browser-beam[data-active]::before {
		box-shadow: inset 0 0 18px 2px rgba(255, 80, 10, 0.18);
	}

	.customer-browser-beam[data-active] [data-beam-bloom] {
		background: conic-gradient(from var(--customer-browser-beam-angle), transparent 0%, transparent 20%, rgba(255, 80, 10, 0.38), transparent 74%);
		filter: blur(22px);
		animation: customer-browser-beam-sweep 4.5s linear infinite;
	}

	@keyframes customer-browser-beam-sweep {
		to {
			--customer-browser-beam-angle: 360deg;
		}
	}

	@keyframes cf-marquee {
		to {
			transform: translateX(-50%);
		}
	}

	@keyframes cf-globe-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 900px) {
		.cf-background-lines {
			background-position:
				center top,
				calc(50% - 360px) 0,
				calc(50% + 360px) 0,
				calc(50% - 280px) 0,
				calc(50% + 280px) 0;
		}

		.cf-section-head,
		.cf-faq-head {
			gap: 16px;
		}

		.cf-cost-lattice,
		.cf-deploy-shell,
		.cf-faq-layout {
			grid-template-columns: 1fr;
		}

		.cf-terminal {
			border-top: 1px solid rgba(32, 26, 22, 0.1);
			border-left: 0;
		}

		.cf-faq-head {
			position: static;
		}
	}

	@media (max-width: 640px) {
		.cf-section {
			padding-inline: 16px;
		}

		.cf-section-head {
			flex-direction: column;
		}

		.cf-hero-panel {
			padding-inline: 20px;
		}

		.cf-hero-title {
			font-size: clamp(40px, 13vw, 58px);
		}

		.cf-cost-lattice {
			grid-template-columns: 1fr;
		}

		.cf-platform-topbar,
		.cf-compare-labels {
			display: none;
		}

		.cf-compare-row {
			grid-template-columns: 1fr;
			gap: 8px;
		}

		.cf-compare-rows::before,
		.cf-compare-vs {
			display: none;
		}

		.cf-compare-opc {
			border: 1px solid rgba(255, 80, 10, 0.14);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.cf-marquee-track,
		.cf-globe-spin,
		.customer-browser-beam[data-active]::after,
		.customer-browser-beam[data-active] [data-beam-bloom] {
			animation: none;
		}
	}
</style>
