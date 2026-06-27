import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import {
	metaDbSessionMiddleware,
	buildBookmarkSetCookie,
	resolveSessionBookmark
} from './meta-db-session'
import type { Context } from 'hono'
import type { ApiEnv } from '..'

describe('resolveSessionBookmark', () => {
	type GivenDetail = {
		headerBookmark: string | undefined
		cookieBookmark: string | undefined
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		bookmark: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'use header bookmark first',
			given: 'header and cookie both exist',
			when: 'resolving bookmark',
			then: 'returns header bookmark',
			givenDetail: {
				headerBookmark: 'h-1',
				cookieBookmark: 'c-1'
			},
			whenDetail: {},
			thenExpected: {
				bookmark: 'h-1'
			}
		},
		{
			scenario: 'use cookie bookmark when header missing',
			given: 'cookie exists and header is missing',
			when: 'resolving bookmark',
			then: 'returns cookie bookmark',
			givenDetail: {
				headerBookmark: undefined,
				cookieBookmark: 'c-1'
			},
			whenDetail: {},
			thenExpected: {
				bookmark: 'c-1'
			}
		},
		{
			scenario: 'fallback to first-primary',
			given: 'header and cookie are both missing',
			when: 'resolving bookmark',
			then: 'returns first-primary',
			givenDetail: {
				headerBookmark: undefined,
				cookieBookmark: undefined
			},
			whenDetail: {},
			thenExpected: {
				bookmark: 'first-primary'
			}
		}
	]

	runCases(cases, async (given) => {
		const bookmark = resolveSessionBookmark(given.headerBookmark, given.cookieBookmark)
		return { bookmark }
	})
})

describe('buildBookmarkSetCookie', () => {
	type GivenDetail = {
		bookmark: string
		secure: boolean
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		cookie: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'build secure cookie for https',
			given: 'https deployment',
			when: 'building bookmark cookie',
			then: 'contains Secure attr',
			givenDetail: {
				bookmark: 'b-1',
				secure: true
			},
			whenDetail: {},
			thenExpected: {
				cookie: 'd1_meta_bookmark=b-1; Path=/; HttpOnly; SameSite=Lax; Secure'
			}
		},
		{
			scenario: 'build non-secure cookie for http',
			given: 'local http deployment',
			when: 'building bookmark cookie',
			then: 'does not include Secure attr',
			givenDetail: {
				bookmark: 'b-1',
				secure: false
			},
			whenDetail: {},
			thenExpected: {
				cookie: 'd1_meta_bookmark=b-1; Path=/; HttpOnly; SameSite=Lax'
			}
		}
	]

	runCases(cases, async (given) => {
		const cookie = buildBookmarkSetCookie(given.bookmark, given.secure)
		return { cookie }
	})
})

describe('metaDbSessionMiddleware', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	type GivenDetail = {
		headers: Record<string, string>
		responseBookmark: string
		appBaseUrl: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		withSessionBookmark: string
		responseHeaderBookmark: string
		responseSetCookie: string
		dbSet: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'use header bookmark and write back secure cookie',
			given: 'x-d1-meta-bookmark is present and app uses https',
			when: 'running d1 session middleware',
			then: 'uses header bookmark and sets header plus secure cookie',
			givenDetail: {
				headers: {
					'x-d1-meta-bookmark': 'h-1',
					cookie: 'd1_meta_bookmark=c-1'
				},
				responseBookmark: 'next-1',
				appBaseUrl: 'https://app.example.com'
			},
			whenDetail: {},
			thenExpected: {
				withSessionBookmark: 'h-1',
				responseHeaderBookmark: 'next-1',
				responseSetCookie: 'd1_meta_bookmark=next-1; Path=/; HttpOnly; SameSite=Lax; Secure',
				dbSet: true
			}
		},
		{
			scenario: 'use cookie bookmark and write back non-secure cookie',
			given: 'header missing and cookie present on http',
			when: 'running d1 session middleware',
			then: 'uses cookie bookmark and sets non-secure cookie',
			givenDetail: {
				headers: {
					cookie: 'd1_meta_bookmark=c-1'
				},
				responseBookmark: 'next-2',
				appBaseUrl: 'http://localhost:5173'
			},
			whenDetail: {},
			thenExpected: {
				withSessionBookmark: 'c-1',
				responseHeaderBookmark: 'next-2',
				responseSetCookie: 'd1_meta_bookmark=next-2; Path=/; HttpOnly; SameSite=Lax',
				dbSet: true
			}
		}
	]

	runCases(cases, async (given) => {
		const withSession = vi.fn((bookmark: string) => {
			return {
				prepare: vi.fn(),
				batch: vi.fn(),
				getBookmark: vi.fn(() => {
					return given.responseBookmark
				})
			}
		})

		const state = createContextState(given.headers, given.appBaseUrl, withSession)
		const ctx = createContext(state)

		await metaDbSessionMiddleware(ctx, state.next)

		return {
			withSessionBookmark: String(withSession.mock.calls[0]?.[0] ?? ''),
			responseHeaderBookmark: state.response.headers.get('x-d1-meta-bookmark') ?? '',
			responseSetCookie: state.response.headers.get('set-cookie') ?? '',
			dbSet: state.values['metaDb'] !== undefined
		}
	})
})

type ContextState = {
	headers: Headers
	env: {
		APP_BASE_URL: string
		META_DB: {
			withSession: (bookmark: string) => {
				prepare: ReturnType<typeof vi.fn>
				batch: ReturnType<typeof vi.fn>
				getBookmark: ReturnType<typeof vi.fn>
			}
		}
	}
	values: Record<string, unknown>
	response: Response
	next: () => Promise<void>
}

function createContextState(
	headers: Record<string, string>,
	appBaseUrl: string,
	withSession: ContextState['env']['META_DB']['withSession']
): ContextState {
	const reqHeaders = new Headers(headers)
	return {
		headers: reqHeaders,
		env: {
			APP_BASE_URL: appBaseUrl,
			META_DB: {
				withSession
			}
		},
		values: {},
		response: new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: {
				'content-type': 'application/json'
			}
		}),
		next: async (): Promise<void> => {
			return
		}
	}
}

function createContext(state: ContextState): Context<ApiEnv> {
	state.next = async (): Promise<void> => {
		return
	}

	const ctx = {
		env: state.env,
		req: {
			header: (name: string): string | undefined => {
				return state.headers.get(name) ?? undefined
			}
		},
		res: state.response,
		set: (key: string, value: unknown): void => {
			state.values[key] = value
		}
	}

	return ctx as unknown as Context<ApiEnv>
}
