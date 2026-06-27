import { serverConfig } from '$web/config/server.server'
import { resolveSiteOrigin } from '$web/seo'

export const prerender = true

export function GET(): Response {
	const origin = resolveSiteOrigin(serverConfig.APP_DOMAIN)
	const body = `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
	return new Response(body, {
		headers: {
			'content-type': 'text/plain; charset=utf-8'
		}
	})
}
