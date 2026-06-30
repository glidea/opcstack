import { clientConfig } from '$frontend/config/client'

export const prerender = true

export function GET(): Response {
	const body = `User-agent: *\nAllow: /\nSitemap: ${clientConfig.webBaseUrl}/sitemap.xml\n`
	return new Response(body, {
		headers: {
			'content-type': 'text/plain; charset=utf-8'
		}
	})
}
