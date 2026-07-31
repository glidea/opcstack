import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const pagePath: string = fileURLToPath(new URL('./+page.svelte', import.meta.url))
const source: string = readFileSync(pagePath, 'utf8')

function extractRule(selector: string): string {
	const pattern: RegExp = new RegExp(`${escapeRegExp(selector)}\\s*\\{([\\s\\S]*?)\\}`, 'm')
	const match: RegExpMatchArray | null = source.match(pattern)
	if (match === null) {
		throw new Error(`Missing CSS rule: ${selector}`)
	}

	const body: string | undefined = match[1]
	if (body === undefined) {
		throw new Error(`Missing CSS body: ${selector}`)
	}

	return body
}

function extractMediaRule(mediaQuery: string, selector: string): string {
	const mediaIndex: number = source.indexOf(`@media ${mediaQuery}`)
	if (mediaIndex === -1) {
		throw new Error(`Missing media query: ${mediaQuery}`)
	}

	const mediaSource: string = source.slice(mediaIndex)
	const pattern: RegExp = new RegExp(`${escapeRegExp(selector)}\\s*\\{([\\s\\S]*?)\\}`, 'm')
	const match: RegExpMatchArray | null = mediaSource.match(pattern)
	if (match === null) {
		throw new Error(`Missing media CSS rule: ${selector}`)
	}

	const body: string | undefined = match[1]
	if (body === undefined) {
		throw new Error(`Missing media CSS body: ${selector}`)
	}

	return body
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

describe('home hero mobile layout', () => {
	test('keeps deploy graph out of mobile layout', () => {
		const mobileRule: string = extractRule('.cf-hero-visual')
		const desktopRule: string = extractMediaRule('(min-width: 1024px)', '.cf-hero-visual')

		expect({
			mobileHidden: mobileRule.includes('display: none'),
			desktopVisible: desktopRule.includes('display: flex')
		}).toEqual({
			mobileHidden: true,
			desktopVisible: true
		})
	})

	test('keeps decorative globe from blocking hero actions', () => {
		const globeRule: string = extractRule('.cf-global-globe')

		expect({
			ignoresPointerEvents: globeRule.includes('pointer-events: none')
		}).toEqual({
			ignoresPointerEvents: true
		})
	})
})
