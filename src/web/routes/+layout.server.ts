import {
	defaultLocale,
	isSystemLocale,
	supportedLocales,
	type SystemLocale
} from '$web/i18n/locales'
import { AppConfig } from '$web/server/app-config'
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
	supportEmail: string
	siteUrl: string
	logoUrl: string
	canonicalUrl: string
	alternateUrls: AlternateUrl[]
	xDefaultUrl: string
	websiteJsonLd: string
} {
	const origin = resolveSiteOrigin(AppConfig.APP_DOMAIN)
	const siteName = AppConfig.APP_NAME
	const locale = resolveLocale(event.params.locale)
	const supportEmail = AppConfig.SUPPORT_EMAIL
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

function resolveLocale(input: string | undefined): SystemLocale {
	if (input && isSystemLocale(input)) {
		return input
	}
	return defaultLocale
}
