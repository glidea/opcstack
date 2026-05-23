import { describe, vi } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import { resolveUserShard } from './shard-router'

describe('resolveUserShard', () => {
	type GivenDetail = {
		hasExistingUserShard: boolean
		insertConflict: boolean
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
				hasExistingUserShard: true,
				insertConflict: false
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
				hasExistingUserShard: false,
				insertConflict: false
			},
			whenDetail: {},
			thenExpected: {
				shardId: 'shard_0000',
				bindingName: 'TENANT_DB_0000',
				insertedMapping: true,
				updatedCount: true
			}
		},
		{
			scenario: 'return concurrently inserted shard mapping',
			given: 'another request inserts the shard mapping first',
			when: 'resolving user shard',
			then: 'returns existing mapping without incrementing shard count',
			givenDetail: {
				hasExistingUserShard: false,
				insertConflict: true
			},
			whenDetail: {},
			thenExpected: {
				shardId: 'shard_0000',
				bindingName: 'TENANT_DB_0000',
				insertedMapping: true,
				updatedCount: false
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		const run = vi.fn().mockResolvedValue({
			meta: {
				changes: given.insertConflict ? 0 : 1
			}
		})
		const onConflictDoNothing = vi.fn(() => {
			return {
				run
			}
		})
		const values = vi.fn(() => {
			return {
				onConflictDoNothing
			}
		})
		const set = vi.fn(() => {
			return {
				where: vi.fn().mockResolvedValue(undefined)
			}
		})
		const userShardRows = given.hasExistingUserShard
			? [
					{
						shardId: 'shard_0001'
					}
				]
			: given.insertConflict
				? [
						undefined,
						{
							shardId: 'shard_0000'
						}
					]
				: [undefined]
		const db = {
			query: {
				userShard: {
					findFirst: vi.fn(() => Promise.resolve(userShardRows.shift()))
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
