import { afterEach, beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../../testing/bdd'
import { clearAuthToken, getAuthToken, setAuthToken } from './client'

class MemoryStorage implements Storage {
	private readonly values: Map<string, string> = new Map<string, string>()

	get length(): number {
		return this.values.size
	}

	clear(): void {
		this.values.clear()
	}

	getItem(key: string): string | null {
		return this.values.get(key) ?? null
	}

	key(index: number): string | null {
		return Array.from(this.values.keys())[index] ?? null
	}

	removeItem(key: string): void {
		this.values.delete(key)
	}

	setItem(key: string, value: string): void {
		this.values.set(key, value)
	}
}

describe('auth token storage', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', new MemoryStorage())
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	type GivenDetail = {
		token: string
		clear: boolean
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		token: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'read saved auth token',
			given: 'a saved token',
			when: 'reading auth token',
			then: 'returns token',
			givenDetail: {
				token: 'session-token',
				clear: false
			},
			whenDetail: {},
			thenExpected: {
				token: 'session-token'
			}
		},
		{
			scenario: 'clear saved auth token',
			given: 'a saved token',
			when: 'clearing auth token',
			then: 'returns empty token',
			givenDetail: {
				token: 'session-token',
				clear: true
			},
			whenDetail: {},
			thenExpected: {
				token: ''
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		setAuthToken(given.token)
		if (given.clear) {
			clearAuthToken()
		}

		return {
			token: getAuthToken() ?? ''
		}
	})
})
