import { env } from '$env/dynamic/private'
import { defaultLocale, supportedLocales, type SystemLocale } from '$web/i18n/locales'
import { resolveSiteOrigin, serializeJsonLd, toSiteUrl } from '$web/seo'

type AlternateUrl = {
	locale: string
	url: string
}

export function load(event: {
	params: { locale?: string }
	url: URL
}): {
	locale: SystemLocale
	siteName: string
	siteUrl: string
	logoUrl: string
	canonicalUrl: string
	alternateUrls: AlternateUrl[]
	xDefaultUrl: string
	websiteJsonLd: string
} {
	const origin = resolveSiteOrigin(env['APP_DOMAIN'] ?? 'localhost')
	const siteName = env['APP_NAME'] ?? 'OPCStack'
	const alternateUrls = supportedLocales.map((locale) => {
		return {
			locale,
			url: toSiteUrl(origin, resolveLocalePath(event.url.pathname, locale))
		}
	})

	return {
		locale: event.params.locale as SystemLocale,
		siteName,
		siteUrl: toSiteUrl(origin, '/'),
		logoUrl: toSiteUrl(origin, '/logo.svg'),
		canonicalUrl: toSiteUrl(origin, event.url.pathname),
		alternateUrls,
		xDefaultUrl: toSiteUrl(origin, resolveLocalePath(event.url.pathname, defaultLocale)),
		websiteJsonLd: serializeJsonLd({
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			name: siteName,
			url: toSiteUrl(origin, '/')
		})
	}
}

function resolveLocalePath(pathname: string, locale: string): string {
	const segments = pathname.split('/').filter((segment) => segment !== '')
	if (segments.length === 0) {
		return `/${locale}`
	}

	segments[0] = locale
	return `/${segments.join('/')}`
}
