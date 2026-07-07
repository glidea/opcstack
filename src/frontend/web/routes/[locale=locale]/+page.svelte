<script lang="ts">
	import type { Component } from "svelte";
	import { onMount } from "svelte";

	import { _ } from "$frontend/i18n";
	import { client } from "$apiContract/client";
	import LandingHeader from "./LandingHeader.svelte";
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

	type DiffRow = "r1" | "r2" | "r3" | "r5" | "r6";
	type StepKey = "s1" | "s2" | "s3";
	type FaqKey = "q1" | "q2" | "q3" | "q4" | "q5" | "q6" | "q7";

	let {
		data,
	}: {
		data: PageData;
	} = $props();

	const session = client.auth.useSession();

	onMount((): (() => void) => {
		const root: HTMLElement = document.documentElement;
		const hadDarkClass: boolean = root.classList.contains("dark");
		const previousColorScheme: string = root.style.colorScheme;
		const previousThemeMode: string | undefined = root.dataset["themeMode"];

		root.classList.remove("dark");
		root.style.colorScheme = "light";
		root.dataset["themeMode"] = "light";

		return (): void => {
			root.classList.toggle("dark", hadDarkClass);
			root.style.colorScheme = previousColorScheme;
			if (previousThemeMode === undefined) {
				delete root.dataset["themeMode"];
				return;
			}
			root.dataset["themeMode"] = previousThemeMode;
		};
	});

	const docsBase: string = $derived(`/${data.locale}/docs`);
	const quickStartHref: string = $derived(`${docsBase}/getting-started`);

	const techTags: string[] = [
		"Workers",
		"D1",
		"R2",
		"KV",
		"Queues",
		"Cron",
		"Better Auth",
		"Drizzle",
		"SvelteKit",
		"Hono",
	];

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

	// Pricing rows aligned with README Cloudflare pricing table
	const priceRows: string[] = [
		"workers",
		"d1",
		"r2",
		"kv",
		"queues",
		"cron",
		"cdn",
	];

	const diffRows: DiffRow[] = ["r1", "r2", "r3", "r5", "r6"];

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

<LandingHeader locale={data.locale} />

<main class="cf-page relative w-full overflow-x-clip">
	<div class="cf-background-lines" aria-hidden="true"></div>

	<section
		class="relative z-10 px-4 pt-[76px] pb-0 sm:px-6 md:px-10 md:pt-20 xl:px-14"
	>
		<div class="cf-corner-lines" aria-hidden="true"></div>
		<div
			class="cf-hero-panel relative mx-auto w-full max-w-[1480px] overflow-hidden rounded-2xl border px-5 pt-14 pb-6 md:px-10 md:pt-24"
		>
			<div
				class="relative z-10 mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end"
			>
				<div class="flex max-w-4xl flex-col gap-6">
					<span class="cf-kicker w-fit"
						>Cloudflare-native skeleton</span
					>
					<h1 class="cf-hero-title flex flex-col">
						<span
							>{$_("home.hero.line1.pre")}<span
								class="cf-hero-mark"
								>{$_("home.hero.line1.mark")}</span
							></span
						>
						<span
							>{$_("home.hero.line2.pre")}<span
								class="cf-hero-mark"
								>{$_("home.hero.line2.mark")}</span
							></span
						>
						<span
							><span class="cf-hero-mark"
								>{$_("home.hero.line3.mark")}</span
							></span
						>
					</h1>
					<p class="cf-hero-copy max-w-2xl">
						{$_("home.hero.subtitle")}
					</p>
					<div class="flex flex-wrap items-center gap-3 pt-2">
						<Button
							size="lg"
							href={quickStartHref}
							class="cf-button cf-button-hero"
							>{$_("home.hero.cta.init")}</Button
						>
					</div>
				</div>

				<div class="cf-hero-visual hidden lg:block">
					<div class="cf-global-globe" aria-hidden="true">
						<svg viewBox="0 0 420 420" focusable="false">
							<defs>
								<radialGradient
									id="cf-globe-core"
									cx="50%"
									cy="42%"
									r="62%"
								>
									<stop
										offset="0%"
										stop-color="rgba(255,255,255,0.34)"
									/>
									<stop
										offset="52%"
										stop-color="rgba(255,255,255,0.12)"
									/>
									<stop
										offset="100%"
										stop-color="rgba(32,26,22,0.02)"
									/>
								</radialGradient>
							</defs>
							<circle
								cx="210"
								cy="210"
								r="158"
								fill="url(#cf-globe-core)"
							/>
							<g class="cf-globe-grid">
								<circle class="cf-globe-edge" cx="210" cy="210" r="158" />
								<ellipse cx="210" cy="210" rx="158" ry="60" />
								<ellipse cx="210" cy="210" rx="158" ry="112" />
								<ellipse cx="210" cy="210" rx="56" ry="158" />
								<ellipse cx="210" cy="210" rx="112" ry="158" />
							</g>
							<g class="cf-globe-spin">
								<path class="cf-globe-arc" d="M110 172 Q130 110 206 100" />
								<path class="cf-globe-arc" d="M206 100 Q300 96 320 156" />
								<path class="cf-globe-arc" d="M320 156 Q360 224 300 292" />
								<path class="cf-globe-arc" d="M110 172 Q96 244 150 300" />
								<circle class="cf-globe-node" cx="110" cy="172" r="4.5" />
								<circle class="cf-globe-node" cx="206" cy="100" r="5.5" />
								<circle class="cf-globe-node" cx="320" cy="156" r="4.5" />
								<circle class="cf-globe-node" cx="300" cy="292" r="4" />
								<circle class="cf-globe-node" cx="150" cy="300" r="5" />
							</g>
							<g class="cf-globe-anchor">
								<circle
									class="cf-globe-anchor-ring"
									cx="168"
									cy="296"
									r="15"
								/>
								<circle
									class="cf-globe-anchor-dot"
									cx="168"
									cy="296"
									r="5"
								/>
							</g>
						</svg>
					</div>
					<div class="cf-hero-landing" aria-hidden="true"></div>
					<div
						class="cf-hero-stack customer-browser-beam"
						data-active={true}
					>
						<div
							data-beam-bloom
							class="pointer-events-none absolute inset-0 rounded-[inherit] opacity-20"
						></div>
						<div
							class="relative z-10 flex items-center justify-between border-b border-white/18 px-4 py-3"
						>
							<span
								class="font-mono text-[11px] font-semibold uppercase text-white/72"
								>deploy graph</span
							>
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

			<div
				class="cf-marquee-shell relative z-10 mx-auto mt-10 w-full max-w-6xl overflow-hidden rounded-full border px-3 py-2"
			>
				<div class="cf-marquee-track flex w-max items-center gap-x-7">
					{#each techTags as tag (tag)}
						<span
							class="text-caption font-bold uppercase text-white"
							>{tag}</span
						>
					{/each}
					{#each techTags as tag (`copy-${tag}`)}
						<span
							class="text-caption font-bold uppercase text-white"
							>{tag}</span
						>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<section id="loop" class="cf-section">
		<div class="cf-section-inner">
			<div class="cf-section-head cf-section-head-metric">
				<span class="cf-section-no">01</span>
				<div class="cf-section-head-text">
					<span class="cf-section-kicker"
						>{$_("home.loop.eyebrow")}</span
					>
					<h2 class="cf-section-title">{$_("home.loop.title")}</h2>
					<p class="cf-section-copy">{$_("home.loop.subtitle")}</p>
				</div>
				<div class="cf-section-metric">
					<strong>{$_("home.loop.metric.value")}</strong>
					<span>{$_("home.loop.metric.label")}</span>
				</div>
			</div>

			<div
				class="cf-loop-grid grid grid-cols-2 gap-px lg:grid-cols-4"
				role="list"
			>
				{#each loopSteps as step, i (step.key)}
					{@const Icon = step.icon}
					<div
						class="cf-loop-cell customer-browser-beam relative flex flex-col p-5"
						role="listitem"
						data-active={i === 2 || i === 4 ? true : undefined}
					>
						<div
							data-beam-bloom
							class="pointer-events-none absolute inset-0 opacity-20"
						></div>
						<div
							class="relative z-10 flex items-center justify-between gap-3"
						>
							<div class="cf-card-icon">
								<Icon class="size-5 shrink-0" />
							</div>
							<span class="cf-ready-badge">
								<CheckIcon class="size-3 shrink-0" />
								{$_("home.loop.ready")}
							</span>
						</div>
						<div class="relative z-10 mt-6">
							<span class="block text-[15px] font-semibold"
								>{$_(`home.loop.step.${step.key}`)}</span
							>
							<span
								class="mt-1 block text-[13px] leading-snug text-muted-foreground"
								>{$_(`home.loop.step.${step.key}.desc`)}</span
							>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section id="cost" class="cf-section cf-warm-band">
		<div class="cf-section-inner">
			<div class="cf-section-head cf-section-head-metric">
				<span class="cf-section-no">02</span>
				<div class="cf-section-head-text">
					<span class="cf-section-kicker"
						>{$_("home.cost.eyebrow")}</span
					>
					<h2 class="cf-section-title">{$_("home.cost.title")}</h2>
				</div>
				<div class="cf-section-metric">
					<strong>{$_("home.cost.metric.value")}</strong>
					<span>{$_("home.cost.metric.label")}</span>
				</div>
			</div>

			<div class="cf-cost-case">
				<div class="cf-cost-case-side cf-cost-case-before">
					<span class="cf-cost-case-tag">Vercel + Supabase</span>
					<strong>{$_("home.cost.case.before")}</strong>
					<div class="cf-cost-bar cf-cost-bar-before">
						<span></span>
					</div>
					<span class="cf-cost-case-note"
						>{$_("home.cost.case.beforeNote")}</span
					>
				</div>
				<div class="cf-cost-case-arrow" aria-hidden="true">
					<ArrowRightIcon class="size-5 shrink-0" />
				</div>
				<div
					class="cf-cost-case-side cf-cost-case-after customer-browser-beam relative overflow-hidden"
					data-active={true}
				>
					<div
						data-beam-bloom
						class="pointer-events-none absolute inset-0 rounded-[inherit] opacity-20"
					></div>
					<div class="relative z-10 flex flex-col">
						<span class="cf-cost-case-tag">Cloudflare Workers</span>
						<strong>{$_("home.cost.case.after")}</strong>
						<div class="cf-cost-bar cf-cost-bar-after">
							<span></span>
						</div>
						<span class="cf-cost-case-note"
							>{$_("home.cost.case.afterNote")}</span
						>
					</div>
				</div>
			</div>

			<details class="cf-price-details">
				<summary class="cf-price-summary"
					>{$_("home.cost.price.expand")}</summary
				>
				<div class="cf-price-shell">
					<div class="cf-price-topbar">
						<span>{$_("home.cost.price.product")}</span>
						<span>{$_("home.cost.price.free")}</span>
						<span>{$_("home.cost.price.paid")}</span>
					</div>
					{#each priceRows as row (row)}
						<div class="cf-price-row">
							<span class="cf-price-product"
								>{$_(`home.cost.price.${row}.name`)}</span
							>
							<span
								class="cf-price-cell"
								data-label={$_("home.cost.price.free")}
								>{$_(`home.cost.price.${row}.free`)}</span
							>
							<span
								class="cf-price-cell"
								data-label={$_("home.cost.price.paid")}
								>{$_(`home.cost.price.${row}.paid`)}</span
							>
						</div>
					{/each}
					<div class="cf-price-foot">
						{$_("home.cost.price.note")}
					</div>
				</div>
			</details>
		</div>
	</section>

	<section id="diff" class="cf-section">
		<div class="cf-section-inner">
			<div class="cf-section-head cf-section-head-metric">
				<span class="cf-section-no">03</span>
				<div class="cf-section-head-text">
					<span class="cf-section-kicker"
						>{$_("home.diff.eyebrow")}</span
					>
					<h2 class="cf-section-title">{$_("home.diff.title")}</h2>
				</div>
				<div class="cf-section-metric">
					<strong>{$_("home.diff.metric.value")}</strong>
					<span>{$_("home.diff.metric.label")}</span>
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
							<div
								class="cf-compare-normal"
								data-label={$_("home.diff.col.normal")}
							>
								{$_(`home.diff.${row}.normal`)}
							</div>
							<div class="cf-compare-vs">VS</div>
							<div
								class="cf-compare-opc"
								data-label={$_("home.diff.col.opcstack")}
							>
								<CheckIcon
									class="size-3.5 shrink-0 text-[#FF500A]"
								/>
								<span>{$_(`home.diff.${row}.opcstack`)}</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<section id="steps" class="cf-section">
		<div class="cf-section-inner">
			<div class="cf-section-head">
				<span class="cf-section-no">04</span>
				<div>
					<span class="cf-section-kicker"
						>{$_("home.steps.eyebrow")}</span
					>
					<h2 class="cf-section-title">{$_("home.steps.title")}</h2>
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
					<pre><code
							>git clone https://github.com/glidea/opcstack your-app
cd your-app && pnpm install
@AGENTS.md @BOOTSTRAP.md
pnpm dev  # or pnpm deploy:cloudflare</code
						></pre>
				</div>
			</div>
		</div>
	</section>

	<section id="faq" class="cf-section cf-faq-band">
		<div class="cf-section-inner cf-faq-layout">
			<div class="cf-section-head cf-faq-head">
				<span class="cf-section-no">05</span>
				<div>
					<span class="cf-section-kicker"
						>{$_("home.faq.eyebrow")}</span
					>
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
		<div
			class="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 text-center"
		>
			<span class="cf-kicker">ship on the edge</span>
			<h2 class="cf-section-title text-white">
				{$_("home.final.title")}
			</h2>
			<p class="cf-hero-copy text-white/70">
				{$_("home.final.subtitle")}
			</p>
			<div class="flex flex-wrap items-center justify-center gap-3 pt-2">
				<Button
					size="lg"
					href={quickStartHref}
					class="cf-button cf-button-primary"
					>{$_("home.hero.cta.init")}</Button
				>
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
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.28),
			inset 0 -1px 0 rgba(32, 26, 22, 0.22);
	}

	:global(.cf-button-hero) {
		border-color: rgba(255, 255, 255, 0.9);
		background: #fffaf2;
		color: #ff500a;
		font-weight: 700;
		box-shadow:
			0 14px 34px rgba(32, 26, 22, 0.28),
			inset 0 1px 0 rgba(255, 255, 255, 0.9);
	}

	:global(.cf-button-hero::before) {
		background: rgba(32, 26, 22, 0.06);
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
		--cf-paper: #ffffff;
		--cf-paper-2: #f7f5f1;
		--cf-line: rgba(32, 26, 22, 0.12);
		--cf-dots: rgba(32, 26, 22, 0.09);
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
		background-image: radial-gradient(
				circle at center,
				var(--cf-dots) 0 0.75px,
				transparent 0.85px
			),
			linear-gradient(to bottom, var(--cf-line) 50%, transparent 50%),
			linear-gradient(to bottom, var(--cf-line) 50%, transparent 50%),
			linear-gradient(
				to bottom,
				rgba(255, 80, 10, 0.07) 50%,
				transparent 50%
			),
			linear-gradient(
				to bottom,
				rgba(255, 80, 10, 0.07) 50%,
				transparent 50%
			);
		background-position:
			center top,
			calc(50% - 740px) 0,
			calc(50% + 740px) 0,
			calc(50% - 600px) 0,
			calc(50% + 600px) 0;
		background-repeat: repeat, repeat-y, repeat-y, repeat-y, repeat-y;
		background-size:
			12px 12px,
			1px 32px,
			1px 32px,
			1px 32px,
			1px 32px;
		opacity: 0.9;
	}

	.cf-corner-lines {
		position: absolute;
		inset-inline: 0;
		top: 0;
		height: 1px;
		background-image: linear-gradient(
			to right,
			var(--cf-line) 50%,
			transparent 50%
		);
		background-size: 32px 1px;
		background-repeat: repeat-x;
	}

	.cf-hero-panel {
		border-color: rgba(255, 80, 10, 0.28);
		background: radial-gradient(
				circle at 76% 16%,
				rgba(255, 255, 255, 0.36),
				transparent 26%
			),
			linear-gradient(135deg, #ff9910 0%, #ff500a 44%, #e04305 100%);
		box-shadow:
			0 28px 90px rgba(32, 26, 22, 0.18),
			inset 0 1px 0 rgba(255, 255, 255, 0.34);
	}

	.cf-hero-panel::before {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background-image: radial-gradient(
			circle at center,
			rgba(255, 255, 255, 0.22) 0 0.75px,
			transparent 0.85px
		);
		background-size: 12px 12px;
		content: "";
		opacity: 0.45;
	}

	.cf-kicker {
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

	.cf-section-kicker {
		color: var(--cf-accent);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
			monospace;
		font-size: 12px;
		font-weight: 760;
		line-height: 1;
		text-transform: uppercase;
	}

	.cf-hero-title {
		color: white;
		font-size: clamp(42px, 8vw, 92px);
		font-weight: 850;
		line-height: 1.08;
		text-wrap: balance;
	}

	/* Understated underline accent beneath the key promise word */
	.cf-hero-mark {
		position: relative;
		display: inline-block;
		color: #fff;
		white-space: nowrap;
	}

	.cf-hero-mark::after {
		content: "";
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0.02em;
		height: 0.08em;
		border-radius: 999px;
		background: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0.95),
			rgba(255, 234, 210, 0.7)
		);
		box-shadow: 0 1px 8px rgba(255, 255, 255, 0.4);
		transform-origin: left center;
		animation: cf-hero-mark-underline 0.6s cubic-bezier(0.22, 1, 0.36, 1)
			0.25s both;
	}

	@keyframes cf-hero-mark-underline {
		from {
			transform: scaleX(0);
			opacity: 0;
		}
		to {
			transform: scaleX(1);
			opacity: 1;
		}
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
		right: -60px;
		bottom: -60px;
		width: 1400px;
		height: 1400px;
		opacity: 0.9;
		filter: drop-shadow(0 24px 56px rgba(32, 26, 22, 0.16));
	}

	.cf-global-globe svg {
		width: 100%;
		height: 100%;
		overflow: visible;
	}

	.cf-globe-grid circle,
	.cf-globe-grid ellipse {
		fill: none;
		stroke: rgba(255, 255, 255, 0.4);
		stroke-width: 1;
		stroke-dasharray: 6 8;
		vector-effect: non-scaling-stroke;
	}

	/* crisp bright rim gives the sphere a defined, confident edge */
	.cf-globe-edge {
		stroke: rgba(255, 255, 255, 0.85);
		stroke-width: 1.6;
		stroke-dasharray: none;
	}

	.cf-globe-spin {
		transform-origin: 210px 210px;
		animation: cf-globe-spin 30s linear infinite;
	}

	/* flight routes with a flowing dash to read as live traffic */
	.cf-globe-arc {
		fill: none;
		stroke: rgba(255, 255, 255, 0.7);
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-dasharray: 10 12;
		vector-effect: non-scaling-stroke;
		animation: cf-globe-flow 2.4s linear infinite;
	}

	/* glowing edge nodes, each breathing on its own offset */
	.cf-globe-node {
		fill: white;
		filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.85));
		animation: cf-globe-node-pulse 2.8s ease-in-out infinite;
	}

	.cf-globe-node:nth-of-type(2) {
		animation-delay: 0.5s;
	}

	.cf-globe-node:nth-of-type(3) {
		animation-delay: 1s;
	}

	.cf-globe-node:nth-of-type(4) {
		animation-delay: 1.5s;
	}

	.cf-globe-node:nth-of-type(5) {
		animation-delay: 2s;
	}

	/* static docking anchor where the card meets the sphere */
	.cf-globe-anchor-ring {
		fill: none;
		stroke: rgba(255, 255, 255, 0.9);
		stroke-width: 1.6;
		transform-origin: 168px 296px;
		animation: cf-globe-ping 2.6s ease-out infinite;
	}

	.cf-globe-anchor-dot {
		fill: white;
		filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.95));
	}

	/* soft warm glow under the card's docking corner */
	.cf-hero-landing {
		position: absolute;
		left: -40px;
		bottom: 24px;
		width: 300px;
		height: 300px;
		border-radius: 999px;
		background: radial-gradient(
			circle,
			rgba(255, 255, 255, 0.28) 0%,
			rgba(255, 255, 255, 0) 68%
		);
		pointer-events: none;
		z-index: 1;
	}

	.cf-hero-stack {
		position: relative;
		z-index: 2;
		width: 100%;
		min-height: 320px;
		border: 1px solid rgba(255, 255, 255, 0.22);
		border-radius: 18px;
		background: rgba(32, 26, 22, 0.22);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.2),
			0 18px 54px rgba(32, 26, 22, 0.18);
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
		padding-block: clamp(80px, 9vw, 132px);
		padding-inline: clamp(32px, 4vw, 72px);
		/* offset for the floating capsule header on anchor jumps */
		scroll-margin-top: 88px;
	}

	.cf-section-inner {
		width: 100%;
		max-width: 1480px;
		margin-inline: auto;
	}

	.cf-section-head {
		display: flex;
		max-width: none;
		align-items: flex-end;
		gap: 24px;
		margin-bottom: 34px;
		border-top: 1px dashed rgba(32, 26, 22, 0.16);
		border-bottom: 1px dashed rgba(32, 26, 22, 0.16);
		padding: 24px 0;
	}

	.cf-section-no {
		flex: none;
		display: flex;
		width: 44px;
		height: 44px;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(255, 80, 10, 0.22);
		border-radius: 10px;
		background: rgba(255, 80, 10, 0.06);
		color: var(--cf-accent);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
			monospace;
		font-size: 13px;
		font-weight: 850;
		line-height: 1;
	}

	.cf-section-title {
		margin-top: 10px;
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

	.cf-section-head-metric {
		max-width: none;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
	}

	.cf-section-head-text {
		flex: 1 1 420px;
		min-width: 0;
	}

	.cf-section-metric {
		display: flex;
		flex: none;
		flex-direction: column;
		align-items: flex-end;
		padding-left: 24px;
		border-left: 1px dashed rgba(255, 80, 10, 0.28);
		text-align: right;
	}

	.cf-section-metric strong {
		color: var(--cf-accent);
		font-size: clamp(32px, 4vw, 48px);
		font-weight: 850;
		line-height: 1;
	}

	.cf-section-metric span {
		margin-top: 8px;
		color: rgba(32, 26, 22, 0.58);
		font-size: 13px;
		font-weight: 600;
	}

	.cf-cost-case {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: stretch;
		gap: 0;
		overflow: hidden;
		border: 1px solid rgba(32, 26, 22, 0.1);
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.9);
		margin-bottom: 28px;
	}

	.cf-cost-case-side {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		min-height: 210px;
		border: 0;
		border-radius: 0;
		padding: 26px;
		background: transparent;
	}

	.cf-cost-case-side strong {
		margin-top: 10px;
		font-size: clamp(24px, 3vw, 34px);
		font-weight: 820;
		line-height: 1;
	}

	.cf-cost-case-before strong {
		color: rgba(32, 26, 22, 0.55);
	}

	.cf-cost-case-after strong {
		color: var(--cf-accent);
	}

	.cf-cost-case-tag {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0;
		color: rgba(32, 26, 22, 0.5);
	}

	.cf-cost-case-note {
		margin-top: 12px;
		color: rgba(32, 26, 22, 0.6);
		font-size: 13px;
		line-height: 1.5;
	}

	.cf-cost-case-arrow {
		display: flex;
		width: 64px;
		align-items: center;
		justify-content: center;
		border-inline: 1px dashed rgba(32, 26, 22, 0.14);
		background: rgba(32, 26, 22, 0.025);
		color: var(--cf-accent);
	}

	/* Section 01 module grid: gap-px shows the container background as hairline dividers */
	.cf-loop-grid {
		overflow: hidden;
		border: 1px solid rgba(32, 26, 22, 0.1);
		border-radius: 12px;
		background: rgba(32, 26, 22, 0.12);
	}

	.cf-loop-cell {
		min-height: 220px;
		justify-content: space-between;
		background: rgba(255, 255, 255, 0.94);
		transition:
			transform 240ms cubic-bezier(0.16, 1, 0.3, 1),
			background 240ms ease;
	}

	.cf-loop-cell[data-active] {
		background:
			linear-gradient(
				180deg,
				rgba(255, 80, 10, 0.055),
				rgba(255, 255, 255, 0.95) 42%
			),
			#fff;
	}

	/* Section 02 cost bars: before is full width and muted, after is short and orange */
	.cf-cost-bar {
		overflow: hidden;
		margin-top: 16px;
		height: 8px;
		border-radius: 999px;
		background: rgba(32, 26, 22, 0.08);
	}

	.cf-cost-bar span {
		display: block;
		height: 100%;
		border-radius: inherit;
	}

	.cf-cost-bar-before span {
		width: 100%;
		background: rgba(32, 26, 22, 0.32);
	}

	.cf-cost-bar-after span {
		width: 12%;
		background: linear-gradient(90deg, var(--cf-accent), var(--cf-accent-2));
	}

	/* Section 02 pricing disclosure */
	.cf-price-summary {
		display: flex;
		width: fit-content;
		cursor: pointer;
		align-items: center;
		gap: 6px;
		margin: 0 auto 16px;
		color: var(--cf-accent);
		font-size: 13px;
		font-weight: 700;
		list-style: none;
	}

	.cf-price-summary::-webkit-details-marker {
		display: none;
	}

	.cf-price-summary::after {
		content: "+";
		font-size: 15px;
		font-weight: 800;
	}

	.cf-price-details[open] .cf-price-summary::after {
		content: "−";
	}

	.cf-card-icon {
		display: flex;
		width: 42px;
		height: 42px;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(255, 80, 10, 0.18);
		border-radius: 10px;
		background: rgba(255, 80, 10, 0.06);
		color: var(--cf-accent);
	}

	.cf-ready-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		border: 1px solid rgba(255, 80, 10, 0.16);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.72);
		padding: 3px 9px;
		color: var(--cf-accent);
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
	}

	.cf-warm-band {
		border-block: 1px solid rgba(255, 80, 10, 0.14);
		background:
			radial-gradient(
				circle at 50% 0,
				rgba(255, 153, 16, 0.1),
				transparent 32%
			),
			var(--cf-paper-2);
	}

	.cf-price-shell,
	.cf-compare-shell,
	.cf-deploy-shell {
		overflow: hidden;
		border: 1px solid rgba(32, 26, 22, 0.1);
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.92);
		box-shadow: none;
	}

	.cf-price-topbar {
		display: grid;
		grid-template-columns: 0.7fr 1.15fr 1.15fr;
		gap: 16px;
		border-bottom: 1px dashed rgba(32, 26, 22, 0.14);
		padding: 14px 22px;
		color: rgba(32, 26, 22, 0.58);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
			monospace;
		font-size: 11px;
		text-transform: uppercase;
	}

	.cf-price-row {
		display: grid;
		grid-template-columns: 0.7fr 1.15fr 1.15fr;
		gap: 16px;
		border-bottom: 1px dashed rgba(32, 26, 22, 0.1);
		padding: 16px 22px;
	}

	.cf-price-product {
		font-size: 15px;
		font-weight: 700;
		color: var(--cf-ink);
	}

	.cf-price-cell {
		font-size: 13px;
		line-height: 1.5;
		color: rgba(32, 26, 22, 0.72);
	}

	.cf-price-cell[data-label]::before {
		content: none;
	}

	.cf-price-foot {
		padding: 14px 22px;
		font-size: 12px;
		line-height: 1.5;
		color: rgba(32, 26, 22, 0.58);
	}

	.cf-compare-labels {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		border-bottom: 1px dashed rgba(32, 26, 22, 0.14);
		padding: 18px 24px;
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
		padding: 0;
	}

	.cf-compare-rows::before {
		content: none;
	}

	.cf-compare-row {
		position: relative;
		z-index: 1;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 64px minmax(0, 1fr);
		align-items: stretch;
		gap: 0;
		border-bottom: 1px dashed rgba(32, 26, 22, 0.1);
	}

	.cf-compare-row:last-child {
		border-bottom: 0;
	}

	.cf-compare-normal,
	.cf-compare-opc {
		display: flex;
		min-height: 72px;
		align-items: center;
		border-radius: 0;
		padding: 18px 24px;
		font-size: 13px;
		line-height: 1.4;
	}

	.cf-compare-normal {
		border: 0;
		background: transparent;
		color: rgba(32, 26, 22, 0.62);
	}

	.cf-compare-opc {
		gap: 8px;
		border-left: 1px dashed rgba(255, 80, 10, 0.18);
		background: rgba(255, 80, 10, 0.035);
		color: var(--cf-ink);
		font-weight: 650;
	}

	.cf-compare-vs {
		display: flex;
		align-items: center;
		justify-content: center;
		border-inline: 1px dashed rgba(32, 26, 22, 0.12);
		background: rgba(32, 26, 22, 0.025);
		color: rgba(32, 26, 22, 0.34);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
			monospace;
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
		background-image: linear-gradient(
			to bottom,
			rgba(255, 80, 10, 0.34) 50%,
			transparent 50%
		);
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
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
			monospace;
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
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
			monospace;
		font-size: 11px;
	}

	.cf-terminal pre {
		margin: 0;
		overflow-x: auto;
		padding: 24px;
		color: rgba(255, 255, 255, 0.72);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
			monospace;
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
		background: radial-gradient(
				circle at 50% -30%,
				rgba(255, 153, 16, 0.28),
				transparent 36%
			),
			var(--cf-ink);
	}

	.cf-final-lines {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(
				circle at center,
				rgba(255, 153, 16, 0.18) 0 0.75px,
				transparent 0.85px
			),
			linear-gradient(
				to right,
				rgba(255, 255, 255, 0.14) 50%,
				transparent 50%
			);
		background-size:
			12px 12px,
			32px 1px;
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
		background: conic-gradient(
			from var(--customer-browser-beam-angle),
			transparent 0%,
			transparent 16%,
			rgba(255, 80, 10, 0.12) 24%,
			rgba(255, 80, 10, 0.48) 34%,
			#ff500a 44%,
			#ff9910 70%,
			rgba(255, 80, 10, 0.48) 82%,
			transparent 100%
		);
		mask:
			linear-gradient(#fff 0 0) content-box,
			linear-gradient(#fff 0 0);
		mask-composite: exclude;
		animation: customer-browser-beam-sweep 4.5s linear infinite;
	}

	.customer-browser-beam[data-active]::before {
		box-shadow: inset 0 0 18px 2px rgba(255, 80, 10, 0.18);
	}

	.customer-browser-beam[data-active] [data-beam-bloom] {
		background: conic-gradient(
			from var(--customer-browser-beam-angle),
			transparent 0%,
			transparent 20%,
			rgba(255, 80, 10, 0.38),
			transparent 74%
		);
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

	/* flowing dash makes the flight routes read as live traffic */
	@keyframes cf-globe-flow {
		to {
			stroke-dashoffset: -22;
		}
	}

	/* nodes breathe softly to feel alive without stealing focus */
	@keyframes cf-globe-node-pulse {
		0%,
		100% {
			opacity: 0.7;
		}
		50% {
			opacity: 1;
		}
	}

	/* docking anchor emits an expanding ring, like a live edge PoP */
	@keyframes cf-globe-ping {
		0% {
			transform: scale(0.6);
			opacity: 0.9;
		}
		70% {
			transform: scale(1.8);
			opacity: 0;
		}
		100% {
			transform: scale(1.8);
			opacity: 0;
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

		.cf-deploy-shell,
		.cf-faq-layout {
			grid-template-columns: 1fr;
		}

		.cf-cost-case {
			grid-template-columns: 1fr;
		}

		.cf-cost-case-arrow {
			width: auto;
			min-height: 56px;
			border-block: 1px dashed rgba(32, 26, 22, 0.14);
			border-inline: 0;
		}

		.cf-cost-case-arrow :global(svg) {
			transform: rotate(90deg);
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
			padding-block: 64px;
			padding-inline: 20px;
		}

		.cf-section-head {
			flex-direction: column;
			align-items: flex-start;
			margin-bottom: 24px;
			padding: 18px 0;
		}

		.cf-section-head-text {
			flex: none;
			width: 100%;
		}

		.cf-section-metric {
			width: 100%;
			align-items: flex-start;
			border-top: 1px dashed rgba(255, 80, 10, 0.22);
			border-left: 0;
			padding-top: 16px;
			padding-left: 0;
			text-align: left;
		}

		.cf-hero-panel {
			padding-inline: 20px;
		}

		.cf-hero-title {
			font-size: clamp(40px, 13vw, 58px);
		}

		.cf-loop-cell {
			min-height: 176px;
			padding: 16px;
		}

		.cf-card-icon {
			width: 36px;
			height: 36px;
		}

		.cf-ready-badge {
			padding: 3px 7px;
			font-size: 11px;
		}

		.cf-cost-case-side {
			min-height: 160px;
			padding: 20px;
		}

		.cf-price-topbar {
			display: none;
		}

		.cf-price-row {
			grid-template-columns: 1fr;
			gap: 6px;
		}

		.cf-price-cell[data-label]::before {
			content: attr(data-label) " · ";
			color: rgba(32, 26, 22, 0.42);
			font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
				monospace;
			font-size: 10px;
			text-transform: uppercase;
		}

		.cf-compare-labels {
			display: none;
		}

		.cf-compare-row {
			grid-template-columns: 1fr;
			gap: 0;
		}

		.cf-compare-normal,
		.cf-compare-opc {
			min-height: auto;
			padding: 14px 16px;
		}

		.cf-compare-normal {
			display: block;
		}

		.cf-compare-opc {
			display: grid;
			grid-template-columns: auto minmax(0, 1fr);
			align-items: start;
			column-gap: 8px;
			row-gap: 8px;
		}

		.cf-compare-normal::before,
		.cf-compare-opc::before {
			display: block;
			margin-bottom: 8px;
			color: rgba(32, 26, 22, 0.46);
			font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
				monospace;
			font-size: 10px;
			font-weight: 800;
			line-height: 1;
			text-transform: uppercase;
			content: attr(data-label);
		}

		.cf-compare-opc::before {
			grid-column: 1 / -1;
			margin-bottom: 0;
			color: var(--cf-accent);
		}

		.cf-compare-rows::before,
		.cf-compare-vs {
			display: none;
		}

		.cf-compare-opc {
			border: 0;
			border-top: 1px dashed rgba(255, 80, 10, 0.18);
		}

		.cf-step-list {
			padding: 0;
		}

		.cf-step-list::before {
			content: none;
		}

		.cf-step-list li {
			grid-template-columns: 32px minmax(0, 1fr);
			gap: 12px;
			border-bottom: 1px dashed rgba(32, 26, 22, 0.1);
			padding: 16px;
		}

		.cf-step-list li:last-child {
			border-bottom: 0;
		}

		.cf-step-list li > span {
			width: 30px;
			height: 30px;
			border-radius: 8px;
			font-size: 11px;
		}

		.cf-step-list h3 {
			font-size: 15px;
		}

		.cf-step-list p {
			font-size: 12px;
			line-height: 1.45;
		}

		.cf-terminal pre {
			padding: 16px;
			font-size: 12px;
			line-height: 1.6;
			white-space: pre-wrap;
			overflow-wrap: anywhere;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.cf-marquee-track,
		.cf-globe-spin,
		.cf-globe-arc,
		.cf-globe-node,
		.cf-globe-anchor-ring,
		.customer-browser-beam[data-active]::after,
		.customer-browser-beam[data-active] [data-beam-bloom] {
			animation: none;
		}

		.cf-hero-mark::after {
			animation: none;
			transform: scaleX(1);
			opacity: 1;
		}
	}
</style>
