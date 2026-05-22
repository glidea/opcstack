import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleScheduled } from './index'
import { getDb } from '../db'

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
		getDb: vi.fn()
	}
})

describe('handleScheduled', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(getDb).mockReturnValue({} as ReturnType<typeof getDb>)
		vi.mocked(creditsMock.expire).mockResolvedValue({ processedEntries: 0, processedUsers: 0 })
		vi.mocked(creditsMock.cleanupTransactions).mockResolvedValue({ deletedRows: 0 })
	})

	it('skip when cron is not registered', async () => {
		await handleScheduled(
			{ cron: '0 0 * * *', scheduledTime: 1890000000000 } as ScheduledController,
			{} as Env,
			{} as ExecutionContext
		)

		expect(getDb).not.toHaveBeenCalled()
		expect(creditsMock.expire).not.toHaveBeenCalled()
		expect(creditsMock.cleanupTransactions).not.toHaveBeenCalled()
	})

	it('run expire and cleanup on 10-minute cron', async () => {
		const env = {
			META_DB: {},
			CREDITS_HISTORY_RETENTION_DAYS: '30'
		} as unknown as Env

		await handleScheduled(
			{ cron: '*/10 * * * *', scheduledTime: 1890000000000 } as ScheduledController,
			env,
			{} as ExecutionContext
		)

		expect(getDb).toHaveBeenCalledWith(env.META_DB)
		expect(creditsMock.expire).toHaveBeenCalledWith({
			nowMs: 1890000000000,
			limit: 20
		})
		expect(creditsMock.cleanupTransactions).toHaveBeenCalledWith({
			nowMs: 1890000000000,
			retentionDays: 30
		})
	})

	it('use default retention days when env is invalid', async () => {
		const env = {
			META_DB: {},
			CREDITS_HISTORY_RETENTION_DAYS: '0'
		} as unknown as Env

		await handleScheduled(
			{ cron: '*/10 * * * *', scheduledTime: 1890000000000 } as ScheduledController,
			env,
			{} as ExecutionContext
		)

		expect(creditsMock.cleanupTransactions).toHaveBeenCalledWith({
			nowMs: 1890000000000,
			retentionDays: 90
		})
	})
})
