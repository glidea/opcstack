import { expect, test } from 'vitest'

// BDD style test case definition
export type TestCase<TGiven, TWhen, TThen> = {
	scenario: string
	given: string
	when: string
	then: string
	timeoutMs?: number
	givenDetail: TGiven
	whenDetail: TWhen
	thenExpected: TThen
}

// Run BDD cases through the same assertion flow
export function runCases<TGiven, TWhen, TThen>(
	cases: TestCase<TGiven, TWhen, TThen>[],
	fn: (given: TGiven, when: TWhen) => TThen | Promise<TThen>
): void {
	for (const c of cases) {
		test(
			`${c.scenario}: given ${c.given}, when ${c.when}, then ${c.then}`,
			async () => {
				const actual = await fn(c.givenDetail, c.whenDetail)
				expect(actual).toEqual(c.thenExpected)
			},
			c.timeoutMs
		)
	}
}
