import type { RequestEvent } from '@sveltejs/kit'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getPublicRuntimeConfig } from '$backend/config'
import { handle } from './hooks.server'

vi.mock('$backend/config', () => {
	return {
		getPublicRuntimeConfig: vi.fn()
	}
})

describe('web public runtime configuration', () => {
	beforeEach((): void => {
		vi.clearAllMocks()
		vi.mocked(getPublicRuntimeConfig).mockResolvedValue({
			support_email: 'admin@opcstack.local',
			design_system: 'brutalism',
			docs_enabled: false,
			payment_enabled: false,
			email_enabled: false,
			email_signup_enabled: false,
			email_require_verification: false,
			email_user_action_cooldown_seconds: 50,
			google_auth_enabled: false,
			github_auth_enabled: false,
			linuxdo_auth_enabled: false,
			turnstile_enabled: false,
			turnstile_site_key: null
		})
	})

	test('reads one nearest D1 snapshot before rendering a page', async (): Promise<void> => {
		const withSession = vi.fn((): D1DatabaseSession => {
			return {
				prepare: vi.fn(),
				batch: vi.fn(),
				getBookmark: vi.fn((): string => 'bookmark-1')
			} as unknown as D1DatabaseSession
		})
		const locals: Record<string, unknown> = {}
		const cookiesSet = vi.fn()
		const event = {
			url: new URL('http://localhost:5173/en'),
			request: new Request('http://localhost:5173/en'),
			platform: {
				env: {
					APP_BASE_URL: 'http://localhost:5173',
					META_DB: { withSession }
				}
			},
			cookies: {
				get: vi.fn((): undefined => undefined),
				set: cookiesSet
			},
			locals,
			route: { id: '/[locale=locale]' }
		} as unknown as RequestEvent
		const resolve = vi.fn(async (
			_event: RequestEvent,
			options?: { transformPageChunk?: (input: { html: string; done: boolean }) => string }
		): Promise<Response> => {
			const html: string = options?.transformPageChunk?.({
				html: '<html lang="en"><body>Home</body></html>',
				done: true
			}) ?? ''
			return new Response(html)
		})

		const response: Response = await handle({ event, resolve } as Parameters<typeof handle>[0])

		expect(await response.text()).toContain('<html lang="en" data-design="brutalism"')
		expect(withSession).toHaveBeenCalledOnce()
		expect(withSession).toHaveBeenCalledWith('first-unconstrained')
		expect(getPublicRuntimeConfig).toHaveBeenCalledOnce()
		expect(locals['publicRuntimeConfig']).toEqual({
			support_email: 'admin@opcstack.local',
			design_system: 'brutalism',
			docs_enabled: false,
			payment_enabled: false,
			email_enabled: false,
			email_signup_enabled: false,
			email_require_verification: false,
			email_user_action_cooldown_seconds: 50,
			google_auth_enabled: false,
			github_auth_enabled: false,
			linuxdo_auth_enabled: false,
			turnstile_enabled: false,
			turnstile_site_key: null
		})
		expect(cookiesSet).toHaveBeenCalledWith(
			'd1_meta_bookmark',
			'bookmark-1',
			expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' })
		)
	})

	test('preserves a localized 404 response', async (): Promise<void> => {
		const session: D1DatabaseSession = {
			prepare: vi.fn(),
			batch: vi.fn(),
			getBookmark: vi.fn((): null => null)
		} as unknown as D1DatabaseSession
		const event: RequestEvent = {
			url: new URL('http://localhost:5173/en/docs'),
			request: new Request('http://localhost:5173/en/docs'),
			platform: {
				env: {
					APP_BASE_URL: 'http://localhost:5173',
					META_DB: { withSession: vi.fn((): D1DatabaseSession => session) }
				} as unknown as Env
			},
			cookies: {
				get: vi.fn((): undefined => undefined),
				set: vi.fn()
			},
			locals: {},
			route: { id: '/[locale=locale]/docs' }
		} as unknown as RequestEvent
		const resolve = vi.fn(async (): Promise<Response> => new Response('Not found', { status: 404 }))

		const response: Response = await handle({ event, resolve } as Parameters<typeof handle>[0])

		expect({ status: response.status, body: await response.text() }).toEqual({
			status: 404,
			body: 'Not found'
		})
	})
})
