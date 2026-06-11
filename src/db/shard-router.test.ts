import { describe, vi } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import { createTenantShardAccess, type D1ShardRegion } from './shard-router'

describe('TenantShardAccess.resolveUserShard', () => {
	type GivenDetail = {
		hasExistingUserShard: boolean
		insertConflict: boolean
		preferredRegion: D1ShardRegion
		preferredRegionHasShard: boolean
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
				insertConflict: false,
				preferredRegion: 'apac',
				preferredRegionHasShard: true
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
				insertConflict: false,
				preferredRegion: 'apac',
				preferredRegionHasShard: true
			},
			whenDetail: {},
			thenExpected: {
				shardId: 'shard_apac_0000',
				bindingName: 'TENANT_DB_APAC_0000',
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
				insertConflict: true,
				preferredRegion: 'apac',
				preferredRegionHasShard: true
			},
			whenDetail: {},
			thenExpected: {
				shardId: 'shard_0000',
				bindingName: 'TENANT_DB_0000',
				insertedMapping: true,
				updatedCount: false
			}
		},
		{
			scenario: 'fallback to global active shard',
			given: 'user preferred region has no active shard',
			when: 'resolving user shard',
			then: 'assigns least used global active shard',
			givenDetail: {
				hasExistingUserShard: false,
				insertConflict: false,
				preferredRegion: 'apac',
				preferredRegionHasShard: false
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
		const selectedShardRows = given.insertConflict
			? [
					{
						id: 'shard_apac_0000',
						bindingName: 'TENANT_DB_APAC_0000'
					},
					{
						id: 'shard_0000',
						bindingName: 'TENANT_DB_0000'
					}
				]
			: given.preferredRegionHasShard
			? [
					{
						id: 'shard_apac_0000',
						bindingName: 'TENANT_DB_APAC_0000'
					}
				]
			: [
					undefined,
					{
						id: 'shard_0000',
						bindingName: 'TENANT_DB_0000'
					}
				]
		const db = {
			query: {
				userShard: {
					findFirst: vi.fn(() => Promise.resolve(userShardRows.shift()))
				},
				d1Shard: {
					findFirst: vi.fn(() => {
						if (given.hasExistingUserShard) {
							return Promise.resolve({
								id: 'shard_0001',
								bindingName: 'TENANT_DB_0001'
							})
						}
						return Promise.resolve(selectedShardRows.shift())
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

		const result = await createTenantShardAccess(db as never, {} as never).resolveUserShard(
			'user-1',
			given.preferredRegion
		)

		return {
			shardId: result.shardId,
			bindingName: result.bindingName,
			insertedMapping: values.mock.calls.length > 0,
			updatedCount: set.mock.calls.length > 0
		}
	})
})

describe('TenantShardAccess', () => {
	type GivenDetail = {
		action: 'openUserDb' | 'openUserDbWithDefaultRegion' | 'openShardSession' | 'listShardDbs'
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		shardId: string
		dbCreated: boolean
		sessionBookmark: string
		listedShards: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'open user shard db',
			given: 'user has a shard mapping',
			when: 'opening the user tenant shard db',
			then: 'returns the routed tenant shard drizzle client',
			givenDetail: {
				action: 'openUserDb'
			},
			whenDetail: {},
			thenExpected: {
				shardId: 'shard_0000',
				dbCreated: true,
				sessionBookmark: '',
				listedShards: 0
			}
		},
		{
			scenario: 'open user shard db with default region',
			given: 'user has no shard mapping',
			when: 'opening the user tenant shard db without a preferred region',
			then: 'uses the router default preferred region',
			givenDetail: {
				action: 'openUserDbWithDefaultRegion'
			},
			whenDetail: {},
			thenExpected: {
				shardId: 'shard_0000',
				dbCreated: true,
				sessionBookmark: '',
				listedShards: 0
			}
		},
		{
			scenario: 'open user shard session',
			given: 'user has a shard mapping and bookmark',
			when: 'opening the resolved tenant shard session',
			then: 'returns a session backed tenant shard drizzle client',
			givenDetail: {
				action: 'openShardSession'
			},
			whenDetail: {},
			thenExpected: {
				shardId: 'shard_0000',
				dbCreated: true,
				sessionBookmark: 'bookmark-1',
				listedShards: 0
			}
		},
		{
			scenario: 'list shard dbs',
			given: 'active and draining shards exist',
			when: 'listing tenant shard dbs',
			then: 'returns every fan-out eligible tenant shard db',
			givenDetail: {
				action: 'listShardDbs'
			},
			whenDetail: {},
			thenExpected: {
				shardId: 'shard_0000',
				dbCreated: true,
				sessionBookmark: '',
				listedShards: 2
			}
		}
	]

	runCases(cases, async (given): Promise<ThenExpected> => {
		const state = createShardAccessState()
		const access = createTenantShardAccess(state.db as never, state.env as never)

		if (given.action === 'openUserDb') {
			const tenant = await access.openUserDb('user-1', 'wnam')
			return {
				shardId: tenant.shardId,
				dbCreated: tenant.db !== undefined,
				sessionBookmark: '',
				listedShards: 0
			}
		}

		if (given.action === 'openUserDbWithDefaultRegion') {
			state.db.query.userShard.findFirst = vi.fn().mockResolvedValue(undefined)
			const tenant = await access.openUserDb('user-1')
			return {
				shardId: tenant.shardId,
				dbCreated: tenant.db !== undefined,
				sessionBookmark: '',
				listedShards: 0
			}
		}

		if (given.action === 'openShardSession') {
			const tenant = access.openShardSession(
				{
					shardId: 'shard_0000',
					bindingName: 'TENANT_DB_0000'
				},
				'bookmark-1'
			)
			return {
				shardId: tenant.shardId,
				dbCreated: tenant.db !== undefined,
				sessionBookmark: state.withSession.mock.calls[0]?.[0] ?? '',
				listedShards: 0
			}
		}

		const shards = await access.listShardDbs()
		return {
			shardId: shards[0]?.shardId ?? '',
			dbCreated: shards.every((shard) => shard.db !== undefined),
			sessionBookmark: '',
			listedShards: shards.length
		}
	})
})

type ShardAccessState = {
	db: ShardAccessDb
	env: Record<string, unknown>
	withSession: ReturnType<typeof vi.fn>
}

type ShardAccessDb = {
	query: {
		userShard: {
			findFirst: ReturnType<typeof vi.fn>
		}
		d1Shard: {
			findFirst: ReturnType<typeof vi.fn>
			findMany: ReturnType<typeof vi.fn>
		}
	}
	insert: ReturnType<typeof vi.fn>
	update: ReturnType<typeof vi.fn>
}

function createShardAccessState(): ShardAccessState {
	const withSession = vi.fn(() => {
		return {
			prepare: vi.fn(),
			batch: vi.fn(),
			getBookmark: vi.fn()
		}
	})

	return {
		db: {
			query: {
				userShard: {
					findFirst: vi.fn().mockResolvedValue({
						shardId: 'shard_0000'
					})
				},
				d1Shard: {
					findFirst: vi.fn().mockResolvedValue({
						id: 'shard_0000',
						bindingName: 'TENANT_DB_0000'
					}),
					findMany: vi.fn().mockResolvedValue([
						{
							id: 'shard_0000',
							bindingName: 'TENANT_DB_0000'
						},
						{
							id: 'shard_0001',
							bindingName: 'TENANT_DB_0001'
						}
					])
				}
			},
			insert: vi.fn(() => {
				return {
					values: vi.fn(() => {
						return {
							onConflictDoNothing: vi.fn(() => {
								return {
									run: vi.fn().mockResolvedValue({
										meta: {
											changes: 1
										}
									})
								}
							})
						}
					})
				}
			}),
			update: vi.fn(() => {
				return {
					set: vi.fn(() => {
						return {
							where: vi.fn().mockResolvedValue(undefined)
						}
					})
				}
			})
		},
		env: {
			TENANT_DB_0000: {
				withSession,
				prepare: vi.fn(),
				batch: vi.fn()
			},
			TENANT_DB_0001: {
				withSession: vi.fn(),
				prepare: vi.fn(),
				batch: vi.fn()
			}
		},
		withSession
	}
}
