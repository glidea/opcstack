export type LegalLink = {
	href: string
	label: string
}

export type LegalSegment =
	| { kind: 'text'; value: string }
	| { kind: 'link'; href: string; label: string }

// Split a localized template like "By continuing, you agree to {terms} and {privacy}"
// into a flat list of text/link segments using the provided link map. Unknown
// placeholders are kept as literal text so missing translations stay visible
// instead of silently disappearing.
export function splitLegalTemplate(
	template: string,
	links: Record<string, LegalLink>
): LegalSegment[] {
	const keys = Object.keys(links)
	if (keys.length === 0) {
		return template === '' ? [] : [{ kind: 'text', value: template }]
	}
	const pattern = new RegExp(`\\{(${keys.join('|')})\\}`, 'g')
	const segments: LegalSegment[] = []
	let lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = pattern.exec(template)) !== null) {
		if (match.index > lastIndex) {
			segments.push({ kind: 'text', value: template.slice(lastIndex, match.index) })
		}
		const link = links[match[1] as string] as LegalLink
		segments.push({ kind: 'link', href: link.href, label: link.label })
		lastIndex = match.index + match[0].length
	}
	if (lastIndex < template.length) {
		segments.push({ kind: 'text', value: template.slice(lastIndex) })
	}
	return segments
}
