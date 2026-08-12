import {
	defaultLocale,
	isSystemLocale,
	supportedLocales,
	type SystemLocale
} from '$frontend/i18n/locales'
import { clientConfig } from '$frontend/config/client'
import type { PublicRuntimeConfig } from '$backend/config'

type AlternateUrl = {
	locale: string
	url: string
}

export async function load(event: {
	params: { locale?: string }
	url: URL
	locals: { publicRuntimeConfig: PublicRuntimeConfig }
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
	publicRuntimeConfig: PublicRuntimeConfig
}> {
	const origin = clientConfig.webBaseUrl
	const siteName = clientConfig.appName
	const locale = resolveLocale(event.params.locale)
	const supportEmail = event.locals.publicRuntimeConfig.support_email
	const alternateUrls = supportedLocales.map((locale) => {
		return {
			locale,
			url: new URL(resolveLocalePath(event.url.pathname, locale), origin).toString()
		}
	})

	return {
		locale,
		siteName,
		supportEmail,
		siteUrl: new URL('/', origin).toString(),
		logoUrl: new URL('/logo.svg', origin).toString(),
		canonicalUrl: new URL(event.url.pathname, origin).toString(),
		alternateUrls,
		publicRuntimeConfig: event.locals.publicRuntimeConfig,
		xDefaultUrl: new URL(resolveLocalePath(event.url.pathname, defaultLocale), origin).toString(),
		websiteJsonLd: JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			name: siteName,
			url: new URL('/', origin).toString()
		}).replace(/</g, '\\u003c')
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
