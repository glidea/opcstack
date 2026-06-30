<script lang="ts">
	import { browser } from "wxt/browser";
	import { storage } from "wxt/utils/storage";
	import { createClient } from "$frontend/api-client";
	import { AUTH_TOKEN_STORAGE_KEY } from "$frontend/api-client";
	import { clientConfig } from "$frontend/config/client";

	const client = createClient({
		baseUrl: clientConfig.apiBaseUrl,
		getToken: readToken,
	});

	let token = $state<string | undefined>(undefined);
	let loaded = $state(false);

	$effect(() => {
		void loadToken();
	});

	async function loadToken(): Promise<void> {
		token = await readToken();
		loaded = true;
	}

	async function readToken(): Promise<string | undefined> {
		return await storage.getItem<string>(`local:${AUTH_TOKEN_STORAGE_KEY}`);
	}

	async function openLogin(): Promise<void> {
		await browser.tabs.create({ url: `${clientConfig.webBaseUrl}/login` });
	}

	async function openConsole(): Promise<void> {
		await client.api.json<unknown>({
			path: "/api/health",
			method: "GET",
		});
		await browser.tabs.create({ url: clientConfig.webBaseUrl });
	}
</script>

<main>
	<img src="/icons/icon-48.png" alt="" />
	<h1>{clientConfig.appName}</h1>
	{#if !loaded}
		<p>Loading</p>
	{:else if token === undefined}
		<p>Not signed in</p>
		<button type="button" onclick={openLogin}>Sign in</button>
	{:else}
		<p>Signed in</p>
		<button type="button" onclick={openConsole}>Open console</button>
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: Inter, system-ui, sans-serif;
	}

	main {
		box-sizing: border-box;
		width: 280px;
		padding: 16px;
	}

	img {
		display: block;
		width: 48px;
		height: 48px;
	}

	h1 {
		margin: 12px 0 4px;
		font-size: 18px;
		font-weight: 650;
	}

	p {
		margin: 0;
		font-size: 12px;
		color: #666;
		word-break: break-all;
	}

	button {
		margin-top: 12px;
		width: 100%;
		height: 34px;
		border: 1px solid #111;
		background: #111;
		color: #fff;
		font: inherit;
		cursor: pointer;
	}
</style>
