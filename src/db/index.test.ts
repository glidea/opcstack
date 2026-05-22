import { describe, expect, it } from 'vitest'
import { dbSchema } from './index'
import { betaCode } from './schema.meta'
import { user } from './schema.auth'

describe('dbSchema', () => {
	it('uses meta and auth schema', () => {
		expect(dbSchema.betaCode).toBe(betaCode)
		expect(dbSchema.user).toBe(user)
		expect(Object.keys(dbSchema)).toContain('d1Shard')
		expect(Object.keys(dbSchema)).toContain('userShard')
	})
})
