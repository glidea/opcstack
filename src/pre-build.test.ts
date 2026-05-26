import { describe } from 'vitest'
import { runCases, type TestCase } from './testing/bdd'
import { buildR2LifecyclePayload, parseR2TmpLifecycleRules } from './pre-build.mjs'

describe('parseR2TmpLifecycleRules', () => {
	type GivenDetail = Record<string, never>
	type WhenDetail = {
		raw: string
	}
	type ThenExpected = {
		ruleCount: number
		firstId: string
		firstPrefix: string
		firstExpireDays: number
		error: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'parses tmp public and private lifecycle rules',
			given: 'valid tmp lifecycle config',
			when: 'parsing r2 tmp lifecycle rules',
			then: 'returns typed lifecycle rule config',
			givenDetail: {},
			whenDetail: {
				raw: 'tmp/public/:7;tmp/private/:1'
			},
			thenExpected: {
				ruleCount: 2,
				firstId: 'expire-tmp-public',
				firstPrefix: 'tmp/public/',
				firstExpireDays: 7,
				error: ''
			}
		},
		{
			scenario: 'rejects persistent r2 prefix',
			given: 'lifecycle config points at public persistent path',
			when: 'parsing r2 tmp lifecycle rules',
			then: 'throws prefix error',
			givenDetail: {},
			whenDetail: {
				raw: 'public/:7'
			},
			thenExpected: {
				ruleCount: 0,
				firstId: '',
				firstPrefix: '',
				firstExpireDays: 0,
				error: 'R2_TMP_LIFECYCLE_PREFIX_INVALID'
			}
		},
		{
			scenario: 'rejects duplicated tmp prefix',
			given: 'same tmp prefix appears twice',
			when: 'parsing r2 tmp lifecycle rules',
			then: 'throws duplicate prefix error',
			givenDetail: {},
			whenDetail: {
				raw: 'tmp/public/:7;tmp/public/:30'
			},
			thenExpected: {
				ruleCount: 0,
				firstId: '',
				firstPrefix: '',
				firstExpireDays: 0,
				error: 'R2_TMP_LIFECYCLE_PREFIX_DUPLICATED'
			}
		}
	]

	runCases(cases, (_given, when) => {
		try {
			const rules = parseR2TmpLifecycleRules(when.raw)
			const first = rules[0]
			return {
				ruleCount: rules.length,
				firstId: first?.id ?? '',
				firstPrefix: first?.prefix ?? '',
				firstExpireDays: first?.expireDays ?? 0,
				error: ''
			}
		} catch (error) {
			return {
				ruleCount: 0,
				firstId: '',
				firstPrefix: '',
				firstExpireDays: 0,
				error: error instanceof Error ? error.message : ''
			}
		}
	})
})

describe('buildR2LifecyclePayload', () => {
	type GivenDetail = Record<string, never>
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		id: string
		prefix: string
		maxAge: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'builds cloudflare lifecycle payload',
			given: 'one parsed tmp lifecycle rule',
			when: 'building lifecycle api payload',
			then: 'uses prefix condition and age delete transition',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				id: 'expire-tmp-private',
				prefix: 'tmp/private/',
				maxAge: 86400
			}
		}
	]

	runCases(cases, () => {
		const rules = parseR2TmpLifecycleRules('tmp/private/:1')
		const payload = buildR2LifecyclePayload(rules)
		const first = payload.rules[0]
		if (!first) {
			throw new Error('TEST_LIFECYCLE_RULE_MISSING')
		}
		return {
			id: first.id,
			prefix: first.conditions.prefix,
			maxAge: first.deleteObjectsTransition.condition.maxAge
		}
	})
})
