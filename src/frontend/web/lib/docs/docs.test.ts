import { describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../../../backend/testing/bdd'
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

const adminConsoleDocs: Record<string, string> = import.meta.glob<string>(
	'/public-docs/{en,zh}/guides/admin-console.md',
	{
		eager: true,
		import: 'default',
		query: '?raw'
	}
)

const gettingStartedDocs: Record<string, string> = import.meta.glob<string>(
	'/public-docs/{en,zh}/getting-started.md',
	{
		eager: true,
		import: 'default',
		query: '?raw'
	}
)

type AdminConsoleDocsExpected = {
	locales: string[]
	coversAllRoutes: boolean
}

describe('admin console operator docs', () => {
	const cases: TestCase<EmptyWhenDetail, EmptyWhenDetail, AdminConsoleDocsExpected>[] = [
		{
			scenario: 'publish localized admin console guides',
			given: 'English and Chinese operator documentation',
			when: 'checking the documented admin routes',
			then: 'both guides cover every admin page',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				locales: ['en', 'zh'],
				coversAllRoutes: true
			}
		}
	]

	runCases(cases, (): AdminConsoleDocsExpected => {
		const routes: string[] = [
			'/admin/dashboard',
			'/admin/users',
			'/admin/beta-codes',
			'/admin/credit-codes',
			'/admin/feedback',
			'/admin/notifications',
			'/admin/payments',
			'/admin/ai-tasks'
		]
		const entries: Array<[string, string]> = Object.entries(adminConsoleDocs)
		const locales: string[] = entries
			.map(([path]: [string, string]): string => path.split('/')[2] ?? '')
			.sort()

		return {
			locales,
			coversAllRoutes: entries.every(([, content]: [string, string]): boolean => {
				return routes.every((route: string): boolean => content.includes(route))
			})
		}
	})
})

describe('published getting started docs', () => {
	const cases: TestCase<EmptyWhenDetail, EmptyWhenDetail, { locales: string[] }>[] = [
		{
			scenario: 'render localized getting started pages',
			given: 'the published English and Chinese markdown files',
			when: 'building the runtime docs manifest',
			then: 'renders both pages without runtime WebAssembly',
			givenDetail: {},
			whenDetail: {},
			thenExpected: { locales: ['en', 'zh'] }
		}
	]

	runCases(cases, async (): Promise<{ locales: string[] }> => {
		const instantiate = vi.spyOn(WebAssembly, 'instantiate').mockImplementation((): never => {
			throw new WebAssembly.CompileError('Wasm code generation disallowed by embedder')
		})
		try {
			const manifest: DocsManifest = await buildDocsManifest(gettingStartedDocs)
			return { locales: manifest.locales }
		} finally {
			instantiate.mockRestore()
		}
	})
})

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
	firstDocLinks: {
		frontend: boolean
		database: boolean
	}
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
						'group_order: 2',
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
						'group_order: 2',
						'order: 1',
						'---',
						'# Setup',
						'## Configure'
					].join('\n'),
					'/public-docs/zh/architecture.md': [
						'---',
						'title: Architecture',
						'group: Architecture',
						'group_order: 1',
						'order: 2',
						'---',
						'# Architecture'
					].join('\n'),
					'/public-docs/zh/index.md': [
						'---',
						'title: Overview',
						'group: Overview',
						'group_order: 0',
						'order: 0',
						'---',
						'# Overview',
						'[Frontend](guides/frontend.md)',
						'[Database](./guides/database.md)'
					].join('\n'),
					'/public-docs/zh/guides/frontend.md': '# Frontend',
					'/public-docs/zh/guides/database.md': '# Database',
					'/public-docs/en/intro.md': '# Intro'
				}
			},
			whenDetail: {},
			thenExpected: {
				locales: ['en', 'zh'],
				zhHomeSlug: 'index',
				zhDocSlugs: ['index', 'architecture', 'setup', 'intro', 'guides/database', 'guides/frontend'],
				zhGroups: ['Overview', 'Architecture', 'Start', 'Guides'],
				firstDocHeadings: [],
				firstDocHasLeadingH1: false,
				firstDocLinks: {
					frontend: true,
					database: true
				},
				switchPathForExistingSlug: '/zh/docs/intro',
				switchPathForMissingSlug: '/zh/docs/index',
				nextTitle: 'Architecture',
				previousTitle: null
			}
		}
	]

	runCases(cases, async (given: ManifestGivenDetail): Promise<ManifestExpected> => {
		const manifest: DocsManifest = await buildDocsManifest(given.modules)
		const zhManifest = manifest.byLocale['zh']
		const zhDocs = zhManifest?.docs ?? []
		const neighbors = getDocNeighbors(zhDocs, 'index')

		return {
			locales: manifest.locales,
			zhHomeSlug: zhManifest?.homeSlug ?? '',
			zhDocSlugs: zhDocs.map((doc) => doc.slug),
			zhGroups: zhManifest?.groups.map((group) => group.title) ?? [],
			firstDocHeadings: zhDocs[0]?.headings ?? [],
			firstDocHasLeadingH1: zhDocs[0]?.contentHtml.includes('<h1') ?? false,
			firstDocLinks: {
				frontend: zhDocs[0]?.contentHtml.includes('href="/zh/docs/guides/frontend"') ?? false,
				database: zhDocs[0]?.contentHtml.includes('href="/zh/docs/guides/database"') ?? false
			},
			switchPathForExistingSlug: getDocSwitchPath(manifest, 'zh', 'intro'),
			switchPathForMissingSlug: getDocSwitchPath(manifest, 'zh', 'missing'),
			nextTitle: neighbors.next?.title ?? null,
			previousTitle: neighbors.previous?.title ?? null
		}
	})
})
