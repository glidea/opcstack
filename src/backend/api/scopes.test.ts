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

	it('does not expose removed account or storage configuration mutations', () => {
		expect(API_SCOPES).not.toContain('admin:users:write')
		expect(API_SCOPES).not.toContain('config:storage:read')
		expect(API_SCOPES).not.toContain('config:storage:write')
	})
})
