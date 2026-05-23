<script lang="ts">
	import { onMount } from 'svelte'

	type TurnstileApi = {
		render: (
			element: HTMLElement,
			options: {
				sitekey: string
				callback: (token: string) => void
				'expired-callback': () => void
				'error-callback': () => void
				size: 'flexible'
			}
		) => string
		reset: (widgetId: string) => void
	}

	type TurnstileWindow = Window & {
		turnstile?: TurnstileApi
	}

	let {
		siteKey,
		onToken,
		onReset
	}: {
		siteKey: string
		onToken: (token: string) => void
		onReset: () => void
	} = $props()

	let container: HTMLDivElement
	let widgetId = ''

	onMount((): void => {
		loadTurnstileScript().then((): void => {
			const api = readTurnstileApi()
			widgetId = api.render(container, {
				sitekey: siteKey,
				callback: onToken,
				'expired-callback': handleReset,
				'error-callback': handleReset,
				size: 'flexible'
			})
		})
	})

	export function reset(): void {
		if (widgetId === '') {
			return
		}
		readTurnstileApi().reset(widgetId)
		onReset()
	}

	function handleReset(): void {
		onReset()
	}

	function readTurnstileApi(): TurnstileApi {
		const browserWindow: TurnstileWindow = window as TurnstileWindow
		if (!browserWindow.turnstile) {
			throw new Error('Cloudflare Turnstile script is not loaded')
		}
		return browserWindow.turnstile
	}

	function loadTurnstileScript(): Promise<void> {
		const browserWindow: TurnstileWindow = window as TurnstileWindow
		if (browserWindow.turnstile) {
			return Promise.resolve()
		}

		return new Promise<void>((resolve: () => void): void => {
			const script = document.createElement('script')
			script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
			script.async = true
			script.defer = true
			script.onload = (): void => {
				resolve()
			}
			document.head.appendChild(script)
		})
	}
</script>

<div bind:this={container}></div>
