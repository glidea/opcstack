import { describe } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import { toR2Key } from './r2'

describe('toR2Key', () => {
	type GivenDetail = Record<string, never>
	type WhenPath = { path: string }
	type ThenKey = { key: string }

	const cases: TestCase<GivenDetail, WhenPath, ThenKey>[] = [
		{
			scenario: 'maps public route path to bucket key',
			given: 'a request path with /api/r2 prefix',
			when: 'building r2 key from the path',
			then: 'returns key after the prefix',
			givenDetail: {},
			whenDetail: { path: '/api/r2/public/images/demo.png' },
			thenExpected: { key: 'public/images/demo.png' }
		},
		{
			scenario: 'maps private route path to bucket key',
			given: 'a request path with /api/r2 prefix',
			when: 'building r2 key from the path',
			then: 'returns key after the prefix',
			givenDetail: {},
			whenDetail: { path: '/api/r2/private/u1/a.txt' },
			thenExpected: { key: 'private/u1/a.txt' }
		}
	]

	runCases(cases, (_given, when) => {
		return { key: toR2Key(when.path) }
	})
})
