<script lang="ts">
	import { browser } from 'wxt/browser'
	import { storage } from 'wxt/utils/storage'
	import { createApiClient } from '$web/api-client'
	import { readAuthToken, type AuthTokenStorage } from '$web/auth/client'
	import { clientConfig } from '$web/config/client'

	const authStorage: AuthTokenStorage = {
		getItem: (key: string): Promise<string | null> => storage.getItem<string>(`local:${key}`),
		setItem: (key: string, value: string): Promise<void> => storage.setItem(`local:${key}`, value),
		removeItem: (key: string): Promise<void> => storage.removeItem(`local:${key}`)
	}
	const apiClient = createApiClient({
		baseUrl: clientConfig.apiBaseUrl,
		fetchApi: fetch,
		getToken: () => readAuthToken(authStorage)
	})

	let token = $state<string | undefined>(undefined)
	let loaded = $state(false)

	$effect(() => {
		void loadToken()
	})

	async function loadToken(): Promise<void> {
		token = await readAuthToken(authStorage)
		loaded = true
	}

	async function openLogin(): Promise<void> {
		await browser.tabs.create({ url: `${clientConfig.webBaseUrl}/login` })
	}

	async function openConsole(): Promise<void> {
		await apiClient.requestJson<unknown>({ path: '/api/health', method: 'GET' })
		await browser.tabs.create({ url: clientConfig.webBaseUrl })
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
