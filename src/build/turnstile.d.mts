export const TURNSTILE_TEST_SITE_KEY: string
export const TURNSTILE_TEST_SECRET_KEY: string

export type TurnstileWidget = {
	name: string
	sitekey: string
	secret: string
}

export type TurnstileConfig = {
	enabled: string
	siteKey: string
	secretKey: string
}

export function resolveTurnstileConfig(input: {
	enabled: string
	isRemote: boolean
	widget?: TurnstileWidget
}): TurnstileConfig

export function selectTurnstileWidget(
	widgets: TurnstileWidget[],
	appName: string
): TurnstileWidget | undefined
