import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const pagePath: string = fileURLToPath(new URL('./+page.svelte', import.meta.url))
const headerPath: string = fileURLToPath(
	new URL('./LandingHeader.svelte', import.meta.url)
)
const pageSource: string = readFileSync(pagePath, 'utf8')
const headerSource: string = readFileSync(headerPath, 'utf8')

describe('landing page design register', () => {
	test('uses real architecture proof as the hero visual', () => {
		expect({
			hasArchitecture: pageSource.includes('landing-architecture'),
			hasControlDatabase: pageSource.includes('META_DB'),
			hasTenantShards: pageSource.includes('D1 Shards')
		}).toEqual({
			hasArchitecture: true,
			hasControlDatabase: true,
			hasTenantShards: true
		})
	})

	test('removes generic landing page decoration', () => {
		const source: string = `${pageSource}\n${headerSource}`

		expect({
			hasNumberedSectionMarkers: source.includes('cf-section-no'),
			hasRepeatedEyebrows: source.includes('cf-section-kicker'),
			hasHeroMetrics: source.includes('cf-section-metric'),
			hasDecorativeGlobe: source.includes('cf-global-globe'),
			hasGlassNavigation: source.includes('backdrop-filter')
		}).toEqual({
			hasNumberedSectionMarkers: false,
			hasRepeatedEyebrows: false,
			hasHeroMetrics: false,
			hasDecorativeGlobe: false,
			hasGlassNavigation: false
		})
	})

	test('keeps the landing page free of decorative gradients', () => {
		expect({
			hasLinearGradient: pageSource.includes('linear-gradient'),
			hasRadialGradient: pageSource.includes('radial-gradient')
		}).toEqual({
			hasLinearGradient: false,
			hasRadialGradient: false
		})
	})
})
