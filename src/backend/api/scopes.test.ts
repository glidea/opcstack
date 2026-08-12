import { describe, expect, it } from 'vitest'
import { API_SCOPES, PROTECTED_JSON_ROUTES } from './scopes'

describe('API scope registry', () => {
	it('assigns one registered scope to every protected JSON route', () => {
		const routeKeys = PROTECTED_JSON_ROUTES.map((route) => `${route.method} ${route.path}`)
		const uniqueRouteKeys = new Set(routeKeys)
		const registeredScopes = new Set<string>(API_SCOPES)

		expect(uniqueRouteKeys.size).toBe(routeKeys.length)
		expect(PROTECTED_JSON_ROUTES.every((route) => registeredScopes.has(route.scope))).toBe(true)
	})

	it('protects administrator account changes with an administrator-only scope', () => {
		expect(PROTECTED_JSON_ROUTES).toContainEqual({
			method: 'POST',
			path: '/api/admin/update_administrator_email',
			scope: 'admin:users:write',
			access: 'admin'
		})
	})
})
