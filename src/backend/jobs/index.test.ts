import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { runCases, type TestCase } from '../testing/bdd'
import { handleScheduled } from './index'
import { getMetaDb } from '../db'
import { createTenantShardAccess } from '../db/shard-router'

const creditsMock = vi.hoisted(() => {
	return {
		expire: vi.fn(),
		cleanupTransactions: vi.fn(),
		runRawD1Batch: vi.fn(),
		rawQueries: vi.fn()
	}
})

vi.mock('../credits', () => {
	return {
		CreditsService: vi.fn().mockImplementation(function CreditsService() {
			return creditsMock
		})
	}
})

vi.mock('../db', () => {
	return {
		getMetaDb: vi.fn(),
		runRawD1Batch: creditsMock.runRawD1Batch
	}
})

vi.mock('../db/shard-router', () => {
	return {
		createTenantShardAccess: vi.fn()
	}
})

describe('handleScheduled', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(getMetaDb).mockReturnValue({ name: 'meta-db' } as unknown as ReturnType<typeof getMetaDb>)
		vi.mocked(createTenantShardAccess).mockReturnValue({
			listShardDbs: vi.fn().mockResolvedValue([
				{
					shardId: 'shard_0000',
					bindingName: 'TENANT_DB_0000',
					db: createShardDb('shard_0000')
				}
			])
		} as unknown as ReturnType<typeof createTenantShardAccess>)
		vi.mocked(creditsMock.expire).mockResolvedValue({ processedEntries: 0, processedUsers: 0 })
		vi.mocked(creditsMock.cleanupTransactions).mockResolvedValue({ deletedRows: 0 })
		vi.mocked(creditsMock.runRawD1Batch).mockResolvedValue([])
	})

	type GivenDetail = {
		cron: string
		retentionDays: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		metaDbCalls: number
		listShardDbsCalls: number
		expireCalls: number
		cleanupCalls: number
		cleanupRetentionDays: number
		aiCleanupCalls: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'skip unknown cron',
			given: 'cron is not registered',
			when: 'handling scheduled event',
			then: 'does not touch databases',
			givenDetail: {
				cron: '0 0 * * *',
				retentionDays: '30'
			},
			whenDetail: {},
			thenExpected: {
				metaDbCalls: 0,
				listShardDbsCalls: 0,
				expireCalls: 0,
				cleanupCalls: 0,
				cleanupRetentionDays: 0,
				aiCleanupCalls: 0
			}
		},
		{
			scenario: 'run shard credit jobs',
			given: 'registered cron and one active shard',
			when: 'handling scheduled event',
			then: 'runs expire and cleanup on shard db',
			givenDetail: {
				cron: '*/10 * * * *',
				retentionDays: '30'
			},
			whenDetail: {},
			thenExpected: {
				metaDbCalls: 1,
				listShardDbsCalls: 1,
				expireCalls: 1,
				cleanupCalls: 1,
				cleanupRetentionDays: 30,
				aiCleanupCalls: 1
			}
		},
		{
			scenario: 'default invalid retention days',
			given: 'registered cron and invalid retention setting',
			when: 'handling scheduled event',
			then: 'uses default retention days',
			givenDetail: {
				cron: '*/10 * * * *',
				retentionDays: '0'
			},
			whenDetail: {},
			thenExpected: {
				metaDbCalls: 1,
				listShardDbsCalls: 1,
				expireCalls: 1,
				cleanupCalls: 1,
				cleanupRetentionDays: 90,
				aiCleanupCalls: 1
			}
		}
	]

	runCases(cases, async (given): Promise<ThenExpected> => {
		const env = {
			META_DB: {},
			CREDITS_HISTORY_RETENTION_DAYS: given.retentionDays,
			AI_TASK_RETENTION_DAYS: '30'
		} as unknown as Env

		await handleScheduled(
			{ cron: given.cron, scheduledTime: 1890000000000 } as ScheduledController,
			env,
			{} as ExecutionContext
		)

		const cleanupInput = vi.mocked(creditsMock.cleanupTransactions).mock.calls[0]?.[0] as
			| { retentionDays?: number }
			| undefined
		return {
			metaDbCalls: vi.mocked(getMetaDb).mock.calls.length,
			listShardDbsCalls:
				vi.mocked(createTenantShardAccess).mock.results[0]?.value.listShardDbs.mock.calls.length ?? 0,
			expireCalls: vi.mocked(creditsMock.expire).mock.calls.length,
			cleanupCalls: vi.mocked(creditsMock.cleanupTransactions).mock.calls.length,
			cleanupRetentionDays: cleanupInput?.retentionDays ?? 0,
			aiCleanupCalls: creditsMock.runRawD1Batch.mock.calls.length
		}
	})

	it('cleans channel metrics and terminal AI tasks on every shard', async () => {
		vi.mocked(createTenantShardAccess).mockReturnValue({
			listShardDbs: vi.fn().mockResolvedValue([
				{
					shardId: 'shard_0000',
					bindingName: 'TENANT_DB_0000',
					db: createShardDb('shard_0000')
				},
				{
					shardId: 'shard_0001',
					bindingName: 'TENANT_DB_0001',
					db: createShardDb('shard_0001')
				}
			])
		} as unknown as ReturnType<typeof createTenantShardAccess>)
		const scheduledTime: number = 1_890_000_000_000
		const metricCutoff: number = scheduledTime - 24 * 60 * 60 * 1000
		const taskCutoff: number = scheduledTime - 30 * 24 * 60 * 60 * 1000

		await handleScheduled(
			{ cron: '*/10 * * * *', scheduledTime } as ScheduledController,
			{
				META_DB: {},
				CREDITS_HISTORY_RETENTION_DAYS: '90',
				AI_TASK_RETENTION_DAYS: '30'
			} as unknown as Env,
			{} as ExecutionContext
		)

		expect(creditsMock.runRawD1Batch).toHaveBeenCalledTimes(2)
		for (const call of creditsMock.runRawD1Batch.mock.calls) {
			expect(call[1]).toHaveLength(4)
		}
		const queries = creditsMock.rawQueries.mock.calls.map(
			(call): { shardId: string; sql: string; params: unknown[] } => {
				return {
					shardId: call[0] as string,
					sql: call[1].sql as string,
					params: call[1].params as unknown[]
				}
			}
		)
		expect(queries).toHaveLength(8)
		for (const shardId of ['shard_0000', 'shard_0001']) {
			const shardQueries = queries.filter((query): boolean => query.shardId === shardId)
			const metricQuery = shardQueries.find((query): boolean => {
				return query.sql.includes('DELETE FROM ai_channel_metric_buckets')
			})
			expect(metricQuery?.params).toEqual([metricCutoff])

			for (const table of ['ai_image_tasks', 'ai_tts_tasks', 'ai_video_tasks']) {
				const taskQuery = shardQueries.find((query): boolean => {
					return query.sql.includes(`DELETE FROM ${table}`)
				})
				expect(taskQuery?.sql).toContain("status IN ('completed', 'failed')")
				expect(taskQuery?.sql).not.toContain("'processing'")
				expect(taskQuery?.params).toEqual([taskCutoff])
			}
		}
	})
})

function createShardDb(shardId: string): {
	run(query: unknown): unknown
} {
	return {
		run: (query: unknown): unknown => {
			const built = new SQLiteSyncDialect().sqlToQuery(query as never)
			creditsMock.rawQueries(shardId, built)
			return query
		}
	}
}
