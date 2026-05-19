import {
	defaultLocale,
	isSystemLocale,
	supportedLocales,
	type SystemLocale
} from '$web/i18n/locales'
import type { PublicConfig } from '$web/config/client'
import { getServerPublicConfig, serverConfig } from '$web/config/server.server'
import { resolveSiteOrigin, serializeJsonLd, toSiteUrl } from '$web/seo'

type AlternateUrl = {
	locale: string
	url: string
}

export async function load(event: {
	params: { locale?: string }
	url: URL
}): Promise<{
	locale: SystemLocale
	siteName: string
	supportEmail: string
	siteUrl: string
	logoUrl: string
	canonicalUrl: string
	alternateUrls: AlternateUrl[]
	xDefaultUrl: string
	websiteJsonLd: string
	publicConfig: PublicConfig
}> {
	const origin = resolveSiteOrigin(serverConfig.APP_DOMAIN)
	const siteName = serverConfig.APP_NAME
	const locale = resolveLocale(event.params.locale)
	const supportEmail = serverConfig.SUPPORT_EMAIL
	const publicConfig = getServerPublicConfig()
	const alternateUrls = supportedLocales.map((locale) => {
		return {
			locale,
			url: toSiteUrl(origin, resolveLocalePath(event.url.pathname, locale))
		}
	})

	return {
		locale,
		siteName,
		supportEmail,
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
		}),
		publicConfig
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

function resolveLocale(input: string | undefined): SystemLocale {
	if (input && isSystemLocale(input)) {
		return input
	}
	return defaultLocale
}
