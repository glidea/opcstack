<script lang="ts">
	import { client } from "$apiContract/client";
	import LocaleSwitcher from "$frontend/app-ui/shell/LocaleSwitcher.svelte";
	import UserMenu from "$frontend/app-ui/shell/UserMenu.svelte";
	import { defaultLocale, locale } from "$frontend/i18n";
	import { _ } from "$frontend/i18n";
	import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";

	type NavItem = {
		id: string;
		key: string;
	};

	let {
		locale: pageLocale
	}: {
		locale: string;
	} = $props();

	const session = client.auth.useSession();
	const navItems: NavItem[] = [
		{ id: "loop", key: "home.nav.loop" },
		{ id: "diff", key: "home.nav.diff" },
		{ id: "cost", key: "home.nav.cost" },
		{ id: "steps", key: "home.nav.steps" }
	];
</script>

<header class="landing-header">
	<div class="landing-header-inner">
		<a href={`/${pageLocale}`} class="landing-brand" aria-label="OPCStack home">
			<img src="/logo.svg" alt="" />
			<span>OPCStack</span>
		</a>

		<nav aria-label="Sections">
			{#each navItems as item (item.id)}
				<a href={`#${item.id}`}>{$_(item.key)}</a>
			{/each}
			<a href={`/${pageLocale}/docs`}>{$_("home.nav.docs")}</a>
		</nav>

		<div class="landing-header-actions">
			<LocaleSwitcher current={$locale ?? defaultLocale} />
			{#if $session.data}
				<UserMenu onSignOut={() => {}} settingsHref={`/${pageLocale}/settings`} />
			{/if}
			<a class="landing-header-cta" href={`/${pageLocale}/docs/getting-started`}>
				<span>{$_("home.hero.cta.init")}</span>
				<ArrowRightIcon class="size-4" />
			</a>
		</div>
	</div>
</header>

<style>
	.landing-header {
		position: sticky;
		top: 0;
		z-index: 50;
		height: 64px;
		border-bottom: 1px solid #d9d9dc;
		background: #ffffff;
		color: #111113;
	}

	.landing-header-inner {
		display: flex;
		width: min(100% - 40px, 1240px);
		height: 100%;
		align-items: center;
		justify-content: space-between;
		gap: 28px;
		margin-inline: auto;
	}

	.landing-brand {
		display: flex;
		flex: none;
		align-items: center;
		gap: 10px;
		font-size: 15px;
		font-weight: 720;
		letter-spacing: 0;
	}

	.landing-brand img {
		display: block;
		width: 24px;
		height: 24px;
	}

	nav {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		gap: 28px;
	}

	nav a {
		color: #5f5f64;
		font-size: 13px;
		font-weight: 550;
		letter-spacing: 0;
		white-space: nowrap;
	}

	nav a:hover {
		color: #111113;
	}

	.landing-header-actions {
		display: flex;
		flex: none;
		align-items: center;
		gap: 4px;
	}

	.landing-header-cta {
		display: flex;
		height: 36px;
		align-items: center;
		gap: 8px;
		margin-left: 6px;
		padding-inline: 14px;
		border-radius: 6px;
		background: #111113;
		color: #ffffff;
		font-size: 13px;
		font-weight: 620;
		letter-spacing: 0;
	}

	.landing-header-cta:hover {
		background: #2b2b2f;
	}

	@media (max-width: 900px) {
		nav {
			display: none;
		}
	}

	@media (max-width: 560px) {
		.landing-header-inner {
			width: min(100% - 24px, 1240px);
		}

		.landing-header-cta span {
			display: none;
		}

		.landing-header-cta {
			width: 36px;
			justify-content: center;
			padding: 0;
		}
	}
</style>
