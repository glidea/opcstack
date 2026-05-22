import { describe, expect, it, vi } from 'vitest'
import { resolveUserShard } from './shard-router'

describe('resolveUserShard', () => {
	it('returns existing user shard', async () => {
		const db = {
			query: {
				userShard: {
					findFirst: vi.fn().mockResolvedValue({
						shardId: 'shard_0001'
					})
				},
				d1Shard: {
					findFirst: vi.fn().mockResolvedValue({
						id: 'shard_0001',
						bindingName: 'TENANT_DB_0001'
					})
				}
			}
		}

		const result = await resolveUserShard(db as never, 'user-1')

		expect(result.shardId).toBe('shard_0001')
		expect(result.bindingName).toBe('TENANT_DB_0001')
	})

	it('assigns least used active shard', async () => {
		const values = vi.fn().mockResolvedValue(undefined)
		const set = vi.fn(() => {
			return {
				where: vi.fn().mockResolvedValue(undefined)
			}
		})
		const db = {
			query: {
				userShard: {
					findFirst: vi.fn().mockResolvedValue(undefined)
				},
				d1Shard: {
					findFirst: vi.fn().mockResolvedValue({
						id: 'shard_0000',
						bindingName: 'TENANT_DB_0000'
					})
				}
			},
			insert: vi.fn(() => {
				return { values }
			}),
			update: vi.fn(() => {
				return { set }
			})
		}

		const result = await resolveUserShard(db as never, 'user-1')

		expect(result.shardId).toBe('shard_0000')
		expect(result.bindingName).toBe('TENANT_DB_0000')
		expect(values).toHaveBeenCalled()
		expect(set).toHaveBeenCalled()
	})
})
