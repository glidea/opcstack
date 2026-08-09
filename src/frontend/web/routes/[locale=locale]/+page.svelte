<script lang="ts">
	import { onMount } from "svelte";

	import { _ } from "$frontend/i18n";
	import { Button } from "$frontend/ui/button";
	import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
	import CheckIcon from "@lucide/svelte/icons/check";
	import CopyIcon from "@lucide/svelte/icons/copy";
	import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
	import TerminalIcon from "@lucide/svelte/icons/terminal";

	import LandingHeader from "./LandingHeader.svelte";

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

	type CapabilityKey =
		| "identity"
		| "commerce"
		| "data"
		| "storage"
		| "workflows"
		| "operations";
	type DiffRow = "r1" | "r2" | "r3" | "r5" | "r6";
	type StepKey = "s1" | "s2" | "s3";
	type FaqKey = "q1" | "q2" | "q3" | "q4" | "q5" | "q6" | "q7";

	let {
		data
	}: {
		data: PageData;
	} = $props();

	let copied: boolean = $state(false);

	const docsBase: string = $derived(`/${data.locale}/docs`);
	const quickStartHref: string = $derived(`${docsBase}/getting-started`);
	const quickStartPrompt: string =
		"Create an OPCStack app named <APP_NAME> by following:\nhttps://raw.githubusercontent.com/glidea/opcstack/main/QUICK_START.md";
	const capabilities: CapabilityKey[] = [
		"identity",
		"commerce",
		"data",
		"storage",
		"workflows",
		"operations"
	];
	const priceRows: string[] = [
		"workers",
		"d1",
		"r2",
		"kv",
		"queues",
		"cron",
		"cdn"
	];
	const diffRows: DiffRow[] = ["r1", "r2", "r3", "r5", "r6"];
	const stepsList: StepKey[] = ["s1", "s2", "s3"];
	const faqList: FaqKey[] = ["q1", "q2", "q3", "q4", "q5", "q6", "q7"];

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

	async function copyQuickStartPrompt(): Promise<void> {
		await navigator.clipboard.writeText(quickStartPrompt);
		copied = true;
		window.setTimeout((): void => {
			copied = false;
		}, 1800);
	}
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

<main class="landing-page">
	<section class="landing-hero">
		<div class="landing-shell landing-hero-inner">
			<div class="landing-hero-copy">
				<p class="landing-product">OPCStack</p>
				<h1>{$_("home.hero.positioning")}</h1>
				<p class="landing-summary">{$_("home.hero.subtitle")}</p>
				<div class="landing-actions">
					<Button size="lg" href={quickStartHref} class="landing-primary-button">
						{$_("home.hero.cta.init")}
						<ArrowRightIcon class="size-4" />
					</Button>
					<Button
						size="lg"
						variant="outline"
						href={docsBase}
						class="landing-secondary-button"
					>
						{$_("home.nav.docs")}
					</Button>
				</div>
			</div>

			<div class="landing-architecture" aria-label={$_("home.architecture.label")}>
				<div class="architecture-caption">
					<span>{$_("home.architecture.title")}</span>
					<strong>Cloudflare Edge</strong>
				</div>
				<div class="architecture-flow">
					<div class="architecture-layer architecture-clients">
						<span class="architecture-label">Clients</span>
						<div>
							<strong>Web App</strong>
							<strong>Chrome Extension</strong>
						</div>
					</div>
					<span class="architecture-connector" aria-hidden="true">↓</span>
					<div class="architecture-layer architecture-runtime">
						<span class="architecture-label">Worker Runtime</span>
						<div>
							<strong>SvelteKit SSR</strong>
							<strong>Hono API</strong>
							<strong>Queue Consumers</strong>
						</div>
					</div>
					<span class="architecture-connector" aria-hidden="true">↓</span>
					<div class="architecture-data">
						<div class="architecture-layer">
							<span class="architecture-label">Control Plane</span>
							<strong>META_DB</strong>
						</div>
						<div class="architecture-layer architecture-accent">
							<span class="architecture-label">Tenant Data</span>
							<strong>D1 Shards</strong>
						</div>
						<div class="architecture-layer">
							<span class="architecture-label">Platform</span>
							<strong>R2 · Queues · KV</strong>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<section id="loop" class="landing-section">
		<div class="landing-shell">
			<div class="landing-section-heading">
				<p>{$_("home.loop.eyebrow")}</p>
				<h2>{$_("home.loop.title")}</h2>
				<span>{$_("home.loop.subtitle")}</span>
			</div>

			<div class="capability-list" role="list">
				{#each capabilities as capability (capability)}
					<div class="capability-row" role="listitem">
						<div class="capability-status">
							<CheckIcon class="size-4" />
							<span>{$_("home.loop.ready")}</span>
						</div>
						<h3>{$_(`home.capability.${capability}.title`)}</h3>
						<p>{$_(`home.capability.${capability}.desc`)}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section id="diff" class="landing-section landing-section-dark">
		<div class="landing-shell">
			<div class="landing-section-heading landing-section-heading-dark">
				<p>{$_("home.diff.eyebrow")}</p>
				<h2>{$_("home.diff.title")}</h2>
			</div>

			<div class="comparison-table">
				<div class="comparison-header" aria-hidden="true">
					<span>{$_("home.diff.col.normal")}</span>
					<span>{$_("home.diff.col.opcstack")}</span>
				</div>
				{#each diffRows as row (row)}
					<div class="comparison-row">
						<div class="comparison-baseline" data-label={$_("home.diff.col.normal")}>
							{$_(`home.diff.${row}.normal`)}
						</div>
						<div class="comparison-opcstack" data-label={$_("home.diff.col.opcstack")}>
							<CheckIcon class="comparison-check size-4" />
							<span>{$_(`home.diff.${row}.opcstack`)}</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section id="cost" class="landing-section">
		<div class="landing-shell">
			<div class="landing-section-heading landing-heading-row">
				<div>
					<p>{$_("home.cost.eyebrow")}</p>
					<h2>{$_("home.cost.title")}</h2>
				</div>
				<span>{$_("home.cost.subtitle")}</span>
			</div>

			<div class="pricing-table">
				<div class="pricing-header">
					<span>{$_("home.cost.price.product")}</span>
					<span>{$_("home.cost.price.free")}</span>
					<span>{$_("home.cost.price.paid")}</span>
				</div>
				{#each priceRows as row (row)}
					<div class="pricing-row">
						<strong>{$_(`home.cost.price.${row}.name`)}</strong>
						<span data-label={$_("home.cost.price.free")}>
							{$_(`home.cost.price.${row}.free`)}
						</span>
						<span data-label={$_("home.cost.price.paid")}>
							{$_(`home.cost.price.${row}.paid`)}
						</span>
					</div>
				{/each}
			</div>
			<p class="pricing-note">{$_("home.cost.price.note")}</p>
			<div class="pricing-sources">
				<span>{$_("home.cost.sources")}</span>
				<a
					href="https://developers.cloudflare.com/workers/platform/pricing/"
					target="_blank"
					rel="noreferrer"
				>
					Workers + KV
					<ExternalLinkIcon class="size-3.5" />
				</a>
				<a
					href="https://developers.cloudflare.com/d1/platform/pricing/"
					target="_blank"
					rel="noreferrer"
				>
					D1
					<ExternalLinkIcon class="size-3.5" />
				</a>
				<a
					href="https://developers.cloudflare.com/r2/pricing/"
					target="_blank"
					rel="noreferrer"
				>
					R2
					<ExternalLinkIcon class="size-3.5" />
				</a>
				<a
					href="https://developers.cloudflare.com/queues/platform/pricing/"
					target="_blank"
					rel="noreferrer"
				>
					Queues
					<ExternalLinkIcon class="size-3.5" />
				</a>
			</div>
		</div>
	</section>

	<section id="steps" class="landing-section landing-quick-start">
		<div class="landing-shell quick-start-layout">
			<div>
				<div class="landing-section-heading">
					<p>{$_("home.steps.eyebrow")}</p>
					<h2>{$_("home.steps.title")}</h2>
				</div>
				<ol class="step-list">
					{#each stepsList as step, index (step)}
						<li>
							<span>{index + 1}</span>
							<div>
								<h3>{$_(`home.steps.${step}.title`)}</h3>
								<p>{$_(`home.steps.${step}.desc`)}</p>
							</div>
						</li>
					{/each}
				</ol>
			</div>

			<div class="quick-start-terminal">
				<div class="terminal-header">
					<div>
						<TerminalIcon class="size-4" />
						<span>Agent prompt</span>
					</div>
					<Button
						variant="ghost"
						size="icon"
						class="copy-button"
						onclick={copyQuickStartPrompt}
						aria-label={copied ? $_("home.steps.copied") : $_("home.steps.copy")}
						title={copied ? $_("home.steps.copied") : $_("home.steps.copy")}
					>
						{#if copied}
							<CheckIcon class="size-4" />
						{:else}
							<CopyIcon class="size-4" />
						{/if}
					</Button>
				</div>
				<pre><code>{quickStartPrompt}</code></pre>
				<a href={quickStartHref}>
					{$_("home.hero.cta.init")}
					<ArrowRightIcon class="size-4" />
				</a>
			</div>
		</div>
	</section>

	<section id="faq" class="landing-section">
		<div class="landing-shell faq-layout">
			<div class="landing-section-heading faq-heading">
				<p>{$_("home.faq.eyebrow")}</p>
				<h2>{$_("home.faq.title")}</h2>
			</div>
			<div class="faq-list">
				{#each faqList as item (item)}
					<details>
						<summary>
							<span>{$_(`home.faq.${item}`)}</span>
							<ArrowRightIcon class="faq-arrow size-4" />
						</summary>
						<p>{$_(`home.faq.a${item.slice(1)}`)}</p>
					</details>
				{/each}
			</div>
		</div>
	</section>

	<section class="landing-final">
		<div class="landing-shell landing-final-inner">
			<div>
				<p>OPCStack</p>
				<h2>{$_("home.final.title")}</h2>
			</div>
			<Button size="lg" href={quickStartHref} class="landing-final-button">
				{$_("home.hero.cta.init")}
				<ArrowRightIcon class="size-4" />
			</Button>
		</div>
	</section>
</main>

<style>
	:global(html) {
		scroll-behavior: smooth;
	}

	.landing-page {
		--landing-ink: #111113;
		--landing-muted: #606064;
		--landing-line: #d9d9dc;
		--landing-soft: #f4f4f5;
		--landing-accent: #ff500a;
		background: #ffffff;
		color: var(--landing-ink);
		letter-spacing: 0;
	}

	.landing-page :is(h1, h2, h3, p, span, strong, a, summary, code) {
		letter-spacing: 0;
	}

	.landing-shell {
		width: min(100% - 40px, 1240px);
		margin-inline: auto;
	}

	.landing-hero {
		min-height: calc(100svh - 104px);
		background: var(--landing-ink);
		color: #ffffff;
	}

	.landing-hero-inner {
		display: grid;
		align-content: center;
		gap: clamp(42px, 6vw, 72px);
		min-height: calc(100svh - 104px);
		padding-block: clamp(56px, 8vh, 96px) 44px;
	}

	.landing-hero-copy {
		max-width: 980px;
	}

	.landing-product,
	.landing-section-heading > p,
	.landing-section-heading > div > p,
	.landing-final p {
		margin: 0 0 18px;
		color: var(--landing-accent);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 12px;
		font-weight: 700;
		line-height: 1.4;
		text-transform: uppercase;
	}

	.landing-hero h1 {
		max-width: 920px;
		margin: 0;
		font-size: clamp(46px, 7vw, 88px);
		font-weight: 650;
		line-height: 0.98;
	}

	.landing-summary {
		max-width: 720px;
		margin: 26px 0 0;
		color: #b8b8bd;
		font-size: clamp(17px, 1.8vw, 21px);
		line-height: 1.6;
	}

	.landing-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 30px;
	}

	:global(.landing-primary-button) {
		border-color: var(--landing-accent);
		border-radius: 6px;
		background: var(--landing-accent);
		color: #ffffff;
		box-shadow: none;
	}

	:global(.landing-primary-button:hover) {
		background: #ff6a2b;
	}

	:global(.landing-secondary-button) {
		border-color: #424247;
		border-radius: 6px;
		background: transparent;
		color: #ffffff;
		box-shadow: none;
	}

	:global(.landing-secondary-button:hover) {
		border-color: #6d6d72;
		background: #232326;
	}

	.landing-architecture {
		border-top: 1px solid #3a3a3e;
	}

	.architecture-caption {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		padding-block: 12px;
		color: #8e8e93;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 11px;
		text-transform: uppercase;
	}

	.architecture-caption strong {
		color: #ffffff;
		font-weight: 600;
	}

	.architecture-flow {
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) 24px minmax(0, 1.2fr) 24px minmax(0, 2fr);
		align-items: stretch;
		border-block: 1px solid #3a3a3e;
	}

	.architecture-layer {
		display: flex;
		min-width: 0;
		flex-direction: column;
		justify-content: space-between;
		gap: 18px;
		padding: 18px;
		background: #18181b;
	}

	.architecture-layer > div {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 18px;
	}

	.architecture-layer strong {
		color: #ffffff;
		font-size: 14px;
		font-weight: 600;
		line-height: 1.35;
	}

	.architecture-label {
		color: #85858b;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
	}

	.architecture-connector {
		display: grid;
		place-items: center;
		color: #6d6d72;
		font-size: 15px;
		transform: rotate(-90deg);
	}

	.architecture-data {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.architecture-data .architecture-layer {
		border-left: 1px solid #3a3a3e;
	}

	.architecture-data .architecture-layer:first-child {
		border-left: 0;
	}

	.architecture-layer.architecture-accent {
		background: var(--landing-accent);
	}

	.architecture-accent .architecture-label {
		color: #ffffffb8;
	}

	.landing-section {
		padding-block: clamp(82px, 10vw, 140px);
		border-bottom: 1px solid var(--landing-line);
	}

	.landing-section-heading {
		max-width: 760px;
		margin-bottom: clamp(42px, 6vw, 72px);
	}

	.landing-section-heading h2,
	.landing-final h2 {
		margin: 0;
		font-size: clamp(34px, 5vw, 60px);
		font-weight: 620;
		line-height: 1.05;
	}

	.landing-section-heading > span,
	.landing-heading-row > span {
		display: block;
		max-width: 660px;
		margin-top: 20px;
		color: var(--landing-muted);
		font-size: 17px;
		line-height: 1.65;
	}

	.capability-list {
		border-top: 1px solid var(--landing-ink);
	}

	.capability-row {
		display: grid;
		grid-template-columns: 150px minmax(180px, 0.8fr) minmax(280px, 1.4fr);
		gap: 28px;
		align-items: start;
		padding-block: 26px;
		border-bottom: 1px solid var(--landing-line);
	}

	.capability-status {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--landing-accent);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
	}

	.capability-row h3 {
		margin: 0;
		font-size: 20px;
		font-weight: 620;
		line-height: 1.35;
	}

	.capability-row p {
		margin: 0;
		color: var(--landing-muted);
		font-size: 15px;
		line-height: 1.65;
	}

	.landing-section-dark {
		border-color: #333337;
		background: var(--landing-ink);
		color: #ffffff;
	}

	.landing-section-heading-dark h2 {
		max-width: 900px;
	}

	.comparison-table {
		border-top: 1px solid #4a4a4f;
	}

	.comparison-header,
	.comparison-row {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.comparison-header {
		color: #8e8e93;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
	}

	.comparison-header span,
	.comparison-row > div {
		padding: 16px 24px;
	}

	.comparison-header span:last-child,
	.comparison-opcstack {
		border-left: 1px solid #4a4a4f;
	}

	.comparison-row {
		border-top: 1px solid #333337;
	}

	.comparison-row > div {
		font-size: 15px;
		line-height: 1.6;
	}

	.comparison-baseline {
		color: #85858b;
	}

	.comparison-opcstack {
		display: flex;
		gap: 12px;
		color: #ffffff;
	}

	:global(.comparison-check) {
		margin-top: 4px;
		color: var(--landing-accent);
	}

	.landing-heading-row {
		display: grid;
		max-width: none;
		grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.7fr);
		gap: 60px;
		align-items: end;
	}

	.landing-heading-row > span {
		margin: 0;
	}

	.pricing-table {
		border-top: 1px solid var(--landing-ink);
	}

	.pricing-header,
	.pricing-row {
		display: grid;
		grid-template-columns: 180px repeat(2, minmax(0, 1fr));
	}

	.pricing-header {
		color: var(--landing-muted);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
	}

	.pricing-header span,
	.pricing-row > * {
		padding: 14px 18px;
	}

	.pricing-row {
		border-top: 1px solid var(--landing-line);
	}

	.pricing-row strong {
		font-size: 14px;
		font-weight: 650;
	}

	.pricing-row span {
		border-left: 1px solid var(--landing-line);
		color: var(--landing-muted);
		font-size: 13px;
		line-height: 1.55;
	}

	.pricing-note {
		max-width: 780px;
		margin: 20px 0 0;
		color: var(--landing-muted);
		font-size: 13px;
		line-height: 1.6;
	}

	.pricing-sources {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 20px;
		margin-top: 18px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 11px;
	}

	.pricing-sources > span {
		color: var(--landing-muted);
		font-weight: 700;
		text-transform: uppercase;
	}

	.pricing-sources a {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		border-bottom: 1px solid var(--landing-line);
		color: var(--landing-ink);
		font-weight: 650;
	}

	.pricing-sources a:hover {
		border-color: var(--landing-accent);
		color: var(--landing-accent);
	}

	.landing-quick-start {
		background: var(--landing-soft);
	}

	.quick-start-layout {
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(400px, 1.2fr);
		gap: clamp(48px, 8vw, 120px);
		align-items: center;
	}

	.quick-start-layout .landing-section-heading {
		margin-bottom: 36px;
	}

	.step-list {
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--landing-ink);
		list-style: none;
	}

	.step-list li {
		display: grid;
		grid-template-columns: 34px minmax(0, 1fr);
		gap: 18px;
		padding-block: 20px;
		border-bottom: 1px solid var(--landing-line);
	}

	.step-list li > span {
		color: var(--landing-accent);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 12px;
		font-weight: 700;
	}

	.step-list h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 650;
	}

	.step-list p {
		margin: 6px 0 0;
		color: var(--landing-muted);
		font-size: 14px;
		line-height: 1.6;
	}

	.quick-start-terminal {
		min-width: 0;
		border: 1px solid #2d2d31;
		border-radius: 6px;
		background: var(--landing-ink);
		color: #ffffff;
	}

	.terminal-header {
		display: flex;
		min-height: 52px;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 8px 10px 8px 18px;
		border-bottom: 1px solid #333337;
	}

	.terminal-header > div {
		display: flex;
		align-items: center;
		gap: 10px;
		color: #a7a7ad;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
	}

	:global(.copy-button) {
		color: #ffffff;
	}

	:global(.copy-button:hover) {
		background: #29292d;
	}

	.quick-start-terminal pre {
		min-height: 230px;
		margin: 0;
		padding: 28px;
		overflow-x: auto;
		white-space: pre-wrap;
	}

	.quick-start-terminal code {
		color: #e4e4e7;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 14px;
		line-height: 1.8;
		word-break: break-word;
	}

	.quick-start-terminal > a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 18px 28px;
		border-top: 1px solid #333337;
		color: var(--landing-accent);
		font-size: 14px;
		font-weight: 650;
	}

	.quick-start-terminal > a:hover {
		background: #1c1c1f;
	}

	.faq-layout {
		display: grid;
		grid-template-columns: minmax(240px, 0.55fr) minmax(0, 1fr);
		gap: clamp(56px, 9vw, 140px);
	}

	.faq-heading {
		margin: 0;
	}

	.faq-list {
		border-top: 1px solid var(--landing-ink);
	}

	.faq-list details {
		border-bottom: 1px solid var(--landing-line);
	}

	.faq-list summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		padding-block: 22px;
		font-size: 16px;
		font-weight: 620;
		line-height: 1.45;
		cursor: pointer;
		list-style: none;
	}

	.faq-list summary::-webkit-details-marker {
		display: none;
	}

	:global(.faq-arrow) {
		flex: none;
		transition: transform 160ms ease;
	}

	.faq-list details[open] :global(.faq-arrow) {
		transform: rotate(90deg);
	}

	.faq-list details p {
		max-width: 720px;
		margin: -2px 0 22px;
		color: var(--landing-muted);
		font-size: 15px;
		line-height: 1.75;
	}

	.landing-final {
		padding-block: clamp(62px, 8vw, 96px);
		background: var(--landing-accent);
		color: #ffffff;
	}

	.landing-final-inner {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 40px;
	}

	.landing-final p {
		color: #ffffff;
	}

	.landing-final h2 {
		max-width: 820px;
	}

	:global(.landing-final-button) {
		flex: none;
		border-color: var(--landing-ink);
		border-radius: 6px;
		background: var(--landing-ink);
		color: #ffffff;
		box-shadow: none;
	}

	:global(.landing-final-button:hover) {
		background: #26262a;
	}

	@media (max-width: 900px) {
		.architecture-flow {
			grid-template-columns: 1fr;
		}

		.architecture-connector {
			height: 24px;
			transform: none;
		}

		.capability-row {
			grid-template-columns: 120px minmax(180px, 0.75fr) minmax(240px, 1.25fr);
		}

		.quick-start-layout,
		.faq-layout {
			grid-template-columns: 1fr;
		}

		.quick-start-terminal {
			max-width: 760px;
		}
	}

	@media (max-width: 700px) {
		.landing-shell {
			width: min(100% - 32px, 1240px);
		}

		.landing-hero-inner {
			gap: 28px;
			padding-block: 36px 24px;
		}

		.landing-hero h1 {
			font-size: 43px;
			line-height: 1.02;
		}

		.landing-product {
			margin-bottom: 12px;
		}

		.landing-summary {
			margin-top: 18px;
			font-size: 15px;
			line-height: 1.55;
		}

		.landing-actions {
			margin-top: 20px;
		}

		.architecture-caption {
			padding-block: 8px;
		}

		.architecture-flow {
			border-bottom: 0;
		}

		.architecture-connector {
			display: none;
		}

		.architecture-layer {
			min-height: 54px;
			align-items: center;
			flex-direction: row;
			gap: 12px;
			padding: 10px 12px;
			border-bottom: 1px solid #3a3a3e;
		}

		.architecture-layer > div {
			justify-content: flex-end;
		}

		.architecture-label {
			flex: none;
		}

		.architecture-layer strong {
			font-size: 12px;
		}

		.architecture-data {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.architecture-data .architecture-layer {
			min-height: 72px;
			align-items: flex-start;
			flex-direction: column;
			justify-content: space-between;
			gap: 8px;
			border-top: 0;
			border-left: 1px solid #3a3a3e;
		}

		.architecture-data .architecture-layer:first-child {
			border-left: 0;
			border-top: 0;
		}

		.landing-section {
			padding-block: 80px;
		}

		.capability-row {
			grid-template-columns: 1fr;
			gap: 10px;
		}

		.capability-status {
			margin-bottom: 6px;
		}

		.comparison-header {
			display: none;
		}

		.comparison-row {
			grid-template-columns: 1fr;
			padding-block: 12px;
		}

		.comparison-row > div {
			padding: 12px 0 12px 92px;
		}

		.comparison-row > div::before {
			position: absolute;
			left: 0;
			width: 76px;
			color: #77777d;
			font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
			font-size: 9px;
			font-weight: 700;
			text-transform: uppercase;
			content: attr(data-label);
		}

		.comparison-baseline,
		.comparison-opcstack {
			position: relative;
			border-left: 0;
		}

		.landing-heading-row {
			grid-template-columns: 1fr;
			gap: 18px;
		}

		.pricing-header {
			display: none;
		}

		.pricing-row {
			grid-template-columns: 1fr;
			padding-block: 18px;
		}

		.pricing-row > * {
			padding: 7px 0;
		}

		.pricing-row span {
			border-left: 0;
		}

		.pricing-row span::before {
			display: block;
			margin-bottom: 4px;
			color: #8b8b90;
			font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
			font-size: 9px;
			font-weight: 700;
			text-transform: uppercase;
			content: attr(data-label);
		}

		.quick-start-layout {
			gap: 48px;
		}

		.quick-start-terminal pre {
			min-height: 210px;
			padding: 22px 18px;
		}

		.landing-final-inner {
			align-items: flex-start;
			flex-direction: column;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:global(html) {
			scroll-behavior: auto;
		}

		:global(.faq-arrow) {
			transition: none;
		}
	}
</style>
