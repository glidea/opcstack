import type { Context } from 'hono'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ApiEnv } from '..'
import { createTenantShardAccess } from '../../db/shard-router'
import { getAdminOverviewHandler } from './admin-overview'

vi.mock('../../db/shard-router', () => {
	return {
		createTenantShardAccess: vi.fn()
	}
})

type CountRow = { total: number }
type AiStatsRow = {
	total: number
	completed: number
	failed: number
}

describe('getAdminOverviewHandler', () => {
	afterEach((): void => {
		vi.restoreAllMocks()
		vi.clearAllMocks()
	})

	test('aggregates time windows currencies and tenant shards', async (): Promise<void> => {
		vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000)
		const metaDb: Record<string, unknown> = createMetaDb({
			userTotal: 120,
			newUsers: 12,
			paidAmounts: [
				{ currency: 'USD', amount: 1_299 },
				{ currency: 'CNY', amount: 8_800 }
			],
			disputedPayments: 2,
			claimedCodes: 3
		})
		mockShards([
			createTenantDb({
				feedbacks: 4,
				image: { total: 5, completed: 3, failed: 1 },
				tts: { total: 2, completed: 1, failed: 1 },
				video: { total: 1, completed: 0, failed: 0 }
			}),
			createTenantDb({
				feedbacks: 6,
				image: { total: 1, completed: 1, failed: 0 },
				tts: { total: 1, completed: 0, failed: 1 },
				video: { total: 2, completed: 1, failed: 1 }
			})
		])

		const response: Response = await getAdminOverviewHandler(createContext(metaDb))

		expect(await response.json()).toEqual({
			generated_at: 1_000_000_000,
			windows: {
				last_24_hours: { start_at: 913_600_000, end_at: 1_000_000_000 },
				last_7_days: { start_at: 395_200_000, end_at: 1_000_000_000 },
				last_30_days: { start_at: -1_592_000_000, end_at: 1_000_000_000 }
			},
			users: { total: 120, new_7d: 12 },
			payments: {
				paid_amounts_30d: [
					{ currency: 'CNY', amount: 8_800 },
					{ currency: 'USD', amount: 1_299 }
				],
				disputed_count: 2
			},
			feedbacks: { new_7d: 10 },
			ai_tasks: {
				total_24h: 12,
				terminal_count_24h: 10,
				completed_count_24h: 6,
				failed_count_24h: 4,
				terminal_completion_rate: 0.6,
				by_type_24h: { image: 6, tts: 3, video: 3 }
			},
			redemption_codes: { claimed_count: 3 }
		})
	})

	test('returns explicit zero values for empty data', async (): Promise<void> => {
		vi.spyOn(Date, 'now').mockReturnValue(2_000_000_000)
		const metaDb: Record<string, unknown> = createMetaDb({
			userTotal: 0,
			newUsers: 0,
			paidAmounts: [],
			disputedPayments: 0,
			claimedCodes: 0
		})
		mockShards([])

		const response: Response = await getAdminOverviewHandler(createContext(metaDb))
		const payload: {
			payments: { paid_amounts_30d: unknown[]; disputed_count: number }
			feedbacks: { new_7d: number }
			ai_tasks: {
				total_24h: number
				terminal_completion_rate: number
				by_type_24h: { image: number; tts: number; video: number }
			}
			redemption_codes: { claimed_count: number }
		} = await response.json()

		expect(payload).toMatchObject({
			payments: { paid_amounts_30d: [], disputed_count: 0 },
			feedbacks: { new_7d: 0 },
			ai_tasks: {
				total_24h: 0,
				terminal_completion_rate: 0,
				by_type_24h: { image: 0, tts: 0, video: 0 }
			},
			redemption_codes: { claimed_count: 0 }
		})
	})
})

function createMetaDb(input: {
	userTotal: number
	newUsers: number
	paidAmounts: Array<{ currency: string; amount: number }>
	disputedPayments: number
	claimedCodes: number
}): Record<string, unknown> {
	const results: unknown[][] = [
		[{ total: input.userTotal } satisfies CountRow],
		[{ total: input.newUsers } satisfies CountRow],
		input.paidAmounts,
		[{ total: input.disputedPayments } satisfies CountRow],
		[{ total: input.claimedCodes } satisfies CountRow]
	]
	let selectCall: number = 0
	return {
		select: vi.fn((): Record<string, unknown> => {
			const current: number = selectCall
			selectCall += 1
			if (current === 0) {
				return {
					from: async (): Promise<unknown[]> => results[current] ?? []
				}
			}
			if (current === 2) {
				return {
					from: (): Record<string, unknown> => ({
						where: (): Record<string, unknown> => ({
							groupBy: async (): Promise<unknown[]> => results[current] ?? []
						})
					})
				}
			}
			return {
				from: (): Record<string, unknown> => ({
					where: async (): Promise<unknown[]> => results[current] ?? []
				})
			}
		})
	}
}

function createTenantDb(input: {
	feedbacks: number
	image: AiStatsRow
	tts: AiStatsRow
	video: AiStatsRow
}): Record<string, unknown> {
	const results: unknown[][] = [
		[{ total: input.feedbacks } satisfies CountRow],
		[input.image],
		[input.tts],
		[input.video]
	]
	let selectCall: number = 0
	return {
		select: vi.fn((): Record<string, unknown> => {
			const current: number = selectCall
			selectCall += 1
			return {
				from: (): Record<string, unknown> => ({
					where: async (): Promise<unknown[]> => results[current] ?? []
				})
			}
		})
	}
}

function mockShards(dbs: Array<Record<string, unknown>>): void {
	vi.mocked(createTenantShardAccess).mockReturnValue({
		listShardDbs: async () => {
			return dbs.map((db: Record<string, unknown>, index: number) => {
				return {
					shardId: `shard-${index}`,
					bindingName: `TENANT_DB_${index}`,
					db
				}
			})
		}
	} as unknown as ReturnType<typeof createTenantShardAccess>)
}

function createContext(metaDb: Record<string, unknown>): Context<ApiEnv> {
	return {
		env: {},
		req: {
			json: async <T>(): Promise<T> => {
				return {} as T
			}
		},
		get: (): unknown => metaDb,
		json: (payload: unknown, status?: number): Response => {
			return new Response(JSON.stringify(payload), {
				status: status ?? 200,
				headers: { 'content-type': 'application/json' }
			})
		}
	} as unknown as Context<ApiEnv>
}
