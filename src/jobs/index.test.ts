import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import { handleScheduled } from './index'
import { getMetaDb } from '../db'
import { createTenantShardAccess } from '../db/shard-router'

const creditsMock = vi.hoisted(() => {
	return {
		expire: vi.fn(),
		cleanupTransactions: vi.fn()
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
		getMetaDb: vi.fn()
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
					db: { name: 'tenant-shard-db' }
				}
			])
		} as unknown as ReturnType<typeof createTenantShardAccess>)
		vi.mocked(creditsMock.expire).mockResolvedValue({ processedEntries: 0, processedUsers: 0 })
		vi.mocked(creditsMock.cleanupTransactions).mockResolvedValue({ deletedRows: 0 })
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
				cleanupRetentionDays: 0
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
				cleanupRetentionDays: 30
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
				cleanupRetentionDays: 90
			}
		}
	]

	runCases(cases, async (given): Promise<ThenExpected> => {
		const env = {
			META_DB: {},
			CREDITS_HISTORY_RETENTION_DAYS: given.retentionDays
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
			cleanupRetentionDays: cleanupInput?.retentionDays ?? 0
		}
	})
})
