<script lang="ts">
	import { _ } from '$web/i18n'

	type Intent = 'register' | 'continue'
	type LegalLink = {
		href: string
		label: string
	}
	type LegalSegment =
		| { kind: 'text'; value: string }
		| { kind: 'link'; href: string; label: string }

	let {
		intent = 'continue',
		termsHref = '/terms',
		privacyHref = '/privacy',
		refundHref,
		class: className = ''
	}: {
		intent?: Intent
		termsHref?: string
		privacyHref?: string
		refundHref?: string
		class?: string
	} = $props()

	const messageKey = $derived(
		refundHref ? `auth.legal.${intent}WithRefund` : `auth.legal.${intent}`
	)

	const links = $derived.by((): Record<string, LegalLink> => {
		const base: Record<string, LegalLink> = {
			terms: { href: termsHref, label: $_('auth.legal.terms') },
			privacy: { href: privacyHref, label: $_('auth.legal.privacy') }
		}
		if (refundHref) {
			base['refund'] = { href: refundHref, label: $_('auth.legal.refund') }
		}
		return base
	})

	const segments = $derived(splitLegalTemplate($_(messageKey), links))

	function splitLegalTemplate(
		template: string,
		linkMap: Record<string, LegalLink>
	): LegalSegment[] {
		const keys: string[] = Object.keys(linkMap)
		if (keys.length === 0) {
			return template === '' ? [] : [{ kind: 'text', value: template }]
		}

		const pattern: RegExp = new RegExp(`\\{(${keys.join('|')})\\}`, 'g')
		const segments: LegalSegment[] = []
		let lastIndex = 0
		let match: RegExpExecArray | null = pattern.exec(template)

		while (match !== null) {
			if (match.index > lastIndex) {
				segments.push({ kind: 'text', value: template.slice(lastIndex, match.index) })
			}

			const key: string = match[0].slice(1, -1)
			const link: LegalLink | undefined = linkMap[key]
			if (link === undefined) {
				throw new Error(`Missing legal link: ${key}`)
			}
			segments.push({ kind: 'link', href: link.href, label: link.label })
			lastIndex = match.index + match[0].length
			match = pattern.exec(template)
		}

		if (lastIndex < template.length) {
			segments.push({ kind: 'text', value: template.slice(lastIndex) })
		}

		return segments
	}
</script>

<p class={`text-fine-print text-muted-foreground text-center ${className}`}>
	{#each segments as segment, i (i)}
		{#if segment.kind === 'text'}{segment.value}{:else}<a
				href={segment.href}
				class="text-foreground underline-offset-2 hover:underline">{segment.label}</a>{/if}
	{/each}
</p>
