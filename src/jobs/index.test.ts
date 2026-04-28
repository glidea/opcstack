import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleScheduled } from './index'
import { cleanupCreditTransactions, expireCredits } from '../credits'
import { getDb } from '../db'

vi.mock('../credits', () => {
	return {
		cleanupCreditTransactions: vi.fn(),
		expireCredits: vi.fn()
	}
})

vi.mock('../db', () => {
	return {
		getDb: vi.fn()
	}
})

describe('handleScheduled', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(getDb).mockReturnValue({} as ReturnType<typeof getDb>)
		vi.mocked(expireCredits).mockResolvedValue({ processedEntries: 0, processedUsers: 0 })
		vi.mocked(cleanupCreditTransactions).mockResolvedValue({ deletedRows: 0 })
	})

	it('skip when cron is not registered', async () => {
		await handleScheduled(
			{ cron: '0 0 * * *', scheduledTime: 1890000000000 } as ScheduledController,
			{} as Env,
			{} as ExecutionContext
		)

		expect(getDb).not.toHaveBeenCalled()
		expect(expireCredits).not.toHaveBeenCalled()
		expect(cleanupCreditTransactions).not.toHaveBeenCalled()
	})

	it('run expire and cleanup on 10-minute cron', async () => {
		const env = {
			DB: {},
			CREDITS_HISTORY_RETENTION_DAYS: '30'
		} as unknown as Env

		await handleScheduled(
			{ cron: '*/10 * * * *', scheduledTime: 1890000000000 } as ScheduledController,
			env,
			{} as ExecutionContext
		)

		expect(getDb).toHaveBeenCalledWith(env.DB)
		expect(expireCredits).toHaveBeenCalledWith({
			db: vi.mocked(getDb).mock.results[0]?.value,
			nowMs: 1890000000000,
			limit: 20
		})
		expect(cleanupCreditTransactions).toHaveBeenCalledWith({
			db: vi.mocked(getDb).mock.results[0]?.value,
			nowMs: 1890000000000,
			retentionDays: 30
		})
	})

	it('use default retention days when env is invalid', async () => {
		const env = {
			DB: {},
			CREDITS_HISTORY_RETENTION_DAYS: '0'
		} as unknown as Env

		await handleScheduled(
			{ cron: '*/10 * * * *', scheduledTime: 1890000000000 } as ScheduledController,
			env,
			{} as ExecutionContext
		)

		expect(cleanupCreditTransactions).toHaveBeenCalledWith({
			db: vi.mocked(getDb).mock.results[0]?.value,
			nowMs: 1890000000000,
			retentionDays: 90
		})
	})
})
