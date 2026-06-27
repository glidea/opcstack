import { describe } from 'vitest'
import { runCases, type TestCase } from '../../../backend/testing/bdd'
import {
	buildDocsManifest,
	docPathToLocaleAndSlug,
	fallbackDocGroup,
	fallbackDocTitle,
	getDocNeighbors,
	getDocSwitchPath,
	slugToDocPath,
	type DocsManifest
} from './docs'

type EmptyWhenDetail = Record<string, never>

type PathGivenDetail = {
	sourcePath: string
	locale: string
	slug: string
}

type PathExpected = {
	locale: string
	slug: string
	sourcePath: string
}

describe('docs path mapping', () => {
	const cases: TestCase<PathGivenDetail, EmptyWhenDetail, PathExpected>[] = [
		{
			scenario: 'map public docs path and slug',
			given: 'locale docs source path',
			when: 'converting between path and slug',
			then: 'keeps locale and slug stable',
			givenDetail: {
				sourcePath: '/public-docs/zh/guides/install.md',
				locale: 'zh',
				slug: 'guides/install'
			},
			whenDetail: {},
			thenExpected: {
				locale: 'zh',
				slug: 'guides/install',
				sourcePath: '/public-docs/zh/guides/install.md'
			}
		}
	]

	runCases(cases, (given: PathGivenDetail): PathExpected => {
		const parsed: { locale: string; slug: string } = docPathToLocaleAndSlug(given.sourcePath)

		return {
			locale: parsed.locale,
			slug: parsed.slug,
			sourcePath: slugToDocPath(given.locale, given.slug)
		}
	})
})

type FallbackGivenDetail = {
	slug: string
}

type FallbackExpected = {
	title: string
	group: string
}

describe('docs fallback metadata', () => {
	const cases: TestCase<FallbackGivenDetail, EmptyWhenDetail, FallbackExpected>[] = [
		{
			scenario: 'build fallback metadata for nested doc',
			given: 'nested slug without frontmatter',
			when: 'resolving fallback metadata',
			then: 'uses readable title and first segment group',
			givenDetail: { slug: 'getting-started/install-guide' },
			whenDetail: {},
			thenExpected: {
				title: 'Getting Started / Install Guide',
				group: 'Getting Started'
			}
		},
		{
			scenario: 'build fallback metadata for root doc',
			given: 'root slug without frontmatter',
			when: 'resolving fallback metadata',
			then: 'uses getting started group',
			givenDetail: { slug: 'intro' },
			whenDetail: {},
			thenExpected: {
				title: 'Intro',
				group: 'Getting Started'
			}
		}
	]

	runCases(cases, (given: FallbackGivenDetail): FallbackExpected => {
		return {
			title: fallbackDocTitle(given.slug),
			group: fallbackDocGroup(given.slug)
		}
	})
})

type ManifestGivenDetail = {
	modules: Record<string, string>
}

type ManifestExpected = {
	locales: string[]
	zhHomeSlug: string
	zhDocSlugs: string[]
	zhGroups: string[]
	firstDocHeadings: Array<{ id: string; text: string; level: 2 | 3 }>
	firstDocHasLeadingH1: boolean
	switchPathForExistingSlug: string
	switchPathForMissingSlug: string
	nextTitle: string | null
	previousTitle: string | null
}

describe('buildDocsManifest', () => {
	const cases: TestCase<ManifestGivenDetail, EmptyWhenDetail, ManifestExpected>[] = [
		{
			scenario: 'build locale manifest from markdown modules',
			given: 'markdown docs with frontmatter and headings',
			when: 'building docs manifest',
			then: 'sorts docs and exposes navigation data',
			givenDetail: {
				modules: {
					'/public-docs/zh/intro.md': [
						'---',
						'title: Intro',
						'description: Intro desc',
						'group: Start',
						'order: 2',
						'---',
						'# Intro',
						'## Install',
						'Text'
					].join('\n'),
					'/public-docs/zh/setup.md': [
						'---',
						'title: Setup',
						'group: Start',
						'order: 1',
						'---',
						'# Setup',
						'## Configure'
					].join('\n'),
					'/public-docs/en/intro.md': '# Intro'
				}
			},
			whenDetail: {},
			thenExpected: {
				locales: ['en', 'zh'],
				zhHomeSlug: 'setup',
				zhDocSlugs: ['setup', 'intro'],
				zhGroups: ['Start'],
				firstDocHeadings: [{ id: 'configure', text: 'Configure', level: 2 }],
				firstDocHasLeadingH1: false,
				switchPathForExistingSlug: '/zh/docs/intro',
				switchPathForMissingSlug: '/zh/docs/setup',
				nextTitle: 'Intro',
				previousTitle: null
			}
		}
	]

	runCases(cases, async (given: ManifestGivenDetail): Promise<ManifestExpected> => {
		const manifest: DocsManifest = await buildDocsManifest(given.modules)
		const zhManifest = manifest.byLocale['zh']
		const zhDocs = zhManifest?.docs ?? []
		const neighbors = getDocNeighbors(zhDocs, 'setup')

		return {
			locales: manifest.locales,
			zhHomeSlug: zhManifest?.homeSlug ?? '',
			zhDocSlugs: zhDocs.map((doc) => doc.slug),
			zhGroups: zhManifest?.groups.map((group) => group.title) ?? [],
			firstDocHeadings: zhDocs[0]?.headings ?? [],
			firstDocHasLeadingH1: zhDocs[0]?.contentHtml.includes('<h1') ?? false,
			switchPathForExistingSlug: getDocSwitchPath(manifest, 'zh', 'intro'),
			switchPathForMissingSlug: getDocSwitchPath(manifest, 'zh', 'missing'),
			nextTitle: neighbors.next?.title ?? null,
			previousTitle: neighbors.previous?.title ?? null
		}
	})
})
