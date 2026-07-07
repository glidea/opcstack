<script lang="ts">
	import { _ } from "$frontend/i18n";
	import { defaultLocale, locale } from "$frontend/i18n";
	import { client } from "$apiContract/client";
	import LocaleSwitcher from "$frontend/app-ui/shell/LocaleSwitcher.svelte";
	import UserMenu from "$frontend/app-ui/shell/UserMenu.svelte";
	import { Button } from "$frontend/ui/button";

	type NavItem = {
		id: string;
		key: string;
	};

	let {
		locale: pageLocale,
	}: {
		// current page locale, used to build locale-scoped hrefs
		locale: string;
	} = $props();

	const session = client.auth.useSession();

	// anchor nav targets, ids match the sections in +page.svelte
	const navItems: NavItem[] = [
		{ id: "loop", key: "home.nav.loop" },
		{ id: "cost", key: "home.nav.cost" },
		{ id: "diff", key: "home.nav.diff" },
		{ id: "steps", key: "home.nav.steps" },
		{ id: "faq", key: "home.nav.faq" },
	];

	// tighten the capsule after the page scrolls a bit, with hysteresis to
	// avoid flicker right around the threshold
	let scrolled: boolean = $state(false);
	// id of the section currently in view, drives the nav dot indicator
	let activeId: string = $state("");

	let ticking: boolean = false;

	function onScroll(): void {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(() => {
			const y = window.scrollY;
			// hysteresis: enter at 16px, leave only below 4px
			if (!scrolled && y > 16) scrolled = true;
			else if (scrolled && y < 4) scrolled = false;
			ticking = false;
		});
	}

	// $effect runs on the client only, so window / IntersectionObserver are safe
	$effect(() => {
		onScroll();

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) activeId = entry.target.id;
				}
			},
			// a band across the upper-middle viewport decides the active section
			{ rootMargin: "-45% 0px -50% 0px", threshold: 0 },
		);

		for (const item of navItems) {
			const el = document.getElementById(item.id);
			if (el) observer.observe(el);
		}

		return () => observer.disconnect();
	});
</script>

<svelte:window on:scroll={onScroll} />

<div class="cf-header-slot" data-scrolled={scrolled ? true : undefined}>
	<header class="cf-capsule">
		<a href={`/${pageLocale}`} class="cf-capsule-logo" aria-label="Home">
			<img src="/logo.svg" alt="logo" class="block h-6 w-auto" />
		</a>

		<span class="cf-capsule-sep" aria-hidden="true"></span>

		<nav class="cf-capsule-nav" aria-label="Sections">
			{#each navItems as item (item.id)}
				<a
					href={`#${item.id}`}
					class="cf-capsule-link"
					data-active={activeId === item.id ? true : undefined}
					aria-current={activeId === item.id ? "true" : undefined}
				>
					{$_(item.key)}
					<span class="cf-capsule-dot" aria-hidden="true"></span>
				</a>
			{/each}
			<!-- docs is a route link, not an in-page anchor, so no dot tracking -->
			<a href={`/${pageLocale}/docs`} class="cf-capsule-link">
				{$_("home.nav.docs")}
				<span class="cf-capsule-dot" aria-hidden="true"></span>
			</a>
		</nav>

		<div class="cf-capsule-actions">
			<LocaleSwitcher current={$locale ?? defaultLocale} />
			{#if $session.data}
				<UserMenu onSignOut={() => {}} settingsHref={`/${pageLocale}/settings`} />
			{/if}
		</div>
	</header>
</div>

<style>
	.cf-header-slot {
		position: fixed;
		inset-inline: 0;
		top: 14px;
		z-index: 50;
		display: flex;
		justify-content: center;
		padding-inline: 16px;
		pointer-events: none;
	}

	.cf-capsule {
		position: relative;
		display: flex;
		width: 100%;
		max-width: 1080px;
		align-items: center;
		gap: 14px;
		border-radius: 999px;
		/* crisp light edge, brighter than before so the glass rim reads clean */
		border: 1px solid rgba(255, 255, 255, 0.65);
		/* vertical micro-gradient reads as a lit glass surface, not flat fill */
		background:
			linear-gradient(180deg, rgba(255, 253, 250, 0.82) 0%, rgba(252, 249, 244, 0.72) 100%);
		padding: 8px 10px 8px 18px;
		/* only the inset light bevel stays here, kept static to avoid repaint */
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.95),
			inset 0 -1px 0 rgba(30, 25, 20, 0.04);
		backdrop-filter: blur(16px) saturate(1.25) brightness(1.02);
		pointer-events: auto;
		transform-origin: top center;
		/* only transform animates → GPU composited, no reflow, no repaint */
		transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
		will-change: transform;
	}

	/* two stacked shadow layers cross-fade via opacity (composited), so the
	   depth change on scroll never triggers a box-shadow repaint */
	.cf-capsule::before,
	.cf-capsule::after {
		content: "";
		position: absolute;
		inset: 0;
		z-index: -1;
		border-radius: inherit;
		transition: opacity 260ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	/* rest depth: soft neutral drop, wide ambient */
	.cf-capsule::before {
		opacity: 1;
		box-shadow:
			0 1px 2px rgba(30, 25, 20, 0.06),
			0 6px 16px -4px rgba(30, 25, 20, 0.1),
			0 20px 40px -16px rgba(30, 25, 20, 0.16);
	}

	/* scrolled depth: tighter and slightly deeper */
	.cf-capsule::after {
		opacity: 0;
		box-shadow:
			0 1px 2px rgba(30, 25, 20, 0.08),
			0 4px 12px -4px rgba(30, 25, 20, 0.12),
			0 14px 30px -14px rgba(30, 25, 20, 0.2);
	}

	/* tighten on scroll: equal-scale shrink + settle upward, pure composite */
	.cf-header-slot[data-scrolled] .cf-capsule {
		transform: scale(0.955) translateY(-2px);
	}

	.cf-header-slot[data-scrolled] .cf-capsule::before {
		opacity: 0;
	}

	.cf-header-slot[data-scrolled] .cf-capsule::after {
		opacity: 1;
	}

	.cf-capsule-logo {
		display: flex;
		flex: none;
		align-items: center;
	}

	/* tiny neutral dot separating logo from nav, quiet not brand-loud */
	.cf-capsule-sep {
		flex: none;
		width: 4px;
		height: 4px;
		border-radius: 999px;
		background: rgba(32, 26, 22, 0.18);
	}

	.cf-capsule-nav {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		gap: 2px;
	}

	.cf-capsule-link {
		position: relative;
		border-radius: 999px;
		padding: 8px 15px 9px;
		color: rgba(32, 26, 22, 0.64);
		font-size: 14px;
		font-weight: 600;
		line-height: 1;
		white-space: nowrap;
		transition:
			color 180ms ease,
			background 180ms ease;
	}

	.cf-capsule-link:hover {
		color: #201a16;
		background: rgba(32, 26, 22, 0.05);
	}

	.cf-capsule-link[data-active] {
		color: #201a16;
	}

	/* active-section indicator, a small warm dot under the label */
	.cf-capsule-dot {
		position: absolute;
		bottom: 1px;
		left: 50%;
		width: 4px;
		height: 4px;
		border-radius: 999px;
		background: #ff500a;
		box-shadow: 0 0 8px rgba(255, 80, 10, 0.6);
		opacity: 0;
		transform: translateX(-50%) scale(0.4);
		transition:
			opacity 200ms cubic-bezier(0.22, 1, 0.36, 1),
			transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.cf-capsule-link[data-active] .cf-capsule-dot {
		opacity: 1;
		transform: translateX(-50%) scale(1);
	}

	.cf-capsule-actions {
		display: flex;
		flex: none;
		align-items: center;
		gap: 6px;
		/* hairline warm divider before the action cluster */
		padding-left: 8px;
		border-left: 1px solid rgba(32, 26, 22, 0.08);
	}

	/* warm solid CTA with a lit top edge and a soft orange cast, no cold black */
	:global(.cf-capsule-cta) {
		border-radius: 999px;
		background: #ff500a;
		color: white;
		font-weight: 650;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.32),
			0 4px 12px rgba(224, 67, 5, 0.28);
		transition:
			transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
			box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1),
			background 180ms ease;
	}

	:global(.cf-capsule-cta:hover) {
		background: #ff6a2b;
		transform: translateY(-1px);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.4),
			0 6px 18px rgba(224, 67, 5, 0.36);
	}

	:global(.cf-capsule-cta:active) {
		transform: translateY(0);
	}

	/* hide center nav on smaller screens, keep logo + actions */
	@media (max-width: 860px) {
		.cf-capsule-nav,
		.cf-capsule-sep {
			display: none;
		}

		.cf-capsule {
			justify-content: space-between;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.cf-capsule,
		.cf-capsule-dot {
			transition: none;
		}

		:global(.cf-capsule-cta) {
			transition: none;
		}

		.cf-header-slot[data-scrolled] .cf-capsule {
			transform: none;
		}
	}
</style>
