import { describe, expect, it } from 'vitest'
import { PageRequestSchema } from './common'

describe('PageRequestSchema', () => {
	it('fills default pagination', () => {
		const result = PageRequestSchema.parse({})

		expect(result).toEqual({
			page: 1,
			page_size: 20
		})
	})
})
