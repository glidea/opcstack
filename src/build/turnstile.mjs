export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'
export const TURNSTILE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA'

export function resolveTurnstileConfig(input) {
	if (input.enabled !== 'true') {
		return {
			enabled: 'false',
			siteKey: '',
			secretKey: ''
		}
	}

	if (!input.isRemote) {
		return {
			enabled: 'true',
			siteKey: TURNSTILE_TEST_SITE_KEY,
			secretKey: TURNSTILE_TEST_SECRET_KEY
		}
	}

	if (!input.widget) {
		throw new Error('TURNSTILE_WIDGET_MISSING')
	}

	return {
		enabled: 'true',
		siteKey: input.widget.sitekey,
		secretKey: input.widget.secret
	}
}

export function selectTurnstileWidget(widgets, appName) {
	const matches = widgets.filter((widget) => {
		return widget.name === appName
	})

	if (matches.length > 1) {
		throw new Error('TURNSTILE_WIDGET_DUPLICATED')
	}

	return matches[0]
}
