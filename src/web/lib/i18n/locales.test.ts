import { describe } from 'vitest'
import { runCases, type TestCase } from '../../../testing/bdd'
import { isSystemLocale, resolveSystemLocale, type SystemLocale } from './locales'

type GivenDetail = {
	value: string
}

type WhenDetail = Record<string, never>

type LocaleCheckExpected = {
	result: boolean
}

describe('isSystemLocale', () => {
	const cases: TestCase<GivenDetail, WhenDetail, LocaleCheckExpected>[] = [
		{
			scenario: 'accept supported locale',
			given: 'zh locale',
			when: 'checking system locale',
			then: 'returns true',
			givenDetail: { value: 'zh' },
			whenDetail: {},
			thenExpected: { result: true }
		},
		{
			scenario: 'reject unsupported locale',
			given: 'fr locale',
			when: 'checking system locale',
			then: 'returns false',
			givenDetail: { value: 'fr' },
			whenDetail: {},
			thenExpected: { result: false }
		}
	]

	runCases(cases, (given: GivenDetail): LocaleCheckExpected => {
		return { result: isSystemLocale(given.value) }
	})
})

type HeaderGivenDetail = {
	header: string
}

type LocaleExpected = {
	locale: SystemLocale
}

describe('resolveSystemLocale', () => {
	const cases: TestCase<HeaderGivenDetail, WhenDetail, LocaleExpected>[] = [
		{
			scenario: 'prefer highest q supported locale',
			given: 'accept language with zh higher than en',
			when: 'resolving system locale',
			then: 'returns zh',
			givenDetail: { header: 'en-US;q=0.7, zh-CN;q=0.9' },
			whenDetail: {},
			thenExpected: { locale: 'zh' }
		},
		{
			scenario: 'use base locale from regional locale',
			given: 'accept language with zh-CN',
			when: 'resolving system locale',
			then: 'returns zh',
			givenDetail: { header: 'zh-CN, en-US;q=0.5' },
			whenDetail: {},
			thenExpected: { locale: 'zh' }
		},
		{
			scenario: 'fallback to default locale',
			given: 'accept language without supported locale',
			when: 'resolving system locale',
			then: 'returns en',
			givenDetail: { header: 'fr-FR, de-DE;q=0.8' },
			whenDetail: {},
			thenExpected: { locale: 'en' }
		}
	]

	runCases(cases, (given: HeaderGivenDetail): LocaleExpected => {
		return { locale: resolveSystemLocale(given.header) }
	})
})
