export function resolveSiteOrigin(domain: string): string {
	const normalized = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
	if (normalized === 'localhost') {
		return 'http://localhost:5173'
	}
	if (normalized.startsWith('localhost:')) {
		return `http://${normalized}`
	}
	return `https://${normalized}`
}

export function toSiteUrl(origin: string, path: string): string {
	return new URL(path, origin).toString()
}

export function serializeJsonLd(value: Record<string, unknown>): string {
	return JSON.stringify(value).replace(/</g, '\\u003c')
}
