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
		locale: pageLocale,
		docsEnabled
	}: {
		locale: string;
		docsEnabled: boolean;
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
			{#if docsEnabled}
				<a href={`/${pageLocale}/docs`}>{$_("home.nav.docs")}</a>
			{/if}
		</nav>

		<div class="landing-header-actions">
			<LocaleSwitcher current={$locale ?? defaultLocale} />
			{#if $session.data}
				<UserMenu onSignOut={() => {}} settingsHref={`/${pageLocale}/settings`} />
			{/if}
			{#if docsEnabled}
				<a class="landing-header-cta" href={`/${pageLocale}/docs/getting-started`} aria-label={$_("home.hero.cta.init")}>
					<span>{$_("home.hero.cta.init")}</span>
					<ArrowRightIcon class="size-4" />
				</a>
			{/if}
		</div>
	</div>
</header>

<style>
	.landing-header {
		position: sticky;
		top: 0;
		z-index: 50;
		height: 64px;
		border-bottom: 1px solid rgba(36, 33, 30, 0.15);
		background: #f5efe6;
		color: #24211e;
	}

	.landing-header-inner {
		display: flex;
		width: min(100% - 48px, 1240px);
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
		font-size: 16px;
		font-weight: 720;
		letter-spacing: 0;
	}

	.landing-brand img {
		display: block;
		width: 31px;
		height: 31px;
	}

	nav {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		gap: 28px;
	}

	nav a {
		color: #716a64;
		font-size: 13px;
		font-weight: 560;
		letter-spacing: 0;
		white-space: nowrap;
	}

	nav a:hover {
		color: #24211e;
	}

	.landing-header-actions {
		display: flex;
		flex: none;
		align-items: center;
		gap: 6px;
	}

	.landing-header-cta {
		display: flex;
		height: 36px;
		align-items: center;
		gap: 8px;
		margin-left: 8px;
		padding-inline: 14px;
		border-radius: 3px;
		background: #24211e;
		color: #fff;
		font-size: 13px;
		font-weight: 650;
		letter-spacing: 0;
	}

	.landing-header-cta:hover {
		background: #3a3531;
	}

	@media (max-width: 900px) {
		nav {
			display: none;
		}
	}

	@media (max-width: 560px) {
		.landing-header-inner {
			width: min(100% - 28px, 1240px);
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
