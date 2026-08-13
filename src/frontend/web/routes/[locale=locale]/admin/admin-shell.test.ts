import { describe, expect, test, vi } from 'vitest'
import { load as loadAdminLayout } from './+layout.server'
import { load as loadAdminIndex } from './+page.server'
import { createAdminNavigation } from './admin-navigation'

const { getRuntimeSession } = vi.hoisted(() => {
	return { getRuntimeSession: vi.fn() }
})

vi.mock('$backend/api/auth', () => {
	return {
		authCore: (): { api: { getSession: typeof getRuntimeSession } } => {
			return { api: { getSession: getRuntimeSession } }
		}
	}
})

vi.mock('$backend/db', () => {
	return { getMetaDb: (db: unknown): unknown => db }
})

vi.mock('$backend/config', () => {
	return {
		getAuthRuntimeConfig: async (): Promise<Record<string, never>> => ({})
	}
})

type SessionPayload = {
	user: {
		id: string
		email: string
		name: string
		role: string
	}
}

describe('admin route protection', () => {
	test('redirects a signed-out visitor to login', async (): Promise<void> => {
		await expect(loadAdminLayout(createLayoutEvent(null))).rejects.toMatchObject({
			status: 302,
			location: '/en/login?redirect=%2Fen%2Fadmin%2Fusers%3Fpage%3D2'
		})
	})

	test('rejects a signed-in non-admin user', async (): Promise<void> => {
		await expect(loadAdminLayout(createLayoutEvent({
			user: { id: 'user-1', email: 'user@example.com', name: 'User', role: 'user' }
		}))).rejects.toMatchObject({
			status: 403
		})
	})

	test('allows the administrator role', async (): Promise<void> => {
		const result: Record<string, unknown> = await loadAdminLayout(createLayoutEvent({
			user: { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'admin' }
		}))

		expect(result).toMatchObject({
			locale: 'en',
			siteName: 'OPCStack',
			supportEmail: 'admin@example.com'
		})
	})

	test('reads the session from Worker bindings in production', async (): Promise<void> => {
		const session: SessionPayload = {
			user: { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'admin' }
		}
		getRuntimeSession.mockResolvedValueOnce(session)
		const fetchSession = vi.fn(async (): Promise<Response> => {
			throw new Error('SvelteKit cannot dispatch the Hono API internally')
		})
		const event: LayoutEventFixture = createLayoutEvent(null, fetchSession)
		event.platform = {
			env: {
				META_DB: {
					withSession: (): Record<string, never> => ({})
				}
			} as unknown as Env
		}

		const result: Record<string, unknown> = await loadAdminLayout(event)

		expect(result).toMatchObject({ supportEmail: 'admin@example.com' })
		expect(fetchSession).not.toHaveBeenCalled()
		expect(getRuntimeSession).toHaveBeenCalledWith({ headers: event.request.headers })
	})

	test('reads the session through the API in Vite when Worker bindings are absent', async (): Promise<void> => {
		const session: SessionPayload = {
			user: { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'admin' }
		}
		const fetchSession = vi.fn(async (): Promise<Response> => Response.json(session))
		const event: LayoutEventFixture = createLayoutEvent(null, fetchSession)
		event.platform = { env: {} as Env }

		const result: Record<string, unknown> = await loadAdminLayout(event)

		expect(result).toMatchObject({ supportEmail: 'admin@example.com' })
		expect(fetchSession).toHaveBeenCalledWith('/api/auth/get-session')
	})
})

describe('admin navigation', () => {
	test('redirects the admin root to overview', async (): Promise<void> => {
		await expect(loadAdminIndex({ params: { locale: 'zh' } } as never)).rejects.toMatchObject({
			status: 302,
			location: '/zh/admin/overview'
		})
	})

	test('defines eleven localized module paths', (): void => {
		const items = createAdminNavigation('zh')

		expect(items.map((item) => ({ id: item.id, href: item.href }))).toEqual([
			{ id: 'overview', href: '/zh/admin/overview' },
			{ id: 'users', href: '/zh/admin/users' },
			{ id: 'beta-codes', href: '/zh/admin/beta-codes' },
			{ id: 'credit-codes', href: '/zh/admin/credit-codes' },
			{ id: 'feedback', href: '/zh/admin/feedback' },
			{ id: 'notifications', href: '/zh/admin/notifications' },
			{ id: 'payments', href: '/zh/admin/payments' },
			{ id: 'payment-products', href: '/zh/admin/payment-products' },
			{ id: 'ai-tasks', href: '/zh/admin/ai-tasks' },
			{ id: 'ai-providers', href: '/zh/admin/ai-providers' },
			{ id: 'configuration', href: '/zh/admin/configuration' }
		])
	})
})

type LayoutEventFixture = {
	fetch: () => Promise<Response>
	params: { locale: string }
	parent: () => Promise<LayoutParentFixture>
	platform?: { env?: Env }
	request: Request
	url: URL
}

type LayoutParentFixture = {
	locale: string
	siteName: string
	supportEmail: string
	canonicalUrl: string
	[key: string]: unknown
}

function createLayoutEvent(
	session: SessionPayload | null,
	fetchSession?: () => Promise<Response>
): LayoutEventFixture {
	return {
		fetch: fetchSession ?? (async (): Promise<Response> => Response.json(session)),
		params: { locale: 'en' },
		parent: async (): Promise<LayoutParentFixture> => {
			return {
				locale: 'en',
				siteName: 'OPCStack',
				supportEmail: 'admin@example.com',
				canonicalUrl: 'https://example.com/en/admin/users'
			}
		},
		request: new Request('https://example.com/en/admin/users?page=2'),
		url: new URL('https://example.com/en/admin/users?page=2')
	}
}
