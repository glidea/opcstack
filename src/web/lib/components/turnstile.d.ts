export type TurnstileApi = {
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

declare global {
	interface Window {
		turnstile: TurnstileApi
	}
}
