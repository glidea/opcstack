<script lang="ts">
	import { onMount } from "svelte";

	import { _ } from "$frontend/i18n";
	import { Button } from "$frontend/ui/button";
	import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
	import ArrowUpRightIcon from "@lucide/svelte/icons/arrow-up-right";
	import CheckIcon from "@lucide/svelte/icons/check";
	import CopyIcon from "@lucide/svelte/icons/copy";
	import ExternalLinkIcon from "@lucide/svelte/icons/external-link";

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
	type FlowKey = "create" | "deploy" | "operate";
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
	const flowSteps: FlowKey[] = ["create", "deploy", "operate"];
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
		<div class="hero-plane" aria-hidden="true"></div>
		<div class="hero-rules" aria-hidden="true">
			<span></span>
			<span></span>
			<span></span>
		</div>

		<div class="deployment-scene" aria-label={$_("home.architecture.label")}>
			<div class="scene-caption">
				<span>{$_("home.architecture.title")}</span>
				<strong>Cloudflare Edge</strong>
			</div>
			<div class="deployment-stack">
				<div class="deployment-layer layer-runtime" data-layer="worker-runtime">
					<div class="layer-topline">
						<span>01 / Worker runtime</span>
						<span class="layer-state">Live</span>
					</div>
					<strong class="layer-title">SvelteKit SSR + Hono API</strong>
					<div class="layer-detail">
						<span>Queue consumers</span>
						<span>Edge routes</span>
					</div>
				</div>
				<div class="deployment-layer layer-control" data-layer="control-plane">
					<div class="layer-topline">
						<span>02 / Control plane</span>
						<span class="layer-state">Primary</span>
					</div>
					<strong class="layer-title">META_DB</strong>
					<div class="layer-detail">
						<span>Shard registry</span>
						<span>User routing</span>
					</div>
				</div>
				<div class="deployment-layer layer-tenant" data-layer="tenant-data">
					<div class="layer-topline">
						<span>03 / Tenant data</span>
						<span class="layer-state">Regional</span>
					</div>
					<strong class="layer-title">D1 Shards</strong>
					<div class="shard-grid" aria-hidden="true">
						<span>WNAM</span>
						<span>ENAM</span>
						<span>WEUR</span>
						<span>EEUR</span>
						<span>APAC</span>
						<span>OC</span>
					</div>
				</div>
				<div class="deployment-layer layer-platform">
					<div class="layer-topline">
						<span>04 / Platform</span>
						<span class="layer-state">Attached</span>
					</div>
					<strong class="layer-title">R2 · KV · Queues</strong>
				</div>
			</div>
			<div class="scene-footnote">One Worker · one control plane · regional tenant data</div>
		</div>

		<div class="landing-shell hero-inner">
			<div class="hero-copy">
				<div class="hero-brandline">
					<img src="/logo.svg" alt="" />
					<span>OPCStack / Cloudflare native</span>
				</div>
				<h1>{$_("home.hero.positioning")}</h1>
				<p class="hero-summary">{$_("home.hero.subtitle")}</p>
				<div class="landing-actions">
					<Button size="lg" href={quickStartHref} class="landing-primary-button">
						{$_("home.hero.cta.init")}
						<ArrowRightIcon class="size-4" />
					</Button>
					<Button size="lg" variant="outline" href={docsBase} class="landing-secondary-button">
						{$_("home.nav.docs")}
					</Button>
				</div>
			</div>
			<div class="hero-foot">
				<span>Built for one person companies</span>
				<span>Open source template</span>
				<span>Cloudflare Worker runtime</span>
			</div>
		</div>
	</section>

	<section id="loop" class="landing-section landing-flow">
		<div class="landing-shell">
			<div class="section-intro">
				<p class="section-kicker">{$_("home.flow.eyebrow")}</p>
				<h2>{$_("home.flow.title")}</h2>
				<span>{$_("home.flow.subtitle")}</span>
			</div>
			<div class="flow-list">
				{#each flowSteps as flow, index (flow)}
					<article class="flow-step">
						<div class="flow-index">0{index + 1}</div>
						<div>
							<h3>{$_(`home.flow.${flow}.title`)}</h3>
							<p>{$_(`home.flow.${flow}.desc`)}</p>
						</div>
						<ArrowUpRightIcon class="flow-arrow size-7" aria-hidden="true" />
					</article>
				{/each}
			</div>
		</div>
	</section>

	<section id="diff" class="landing-section landing-runtime">
		<div class="landing-shell">
			<div class="runtime-heading">
				<div class="section-intro section-intro-dark">
					<p class="section-kicker">{$_("home.diff.eyebrow")}</p>
					<h2>{$_("home.diff.title")}</h2>
				</div>
				<div class="runtime-metric">
					<strong>{$_("home.diff.metric.value")}</strong>
					<span>{$_("home.diff.metric.label")}</span>
				</div>
			</div>

			<div class="runtime-diagram">
				<div class="runtime-node runtime-node-edge">
					<span>Edge</span>
					<strong>Nearest Worker</strong>
				</div>
				<div class="runtime-line" aria-hidden="true"></div>
				<div class="runtime-node runtime-node-control">
					<span>Control plane</span>
					<strong>META_DB</strong>
				</div>
				<div class="runtime-line runtime-line-split" aria-hidden="true"></div>
				<div class="runtime-node runtime-node-tenant">
					<span>Tenant data</span>
					<strong>D1 Shards</strong>
					<div class="runtime-regions">
						<span>WNAM</span><span>WEUR</span><span>APAC</span><span>OC</span>
					</div>
				</div>
			</div>

			<div class="runtime-facts">
				{#each capabilities as capability (capability)}
					<div class="runtime-fact">
						<div class="fact-status"><CheckIcon class="size-4" /> {$_("home.loop.ready")}</div>
						<h3>{$_(`home.capability.${capability}.title`)}</h3>
						<p>{$_(`home.capability.${capability}.desc`)}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section id="cost" class="landing-section landing-cost">
		<div class="landing-shell">
			<div class="section-intro section-intro-wide">
				<p class="section-kicker">{$_("home.cost.eyebrow")}</p>
				<h2>{$_("home.cost.title")}</h2>
				<span>{$_("home.cost.subtitle")}</span>
			</div>
			<div class="cost-facts">
				<div><strong>{$_("home.cost.fact1.value")}</strong><span>{$_("home.cost.fact1.label")}</span></div>
				<div><strong>{$_("home.cost.fact2.value")}</strong><span>{$_("home.cost.fact2.label")}</span></div>
				<div><strong>{$_("home.cost.fact3.value")}</strong><span>{$_("home.cost.fact3.label")}</span></div>
			</div>
			<div class="pricing-sources">
				<span>{$_("home.cost.sources")}</span>
				<a href="https://developers.cloudflare.com/workers/platform/pricing/" target="_blank" rel="noreferrer">Workers + KV <ExternalLinkIcon class="size-3.5" /></a>
				<a href="https://developers.cloudflare.com/d1/platform/pricing/" target="_blank" rel="noreferrer">D1 <ExternalLinkIcon class="size-3.5" /></a>
				<a href="https://developers.cloudflare.com/r2/pricing/" target="_blank" rel="noreferrer">R2 <ExternalLinkIcon class="size-3.5" /></a>
				<a href="https://developers.cloudflare.com/queues/platform/pricing/" target="_blank" rel="noreferrer">Queues <ExternalLinkIcon class="size-3.5" /></a>
			</div>
			<p class="cost-note">{$_("home.cost.price.note")}</p>
		</div>
	</section>

	<section id="steps" class="landing-section landing-start">
		<div class="landing-shell start-layout">
			<div>
				<div class="section-intro section-intro-light">
					<p class="section-kicker">{$_("home.steps.eyebrow")}</p>
					<h2>{$_("home.steps.title")}</h2>
				</div>
				<ol class="step-list">
					{#each ["s1", "s2", "s3"] as step, index (step)}
						<li>
							<span>0{index + 1}</span>
							<div>
								<h3>{$_(`home.steps.${step}.title`)}</h3>
								<p>{$_(`home.steps.${step}.desc`)}</p>
							</div>
						</li>
					{/each}
				</ol>
			</div>

			<div class="prompt-sheet">
				<div class="prompt-sheet-head">
					<span>Agent prompt</span>
					<Button variant="ghost" size="icon" class="copy-button" onclick={copyQuickStartPrompt} aria-label={copied ? $_("home.steps.copied") : $_("home.steps.copy")} title={copied ? $_("home.steps.copied") : $_("home.steps.copy")}>
						{#if copied}<CheckIcon class="size-4" />{:else}<CopyIcon class="size-4" />{/if}
					</Button>
				</div>
				<pre><code>{quickStartPrompt}</code></pre>
				<a href={quickStartHref}>{$_("home.hero.cta.init")} <ArrowRightIcon class="size-4" /></a>
			</div>
		</div>
	</section>

	<section id="faq" class="landing-section landing-faq">
		<div class="landing-shell faq-layout">
			<div class="section-intro">
				<p class="section-kicker">{$_("home.faq.eyebrow")}</p>
				<h2>{$_("home.faq.title")}</h2>
			</div>
			<div class="faq-list">
				{#each faqList as item (item)}
					<details>
						<summary><span>{$_(`home.faq.${item}`)}</span><ArrowRightIcon class="faq-arrow size-4" /></summary>
						<p>{$_(`home.faq.a${item.slice(1)}`)}</p>
					</details>
				{/each}
			</div>
		</div>
	</section>

	<footer class="landing-footer">
		<div class="landing-shell landing-footer-inner">
			<div class="footer-brand"><img src="/logo.svg" alt="" /><span>OPCStack</span></div>
			<p>{$_("home.final.subtitle")}</p>
			<Button size="lg" href={quickStartHref} class="landing-footer-button">{$_("home.hero.cta.init")} <ArrowRightIcon class="size-4" /></Button>
		</div>
	</footer>
</main>

<style>
	:global(html) {
		scroll-behavior: smooth;
	}

	.landing-page {
		--landing-ink: #24211e;
		--landing-muted: #716a64;
		--landing-line: rgba(36, 33, 30, 0.16);
		--landing-paper: #f5efe6;
		--landing-soft: #fbf8f3;
		--landing-orange: #e85b2a;
		--landing-orange-deep: #bc421f;
		--landing-teal: #627873;
		background: var(--landing-soft);
		color: var(--landing-ink);
		letter-spacing: 0;
	}

	.landing-page :is(h1, h2, h3, p, span, strong, a, summary, code) {
		letter-spacing: 0;
	}

	.landing-shell {
		width: min(100% - 48px, 1240px);
		margin-inline: auto;
	}

	.landing-hero {
		position: relative;
		min-height: min(790px, calc(100svh - 64px));
		overflow: hidden;
		border-bottom: 1px solid var(--landing-line);
		background: var(--landing-paper);
	}

	.hero-plane {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		width: 48%;
		background: var(--landing-orange);
		clip-path: polygon(20% 0, 100% 0, 100% 100%, 0 100%);
	}

	.hero-rules span {
		position: absolute;
		left: 3%;
		width: 42%;
		border-top: 1px solid rgba(36, 33, 30, 0.18);
	}

	.hero-rules span:nth-child(1) { top: 18%; }
	.hero-rules span:nth-child(2) { top: 52%; width: 22%; }
	.hero-rules span:nth-child(3) { bottom: 16%; width: 35%; }

	.hero-inner {
		position: relative;
		z-index: 2;
		display: flex;
		min-height: min(790px, calc(100svh - 64px));
		flex-direction: column;
		justify-content: space-between;
		padding-block: clamp(72px, 12vh, 132px) 34px;
	}

	.hero-copy {
		max-width: 660px;
	}

	.hero-brandline {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 26px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
	}

	.hero-brandline img {
		width: 38px;
		height: 38px;
	}

	.hero-copy h1 {
		max-width: 620px;
		margin: 0;
		font-size: clamp(48px, 6.2vw, 82px);
		font-weight: 650;
		line-height: 1.02;
	}

	.hero-summary {
		max-width: 560px;
		margin: 28px 0 0;
		color: #5b554f;
		font-size: clamp(16px, 1.7vw, 19px);
		line-height: 1.65;
	}

	.landing-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 30px;
	}

	:global(.landing-primary-button) {
		border-color: var(--landing-ink);
		border-radius: 3px;
		background: var(--landing-ink);
		color: #fff;
		box-shadow: none;
	}

	:global(.landing-primary-button:hover) {
		background: #3a3531;
	}

	:global(.landing-secondary-button) {
		border-color: rgba(36, 33, 30, 0.35);
		border-radius: 3px;
		background: transparent;
		color: var(--landing-ink);
		box-shadow: none;
	}

	:global(.landing-secondary-button:hover) {
		border-color: var(--landing-ink);
		background: rgba(255, 255, 255, 0.45);
	}

	.hero-foot {
		display: flex;
		flex-wrap: wrap;
		gap: 10px 28px;
		padding-top: 20px;
		border-top: 1px solid rgba(36, 33, 30, 0.28);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
	}

	.deployment-scene {
		position: absolute;
		top: 16%;
		right: clamp(24px, 5vw, 96px);
		z-index: 1;
		width: min(560px, 48vw);
		transform: rotate(-5deg);
	}

	.scene-caption,
	.scene-footnote {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		color: rgba(255, 255, 255, 0.76);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
	}

	.scene-caption {
		padding: 0 16px 12px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.36);
	}

	.scene-caption strong {
		color: #fff;
	}

	.deployment-stack {
		padding: 18px 0 12px 32px;
	}

	.deployment-layer {
		position: relative;
		min-height: 104px;
		padding: 20px 24px;
		border: 1px solid rgba(36, 33, 30, 0.34);
		box-shadow: 12px 16px 0 rgba(36, 33, 30, 0.18);
	}

	.deployment-layer::before {
		position: absolute;
		top: 10px;
		left: -10px;
		width: 9px;
		height: calc(100% - 10px);
		background: rgba(36, 33, 30, 0.28);
		content: "";
	}

	.layer-runtime {
		z-index: 4;
		background: #252726;
		color: #f9f5ed;
	}

	.layer-control {
		z-index: 3;
		margin: -18px 34px 0 -22px;
		background: #ca4d26;
		color: #fff;
	}

	.layer-tenant {
		z-index: 2;
		margin: -18px 66px 0 -44px;
		background: #f8f0e5;
		color: var(--landing-ink);
	}

	.layer-platform {
		z-index: 1;
		min-height: 78px;
		margin: -18px 96px 0 -66px;
		background: #667a75;
		color: #fff;
	}

	.layer-topline,
	.layer-detail {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
	}

	.layer-topline {
		padding-bottom: 16px;
		border-bottom: 1px solid currentColor;
		opacity: 0.72;
	}

	.layer-title {
		display: block;
		margin-top: 16px;
		font-size: clamp(18px, 2vw, 25px);
		font-weight: 650;
		line-height: 1.15;
	}

	.layer-detail {
		margin-top: 18px;
		opacity: 0.7;
	}

	.shard-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 4px;
		margin-top: 18px;
	}

	.shard-grid span {
		padding: 8px 4px;
		border: 1px solid rgba(36, 33, 30, 0.24);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 8px;
		font-weight: 700;
		text-align: center;
	}

	.scene-footnote {
		padding: 12px 16px 0;
		border-top: 1px solid rgba(255, 255, 255, 0.36);
		font-size: 9px;
	}

	.layer-state {
		color: #f4c36e;
	}

	.landing-section {
		padding-block: clamp(88px, 11vw, 148px);
		border-bottom: 1px solid var(--landing-line);
	}

	.section-intro {
		max-width: 760px;
		margin-bottom: clamp(44px, 6vw, 76px);
	}

	.section-intro-wide {
		max-width: 920px;
	}

	.section-intro h2 {
		margin: 0;
		font-size: clamp(36px, 5vw, 62px);
		font-weight: 640;
		line-height: 1.06;
	}

	.section-kicker {
		margin: 0 0 18px;
		color: var(--landing-orange-deep);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
	}

	.section-intro > span {
		display: block;
		max-width: 670px;
		margin-top: 20px;
		color: var(--landing-muted);
		font-size: 17px;
		line-height: 1.65;
	}

	.flow-list {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		border-top: 1px solid var(--landing-ink);
	}

	.flow-step {
		position: relative;
		display: flex;
		min-height: 250px;
		flex-direction: column;
		justify-content: space-between;
		gap: 30px;
		padding: 24px 28px 28px 0;
		border-right: 1px solid var(--landing-line);
	}

	.flow-step + .flow-step {
		padding-left: 28px;
	}

	.flow-step:last-child {
		border-right: 0;
	}

	.flow-index {
		color: var(--landing-orange-deep);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 12px;
		font-weight: 700;
	}

	.flow-step h3 {
		margin: 0;
		font-size: 24px;
		font-weight: 640;
	}

	.flow-step p {
		max-width: 290px;
		margin: 10px 0 0;
		color: var(--landing-muted);
		font-size: 15px;
		line-height: 1.65;
	}

	:global(.flow-arrow) {
		color: var(--landing-orange-deep);
	}

	.landing-runtime {
		border-color: #3c3d3c;
		background: #252726;
		color: #f8f3ea;
	}

	.runtime-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 32px;
	}

	.section-intro-dark {
		margin-bottom: 0;
	}

	.section-intro-dark h2 {
		max-width: 840px;
	}

	.section-intro-dark .section-kicker {
		color: #f2a25d;
	}

	.runtime-metric {
		flex: none;
		padding-left: 26px;
		border-left: 1px solid #777c77;
	}

	.runtime-metric strong {
		display: block;
		color: #f2a25d;
		font-size: 48px;
		font-weight: 600;
		line-height: 1;
	}

	.runtime-metric span {
		display: block;
		margin-top: 8px;
		color: #aeb5ae;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
	}

	.runtime-diagram {
		display: grid;
		grid-template-columns: 1fr 110px 1fr 110px 1.2fr;
		align-items: center;
		margin-top: 86px;
		padding-block: 28px;
		border-block: 1px solid #4b4f4c;
	}

	.runtime-node {
		min-height: 112px;
		padding: 22px;
		border: 1px solid #69706a;
		background: #2d302e;
	}

	.runtime-node span {
		display: block;
		color: #aeb5ae;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
	}

	.runtime-node strong {
		display: block;
		margin-top: 17px;
		font-size: 22px;
		font-weight: 640;
	}

	.runtime-node-control {
		border-color: #e85b2a;
		background: #e85b2a;
		color: var(--landing-ink);
	}

	.runtime-node-control span {
		color: rgba(36, 33, 30, 0.68);
	}

	.runtime-node-tenant {
		border-color: #c4d0c7;
		background: #dfe8df;
		color: var(--landing-ink);
	}

	.runtime-node-tenant span {
		color: #586c62;
	}

	.runtime-line {
		position: relative;
		height: 1px;
		background: #7d857e;
	}

	.runtime-line::after {
		position: absolute;
		top: -4px;
		right: 0;
		width: 9px;
		height: 9px;
		border-top: 1px solid #7d857e;
		border-right: 1px solid #7d857e;
		content: "";
		transform: rotate(45deg);
	}

	.runtime-line-split {
		background: #e85b2a;
	}

	.runtime-line-split::after {
		border-color: #e85b2a;
	}

	.runtime-regions {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 4px;
		margin-top: 16px;
	}

	.runtime-regions span {
		padding: 7px 3px;
		border: 1px solid #aab9ac;
		color: #586c62;
		font-size: 8px;
		text-align: center;
	}

	.runtime-facts {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		margin-top: 70px;
		border-top: 1px solid #4b4f4c;
	}

	.runtime-fact {
		padding: 24px 28px 0 0;
		border-right: 1px solid #4b4f4c;
	}

	.runtime-fact + .runtime-fact {
		padding-left: 28px;
	}

	.runtime-fact:nth-child(3n) {
		border-right: 0;
	}

	.fact-status {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #f2a25d;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
	}

	.runtime-fact h3 {
		margin: 18px 0 0;
		font-size: 20px;
		font-weight: 640;
	}

	.runtime-fact p {
		margin: 10px 0 0;
		color: #b9c0b9;
		font-size: 14px;
		line-height: 1.65;
	}

	.landing-cost {
		background: #efe5d8;
	}

	.cost-facts {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		border-block: 1px solid var(--landing-ink);
	}

	.cost-facts > div {
		min-height: 190px;
		padding: 25px 28px 25px 0;
		border-right: 1px solid var(--landing-line);
	}

	.cost-facts > div + div {
		padding-left: 28px;
	}

	.cost-facts > div:last-child {
		border-right: 0;
	}

	.cost-facts strong {
		display: block;
		font-size: clamp(40px, 5vw, 68px);
		font-weight: 630;
		line-height: 1;
	}

	.cost-facts span {
		display: block;
		max-width: 200px;
		margin-top: 18px;
		color: var(--landing-muted);
		font-size: 14px;
		line-height: 1.45;
	}

	.pricing-sources {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 20px;
		margin-top: 24px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
	}

	.pricing-sources > span {
		color: var(--landing-muted);
	}

	.pricing-sources a {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		border-bottom: 1px solid var(--landing-line);
		color: var(--landing-ink);
	}

	.pricing-sources a:hover {
		border-color: var(--landing-orange-deep);
		color: var(--landing-orange-deep);
	}

	.cost-note {
		max-width: 780px;
		margin: 20px 0 0;
		color: var(--landing-muted);
		font-size: 13px;
		line-height: 1.6;
	}

	.landing-start {
		background: var(--landing-orange);
		color: #fff;
	}

	.start-layout {
		display: grid;
		grid-template-columns: minmax(0, 0.75fr) minmax(420px, 1.25fr);
		gap: clamp(52px, 9vw, 138px);
		align-items: center;
	}

	.section-intro-light .section-kicker {
		color: #ffd6b1;
	}

	.section-intro-light h2 {
		color: #fff;
	}

	.step-list {
		margin: 0;
		padding: 0;
		border-top: 1px solid rgba(255, 255, 255, 0.46);
		list-style: none;
	}

	.step-list li {
		display: grid;
		grid-template-columns: 36px minmax(0, 1fr);
		gap: 18px;
		padding-block: 20px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.34);
	}

	.step-list li > span {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 12px;
		font-weight: 700;
	}

	.step-list h3 {
		margin: 0;
		font-size: 17px;
		font-weight: 640;
	}

	.step-list p {
		margin: 6px 0 0;
		color: rgba(255, 255, 255, 0.78);
		font-size: 14px;
		line-height: 1.6;
	}

	.prompt-sheet {
		min-width: 0;
		border: 1px solid rgba(36, 33, 30, 0.42);
		background: #25211f;
		color: #fff;
		box-shadow: 12px 14px 0 rgba(36, 33, 30, 0.18);
	}

	.prompt-sheet-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 10px 8px 20px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.18);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
	}

	:global(.copy-button) {
		color: #fff;
	}

	:global(.copy-button:hover) {
		background: rgba(255, 255, 255, 0.12);
	}

	.prompt-sheet pre {
		min-height: 210px;
		margin: 0;
		padding: 26px 24px;
		overflow-x: auto;
		white-space: pre-wrap;
	}

	.prompt-sheet code {
		color: #f3eee5;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 14px;
		line-height: 1.8;
		word-break: break-word;
	}

	.prompt-sheet > a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 16px 24px;
		border-top: 1px solid rgba(255, 255, 255, 0.18);
		color: #f6b35e;
		font-size: 14px;
		font-weight: 650;
	}

	.prompt-sheet > a:hover {
		background: #302a27;
	}

	.landing-faq {
		background: var(--landing-soft);
	}

	.faq-layout {
		display: grid;
		grid-template-columns: minmax(260px, 0.55fr) minmax(0, 1fr);
		gap: clamp(56px, 9vw, 140px);
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

	.landing-footer {
		padding-block: 30px;
		background: var(--landing-ink);
		color: #fff;
	}

	.landing-footer-inner {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 30px;
	}

	.footer-brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-size: 15px;
		font-weight: 720;
	}

	.footer-brand img {
		width: 28px;
		height: 28px;
	}

	.landing-footer p {
		margin: 0;
		color: #c6beb4;
		font-size: 13px;
	}

	:global(.landing-footer-button) {
		border-color: #f2a25d;
		border-radius: 3px;
		background: #f2a25d;
		color: var(--landing-ink);
		box-shadow: none;
	}

	:global(.landing-footer-button:hover) {
		background: #ffbe73;
	}

	@media (max-width: 1080px) {
		.deployment-scene {
			right: -40px;
			width: 52vw;
		}

		.hero-copy {
			max-width: 58vw;
		}

		.runtime-diagram {
			grid-template-columns: 1fr 56px 1fr 56px 1.2fr;
		}
	}

	@media (max-width: 820px) {
		.landing-shell {
			width: min(100% - 36px, 1240px);
		}

		.landing-hero {
			min-height: 780px;
		}

		.hero-inner {
			min-height: 780px;
			padding-top: 64px;
		}

		.hero-plane {
			top: 0;
			width: 100%;
			height: 300px;
			clip-path: polygon(26% 0, 100% 0, 100% 100%, 0 100%);
		}

		.deployment-scene {
			top: 38px;
			right: 16px;
			width: min(580px, 95vw);
			transform: rotate(-4deg) scale(0.78);
			transform-origin: top right;
			opacity: 0.96;
		}

		.hero-copy {
			max-width: 600px;
			margin-top: 246px;
		}

		.hero-copy h1 {
			font-size: clamp(45px, 9vw, 68px);
		}

		.flow-list,
		.runtime-facts,
		.cost-facts {
			grid-template-columns: 1fr;
		}

		.flow-step,
		.flow-step + .flow-step,
		.runtime-fact,
		.runtime-fact + .runtime-fact,
		.cost-facts > div,
		.cost-facts > div + div {
			min-height: 0;
			padding: 22px 0;
			border-right: 0;
			border-bottom: 1px solid var(--landing-line);
		}

		.flow-step:last-child,
		.runtime-fact:nth-child(3n),
		.cost-facts > div:last-child {
			border-bottom: 0;
		}

		.flow-step {
			min-height: 190px;
		}

		.runtime-heading,
		.start-layout,
		.faq-layout {
			grid-template-columns: 1fr;
		}

		.runtime-heading {
			display: grid;
			align-items: start;
		}

		.runtime-metric {
			width: fit-content;
		}

		.runtime-diagram {
			grid-template-columns: 1fr;
			gap: 12px;
			margin-top: 58px;
			padding-block: 22px;
		}

		.runtime-line {
			width: 1px;
			height: 30px;
			margin-left: 30px;
		}

		.runtime-line::after {
			top: auto;
			bottom: 0;
			right: -4px;
			transform: rotate(135deg);
		}

		.runtime-regions {
			max-width: 380px;
		}

		.start-layout {
			display: grid;
			gap: 52px;
		}

		.landing-footer-inner {
			grid-template-columns: 1fr auto;
		}

		.landing-footer p {
			grid-column: 1 / -1;
			grid-row: 2;
		}
	}

	@media (max-width: 560px) {
		.landing-shell {
			width: min(100% - 28px, 1240px);
		}

		.landing-hero {
			min-height: 760px;
		}

		.hero-inner {
			min-height: 760px;
			padding-block: 42px 24px;
		}

		.deployment-scene {
			right: -38px;
			width: 560px;
			transform: rotate(-4deg) scale(0.44);
		}

		.hero-copy {
			margin-top: 275px;
		}

		.hero-brandline {
			margin-bottom: 18px;
			font-size: 9px;
		}

		.hero-brandline img {
			width: 31px;
			height: 31px;
		}

		.hero-copy h1 {
			font-size: 45px;
		}

		.hero-summary {
			margin-top: 18px;
			font-size: 15px;
			line-height: 1.58;
		}

		.hero-foot {
			gap: 8px 14px;
			font-size: 8px;
		}

		.landing-section {
			padding-block: 78px;
		}

		.section-intro h2 {
			font-size: 38px;
		}

		.runtime-node {
			min-height: 100px;
			padding: 18px;
		}

		.runtime-node strong {
			font-size: 20px;
		}

		.cost-facts strong {
			font-size: 52px;
		}

		.prompt-sheet pre {
			min-height: 200px;
			padding: 22px 18px;
		}

		.prompt-sheet code {
			font-size: 12px;
		}

		.landing-footer-inner {
			grid-template-columns: 1fr;
			gap: 18px;
		}

		.landing-footer p {
			grid-column: auto;
			grid-row: auto;
		}

		:global(.landing-footer-button) {
			width: fit-content;
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
