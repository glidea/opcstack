import { describe, expect, it } from 'vitest'
import { resolveSiteOrigin, serializeJsonLd, toSiteUrl } from './index'

describe('resolveSiteOrigin', () => {
	it('uses local dev origin for localhost', () => {
		expect(resolveSiteOrigin('localhost')).toBe('http://localhost:5173')
	})

	it('uses http for localhost with port', () => {
		expect(resolveSiteOrigin('localhost:8787')).toBe('http://localhost:8787')
	})

	it('uses https for production domain', () => {
		expect(resolveSiteOrigin('opcstack.glidea.app')).toBe('https://opcstack.glidea.app')
	})

	it('normalizes domain with protocol and trailing slash', () => {
		expect(resolveSiteOrigin('https://opcstack.glidea.app/')).toBe('https://opcstack.glidea.app')
	})
})

describe('toSiteUrl', () => {
	it('builds absolute URL from site origin and path', () => {
		expect(toSiteUrl('https://opcstack.glidea.app', '/zh/docs')).toBe('https://opcstack.glidea.app/zh/docs')
	})
})

describe('serializeJsonLd', () => {
	it('escapes html opening bracket', () => {
		expect(serializeJsonLd({ name: '<script>' })).toBe('{"name":"\\u003cscript>"}')
	})
})
