import { describe } from 'vitest'
import { runCases, type TestCase } from '../../../testing/bdd'
import { splitLegalTemplate, type LegalLink, type LegalSegment } from './legal-disclosure'

describe('splitLegalTemplate', () => {
	type GivenDetail = {
		template: string
		links: Record<string, LegalLink>
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		segments: LegalSegment[]
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'register template with terms and privacy',
			given: 'two placeholders and matching links',
			when: 'splitting template',
			then: 'returns text and link segments in order',
			givenDetail: {
				template: 'By creating an account, you agree to our {terms} and {privacy}',
				links: {
					terms: { href: '/terms', label: 'Terms of Service' },
					privacy: { href: '/privacy', label: 'Privacy Policy' }
				}
			},
			whenDetail: {},
			thenExpected: {
				segments: [
					{ kind: 'text', value: 'By creating an account, you agree to our ' },
					{ kind: 'link', href: '/terms', label: 'Terms of Service' },
					{ kind: 'text', value: ' and ' },
					{ kind: 'link', href: '/privacy', label: 'Privacy Policy' }
				]
			}
		},
		{
			scenario: 'register template with refund link',
			given: 'three placeholders including refund',
			when: 'splitting template',
			then: 'returns three link segments in correct order',
			givenDetail: {
				template: 'By creating an account, you agree to our {terms}, {privacy} and {refund}',
				links: {
					terms: { href: '/terms', label: 'Terms of Service' },
					privacy: { href: '/privacy', label: 'Privacy Policy' },
					refund: { href: '/refund-policy', label: 'Refund Policy' }
				}
			},
			whenDetail: {},
			thenExpected: {
				segments: [
					{ kind: 'text', value: 'By creating an account, you agree to our ' },
					{ kind: 'link', href: '/terms', label: 'Terms of Service' },
					{ kind: 'text', value: ', ' },
					{ kind: 'link', href: '/privacy', label: 'Privacy Policy' },
					{ kind: 'text', value: ' and ' },
					{ kind: 'link', href: '/refund-policy', label: 'Refund Policy' }
				]
			}
		},
		{
			scenario: 'chinese template with refund link',
			given: 'chinese template with three placeholders',
			when: 'splitting template',
			then: 'returns segments preserving chinese punctuation',
			givenDetail: {
				template: '创建账号即表示您同意我们的{terms}、{privacy}和{refund}',
				links: {
					terms: { href: '/terms', label: '服务条款' },
					privacy: { href: '/privacy', label: '隐私政策' },
					refund: { href: '/refund-policy', label: '退款政策' }
				}
			},
			whenDetail: {},
			thenExpected: {
				segments: [
					{ kind: 'text', value: '创建账号即表示您同意我们的' },
					{ kind: 'link', href: '/terms', label: '服务条款' },
					{ kind: 'text', value: '、' },
					{ kind: 'link', href: '/privacy', label: '隐私政策' },
					{ kind: 'text', value: '和' },
					{ kind: 'link', href: '/refund-policy', label: '退款政策' }
				]
			}
		},
		{
			scenario: 'unknown placeholder kept as literal',
			given: 'template with unmapped placeholder',
			when: 'splitting template',
			then: 'leaves unmapped placeholder as text',
			givenDetail: {
				template: 'agree to {terms} and {unknown}',
				links: {
					terms: { href: '/terms', label: 'Terms of Service' }
				}
			},
			whenDetail: {},
			thenExpected: {
				segments: [
					{ kind: 'text', value: 'agree to ' },
					{ kind: 'link', href: '/terms', label: 'Terms of Service' },
					{ kind: 'text', value: ' and {unknown}' }
				]
			}
		},
		{
			scenario: 'empty template',
			given: 'an empty template string',
			when: 'splitting template',
			then: 'returns no segments',
			givenDetail: {
				template: '',
				links: {
					terms: { href: '/terms', label: 'Terms of Service' }
				}
			},
			whenDetail: {},
			thenExpected: {
				segments: []
			}
		},
		{
			scenario: 'no links provided',
			given: 'a template with placeholders but empty links map',
			when: 'splitting template',
			then: 'returns the entire template as a single text segment',
			givenDetail: {
				template: 'By continuing, you agree to our {terms} and {privacy}',
				links: {}
			},
			whenDetail: {},
			thenExpected: {
				segments: [
					{
						kind: 'text',
						value: 'By continuing, you agree to our {terms} and {privacy}'
					}
				]
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		return {
			segments: splitLegalTemplate(given.template, given.links)
		}
	})
})
