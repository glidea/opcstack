import { describe } from 'vitest'
import { runCases, type TestCase } from './bdd'

// Example unit under test
function add(a: number, b: number): number {
	return a + b
}

type GivenDetail = Record<string, never>
type WhenDetail = { a: number; b: number }
type ThenExpected = { result: number }

describe('add', () => {
	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'Add two positive numbers',
			given: 'no preconditions',
			when: 'adding 1 and 2',
			then: 'should return 3',
			givenDetail: {},
			whenDetail: { a: 1, b: 2 },
			thenExpected: { result: 3 }
		},
		{
			scenario: 'Add negative numbers',
			given: 'no preconditions',
			when: 'adding -1 and -2',
			then: 'should return -3',
			givenDetail: {},
			whenDetail: { a: -1, b: -2 },
			thenExpected: { result: -3 }
		}
	]

	runCases(cases, (_given, when) => {
		return { result: add(when.a, when.b) }
	})
})
