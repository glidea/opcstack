import { describe, expect, it } from 'vitest'
import { load } from './+page.server'

describe('configuration root', () => {
	it('redirects to General', () => {
		expect(() => load({ params: { locale: 'zh' } } as never)).toThrowError(
			expect.objectContaining({
			status: 302,
			location: '/zh/admin/configuration/general'
			})
		)
	})
})
