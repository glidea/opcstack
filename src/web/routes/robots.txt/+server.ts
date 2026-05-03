import { env } from '$env/dynamic/private'
import { resolveSiteOrigin } from '$web/seo'

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
