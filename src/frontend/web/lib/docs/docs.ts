import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSlug from 'rehype-slug'
import rehypeShiki from '@shikijs/rehype'
import rehypeStringify from 'rehype-stringify'
import type { Root, Element } from 'hast'

function walkElements(node: Root | Element, fn: (el: Element) => void): void {
	if ('children' in node) {
		for (const child of node.children) {
			if (child.type === 'element') {
				fn(child)
				walkElements(child, fn)
			}
		}
	}
}

function rehypeLazyImages(): (tree: Root) => void {
	return (tree: Root) => {
		walkElements(tree, (node) => {
			if (node.tagName === 'img') {
				node.properties['loading'] = 'lazy'
				node.properties['decoding'] = 'async'
			}
		})
	}
}

function getClassNames(node: Element): string[] {
	const className = node.properties['className']
	if (Array.isArray(className)) {
		return className.filter((item): item is string => typeof item === 'string')
	}
	if (typeof className === 'string') {
		return className.split(/\s+/).filter((item) => item !== '')
	}
	return []
}

function getMermaidCodeFromPre(node: Element): string | null {
	const codeNode = node.children[0]
	if (!codeNode || codeNode.type !== 'element' || codeNode.tagName !== 'code') {
		return null
	}
	const codeElement = codeNode as Element
	const classNames = getClassNames(codeElement)
	const isMermaid = classNames.includes('language-mermaid') || classNames.includes('lang-mermaid')
	if (!isMermaid) {
		return null
	}

	let code = ''
	for (const child of codeElement.children) {
		if (child.type === 'text') {
			code += child.value
		}
	}
	return code
}

function replaceMermaidCodeBlocks(node: Root | Element): void {
	if (!('children' in node)) {
		return
	}

	for (let index = 0; index < node.children.length; index += 1) {
		const child = node.children[index]
		if (child?.type !== 'element') {
			continue
		}

		const mermaidCode = child.tagName === 'pre' ? getMermaidCodeFromPre(child) : null
		if (mermaidCode !== null) {
			node.children[index] = {
				type: 'element',
				tagName: 'div',
				properties: { className: ['mermaid'] },
				children: [{ type: 'text', value: mermaidCode }]
			}
			continue
		}

		replaceMermaidCodeBlocks(child)
	}
}

function rehypeMermaid(): (tree: Root) => void {
	return (tree: Root) => {
		replaceMermaidCodeBlocks(tree)
	}
}

const markdownProcessor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkRehype)
	.use(rehypeSlug)
	.use(rehypeMermaid)
	.use(rehypeShiki, {
		themes: {
			light: 'github-light',
			dark: 'github-dark'
		},
		langs: ['typescript', 'javascript', 'bash', 'json', 'jsonc', 'yaml', 'svelte', 'go', 'sql'],
		langAlias: {
			ts: 'typescript',
			js: 'javascript',
			shell: 'bash',
			sh: 'bash',
			yml: 'yaml'
		}
	})
	.use(rehypeLazyImages)
	.use(rehypeStringify)

export interface DocMetadata {
	title?: string
	description?: string
	group?: string
	order?: number
}

export interface DocHeading {
	id: string
	text: string
	level: 2 | 3
}

export interface DocItem {
	locale: string
	slug: string
	sourcePath: string
	title: string
	description: string
	group: string
	order: number
	headings: DocHeading[]
	contentHtml: string
}

export interface DocGroup {
	id: string
	title: string
	docs: DocItem[]
}

export interface DocLink {
	slug: string
	title: string
}

export interface LocaleManifest {
	locale: string
	docs: DocItem[]
	groups: DocGroup[]
	homeSlug: string
}

export interface DocsManifest {
	locales: string[]
	byLocale: Record<string, LocaleManifest>
}

const DOC_PATH_PREFIX = '/public-docs/'
const DOC_PATH_SUFFIX = '.md'
const DEFAULT_ORDER = 9999

export function docPathToLocaleAndSlug(sourcePath: string): { locale: string; slug: string } {
	const relativePath = sourcePath.slice(DOC_PATH_PREFIX.length, -DOC_PATH_SUFFIX.length)
	const segments = relativePath.split('/').filter((segment) => segment !== '')
	const locale = segments[0] ?? ''
	const slug = segments.slice(1).join('/')
	return { locale, slug }
}

export function slugToDocPath(locale: string, slug: string): string {
	return `${DOC_PATH_PREFIX}${locale}/${slug}${DOC_PATH_SUFFIX}`
}

export function fallbackDocTitle(slug: string): string {
	return slug
		.split('/')
		.map((segment) => {
			return segment
				.split('-')
				.map((part) => {
					return part.charAt(0).toUpperCase() + part.slice(1)
				})
				.join(' ')
		})
		.join(' / ')
}

export async function buildDocsManifest(rawModules: Record<string, string>): Promise<DocsManifest> {
	const docsByLocale = new Map<string, DocItem[]>()

	for (const sourcePath in rawModules) {
		const raw = rawModules[sourcePath] ?? ''
		const rendered = await renderDoc(raw)
		const contentHtml = stripLeadingH1(rendered.contentHtml)
		const { locale, slug } = docPathToLocaleAndSlug(sourcePath)
		const metadata = rendered.metadata
		const group = metadata.group ?? fallbackDocGroup(slug)
		const docs = docsByLocale.get(locale) ?? []

		docs.push({
			locale,
			slug,
			sourcePath,
			title: metadata.title ?? fallbackDocTitle(slug),
			description: metadata.description ?? '',
			group,
			order: metadata.order ?? DEFAULT_ORDER,
			headings: parseDocHeadingsFromHtml(contentHtml),
			contentHtml
		})

		docsByLocale.set(locale, docs)
	}

	const locales = [...docsByLocale.keys()].sort((a, b) => a.localeCompare(b))
	const byLocale: Record<string, LocaleManifest> = {}

	for (const locale of locales) {
		const docs = docsByLocale.get(locale) ?? []
		const sortedDocs = docs.sort(compareDocs)
		const groups = buildDocGroups(sortedDocs)

		byLocale[locale] = {
			locale,
			docs: sortedDocs,
			groups,
			homeSlug: sortedDocs[0]?.slug ?? ''
		}
	}

	return {
		locales,
		byLocale
	}
}

export function getLocaleManifest(manifest: DocsManifest, locale: string): LocaleManifest | null {
	return manifest.byLocale[locale] ?? null
}

export function getDocBySlug(docs: DocItem[], slug: string): DocItem | null {
	for (const doc of docs) {
		if (doc.slug === slug) {
			return doc
		}
	}
	return null
}

export function getDocNeighbors(
	docs: DocItem[],
	slug: string
): { previous: DocLink | null; next: DocLink | null } {
	const index = docs.findIndex((doc) => doc.slug === slug)
	if (index === -1) {
		return {
			previous: null,
			next: null
		}
	}

	const previousDoc = docs[index - 1]
	const nextDoc = docs[index + 1]

	return {
		previous: previousDoc
			? {
				slug: previousDoc.slug,
				title: previousDoc.title
			}
			: null,
		next: nextDoc
			? {
				slug: nextDoc.slug,
				title: nextDoc.title
			}
			: null
	}
}

export function getDocSwitchPath(manifest: DocsManifest, locale: string, slug: string): string {
	const localeManifest = getLocaleManifest(manifest, locale)
	if (!localeManifest) {
		return `/${locale}/docs`
	}

	const targetDoc = getDocBySlug(localeManifest.docs, slug)
	const targetSlug = targetDoc?.slug ?? localeManifest.homeSlug
	if (targetSlug === '') {
		return `/${locale}/docs`
	}
	return `/${locale}/docs/${targetSlug}`
}

function parseDocHeadingsFromHtml(html: string): DocHeading[] {
	const headings: DocHeading[] = []
	const headingRegex = /<h([23])\b[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gu

	for (const match of html.matchAll(headingRegex)) {
		const levelText = match[1] ?? ''
		const id = match[2] ?? ''
		const innerHtml = match[3] ?? ''
		if (id === '') {
			continue
		}

		const level: 2 | 3 = levelText === '2' ? 2 : 3
		const text = decodeHtmlEntities(innerHtml.replace(/<[^>]+>/g, '')).trim()
		if (text === '') {
			continue
		}

		headings.push({
			id,
			text,
			level
		})
	}

	return headings
}

export function fallbackDocGroup(slug: string): string {
	const firstSegment = slug.split('/')[0] ?? ''
	if (firstSegment === '') {
		return 'General'
	}

	if (!slug.includes('/')) {
		return 'Getting Started'
	}

	return firstSegment
		.split('-')
		.map((part) => {
			return part.charAt(0).toUpperCase() + part.slice(1)
		})
		.join(' ')
}

async function renderDoc(raw: string): Promise<{ metadata: DocMetadata; contentHtml: string }> {
	const parsed = parseFrontmatter(raw)
	const metadata = parsed.metadata
	const contentHtml = await renderMarkdown(parsed.body)

	return {
		metadata,
		contentHtml
	}
}

function stripLeadingH1(html: string): string {
	return html.replace(/^<h1[^>]*>[\s\S]*?<\/h1>\s*/u, '')
}


function buildDocGroups(docs: DocItem[]): DocGroup[] {
	const grouped = new Map<string, DocItem[]>()

	for (const doc of docs) {
		const list = grouped.get(doc.group) ?? []
		list.push(doc)
		grouped.set(doc.group, list)
	}

	const groups: DocGroup[] = []
	for (const [title, items] of grouped) {
		groups.push({
			id: slugify(title),
			title,
			docs: items
		})
	}

	return groups.sort(compareDocGroups)
}

function compareDocs(a: DocItem, b: DocItem): number {
	if (a.order !== b.order) {
		return a.order - b.order
	}
	if (a.group !== b.group) {
		return a.group.localeCompare(b.group)
	}
	return a.slug.localeCompare(b.slug)
}

function compareDocGroups(a: DocGroup, b: DocGroup): number {
	const firstA = a.docs[0]
	const firstB = b.docs[0]
	if (firstA && firstB) {
		return compareDocs(firstA, firstB)
	}
	return a.title.localeCompare(b.title)
}

function stripFrontmatter(raw: string): string {
	if (!raw.startsWith('---\n')) {
		return raw
	}

	const endIndex = findFrontmatterEnd(raw)
	if (endIndex === -1) {
		return raw
	}

	if (raw.startsWith('\n---\n', endIndex)) {
		return raw.slice(endIndex + 5)
	}

	return raw.slice(endIndex + 4)
}

function parseFrontmatter(raw: string): { metadata: DocMetadata; body: string } {
	const metadata: DocMetadata = {}
	if (!raw.startsWith('---\n')) {
		return {
			metadata,
			body: raw
		}
	}

	const endIndex = findFrontmatterEnd(raw)
	if (endIndex === -1) {
		return {
			metadata,
			body: raw
		}
	}

	const frontmatter = raw.slice(4, endIndex)
	const body = raw.startsWith('\n---\n', endIndex) ? raw.slice(endIndex + 5) : raw.slice(endIndex + 4)

	for (const line of frontmatter.split('\n')) {
		const match = /^([a-z_]+):\s*(.*)$/.exec(line.trim())
		if (!match) {
			continue
		}

		const key = match[1]
		const rawValue = match[2] ?? ''
		const value = stripQuotes(rawValue)

		if (key === 'title' && value !== '') {
			metadata.title = value
		}
		if (key === 'description' && value !== '') {
			metadata.description = value
		}
		if (key === 'group' && value !== '') {
			metadata.group = value
		}
		if (key === 'order') {
			const parsed = Number(value)
			if (!Number.isNaN(parsed)) {
				metadata.order = parsed
			}
		}
	}

	return {
		metadata,
		body
	}
}

function findFrontmatterEnd(raw: string): number {
	const normalEnd = raw.indexOf('\n---\n', 4)
	if (normalEnd !== -1) {
		return normalEnd
	}

	if (raw.endsWith('\n---')) {
		return raw.length - 4
	}

	return -1
}

function stripQuotes(value: string): string {
	if (value.startsWith('"') && value.endsWith('"')) {
		return value.slice(1, -1)
	}
	if (value.startsWith("'") && value.endsWith("'")) {
		return value.slice(1, -1)
	}
	return value
}

function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ')
}

async function renderMarkdown(raw: string): Promise<string> {
	const result = await markdownProcessor.process(raw)
	return String(result)
}

function slugify(text: string): string {
	const normalized = text
		.toLowerCase()
		.replace(/[`'"~!@#$%^&*()+=[\]{}|\\:;<>,.?/]/g, '')
		.trim()
		.replace(/\s+/g, '-')

	return normalized || 'section'
}
