import { describe, vi } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import { resolveUserShard } from './shard-router'

describe('resolveUserShard', () => {
	type GivenDetail = {
		hasExistingUserShard: boolean
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		shardId: string
		bindingName: string
		insertedMapping: boolean
		updatedCount: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'return existing shard mapping',
			given: 'user already has a shard mapping',
			when: 'resolving user shard',
			then: 'returns mapped shard without creating a mapping',
			givenDetail: {
				hasExistingUserShard: true
			},
			whenDetail: {},
			thenExpected: {
				shardId: 'shard_0001',
				bindingName: 'TENANT_DB_0001',
				insertedMapping: false,
				updatedCount: false
			}
		},
		{
			scenario: 'assign active shard mapping',
			given: 'user has no shard mapping',
			when: 'resolving user shard',
			then: 'assigns least used active shard',
			givenDetail: {
				hasExistingUserShard: false
			},
			whenDetail: {},
			thenExpected: {
				shardId: 'shard_0000',
				bindingName: 'TENANT_DB_0000',
				insertedMapping: true,
				updatedCount: true
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		const values = vi.fn().mockResolvedValue(undefined)
		const set = vi.fn(() => {
			return {
				where: vi.fn().mockResolvedValue(undefined)
			}
		})
		const db = {
			query: {
				userShard: {
					findFirst: vi.fn().mockResolvedValue(
						given.hasExistingUserShard
							? {
									shardId: 'shard_0001'
								}
							: undefined
					)
				},
				d1Shard: {
					findFirst: vi.fn().mockResolvedValue(
						given.hasExistingUserShard
							? {
									id: 'shard_0001',
									bindingName: 'TENANT_DB_0001'
								}
							: {
									id: 'shard_0000',
									bindingName: 'TENANT_DB_0000'
								}
					)
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

		return {
			shardId: result.shardId,
			bindingName: result.bindingName,
			insertedMapping: values.mock.calls.length > 0,
			updatedCount: set.mock.calls.length > 0
		}
	})
})
