<script lang="ts">
	import { _ } from '$web/i18n'
	import { splitLegalTemplate, type LegalLink } from './legal-disclosure'

	type Intent = 'register' | 'continue'

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
</script>

<p class={`text-fine-print text-muted-foreground text-center ${className}`}>
	{#each segments as segment, i (i)}
		{#if segment.kind === 'text'}{segment.value}{:else}<a
				href={segment.href}
				class="text-foreground underline-offset-2 hover:underline">{segment.label}</a>{/if}
	{/each}
</p>
