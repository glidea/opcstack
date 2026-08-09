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
	test('uses a branded deployment object as the hero visual', () => {
		expect({
			hasDeploymentScene: pageSource.includes('deployment-scene'),
			hasRuntimeLayer: pageSource.includes('data-layer="worker-runtime"'),
			hasControlLayer: pageSource.includes('data-layer="control-plane"'),
			hasTenantLayer: pageSource.includes('data-layer="tenant-data"')
		}).toEqual({
			hasDeploymentScene: true,
			hasRuntimeLayer: true,
			hasControlLayer: true,
			hasTenantLayer: true
		})
	})

	test('removes the rejected specification page patterns', () => {
		const source: string = `${pageSource}\n${headerSource}`

		expect({
			hasArchitectureTable: source.includes('landing-architecture'),
			hasComparisonTable: source.includes('comparison-table'),
			hasPricingTable: source.includes('pricing-table'),
			hasTerminalCard: source.includes('quick-start-terminal'),
			hasGlassNavigation: source.includes('backdrop-filter')
		}).toEqual({
			hasArchitectureTable: false,
			hasComparisonTable: false,
			hasPricingTable: false,
			hasTerminalCard: false,
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
