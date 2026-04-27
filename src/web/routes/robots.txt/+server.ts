import { env } from '$env/dynamic/private'

export const prerender = true

export function GET(): Response {
	const origin = resolveSiteOrigin(env['APP_DOMAIN'] ?? 'localhost')
	const body = `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
	return new Response(body, {
		headers: {
			'content-type': 'text/plain; charset=utf-8'
		}
	})
}

function resolveSiteOrigin(domain: string): string {
	const normalized = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
	if (normalized === 'localhost') {
		return 'http://localhost:5173'
	}
	if (normalized.startsWith('localhost:')) {
		return `http://${normalized}`
	}
	return `https://${normalized}`
}
