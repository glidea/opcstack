import { env as privateEnv } from '$env/dynamic/private'
import {
	defaultLocale,
	isSystemLocale,
	supportedLocales,
	type SystemLocale
} from '$web/i18n/locales'
import { resolveSiteOrigin, serializeJsonLd, toSiteUrl } from '$web/seo'

type AlternateUrl = {
	locale: string
	url: string
}

type RuntimeEnv = Record<string, string | undefined>

export function load(event: {
	params: { locale?: string }
	url: URL
	platform?: { env?: RuntimeEnv }
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
	const origin = resolveSiteOrigin(getRuntimeEnv(event, 'APP_DOMAIN', 'localhost'))
	const siteName = getRuntimeEnv(event, 'APP_NAME', 'OPCStack')
	const locale = resolveLocale(event.params.locale)
	const supportEmail = getRuntimeEnv(event, 'SUPPORT_EMAIL', 'support@example.com')
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

function getRuntimeEnv(event: { platform?: { env?: RuntimeEnv } }, key: string, fallback: string): string {
	return event.platform?.env?.[key] ?? privateEnv[key] ?? fallback
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
