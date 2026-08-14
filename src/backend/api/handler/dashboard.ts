import { and, eq, gte, lte, sql, type SQL } from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { Context } from 'hono'
import type { ApiEnv } from '..'
import {
	GetDashboardApi,
	type DashboardPaidAmount,
	type GetDashboardResponse
} from '../../../api-contract/dashboard'
import { createTenantShardAccess, type TenantShardClient } from '../../db/shard-router'
import { user } from '../../db/schema.auth'
import { creditRedemptionCode, paymentTransaction } from '../../db/schema.meta'
import { aiImageTask, aiTtsTask, aiVideoTask, feedback } from '../../db/schema.shard'
import { parseRequest } from '../../lib/request'

const DAY_MS = 24 * 60 * 60 * 1000

type CountRow = {
	total: number
}

type PaidAmountRow = {
	currency: string
	amount: number
}

type AIStats = {
	total: number
	completed: number
	failed: number
}

export async function getDashboardHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, GetDashboardApi.request)
	if (!request.success) {
		const error = GetDashboardApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}

	const now: number = Date.now()
	const start24h: number = now - DAY_MS
	const start7d: number = now - 7 * DAY_MS
	const start30d: number = now - 30 * DAY_MS
	const metaDb = ctx.get('metaDb')
	const userTotalRows: CountRow[] = await metaDb
		.select({ total: sql<number>`count(*)` })
		.from(user)
	const newUserRows: CountRow[] = await metaDb
		.select({ total: sql<number>`count(*)` })
		.from(user)
		.where(and(gte(user.createdAt, new Date(start7d)), lte(user.createdAt, new Date(now))))
	const paidAmountRows: PaidAmountRow[] = await metaDb
		.select({
			currency: paymentTransaction.currency,
			amount: sql<number>`coalesce(sum(${paymentTransaction.amount}), 0)`
		})
		.from(paymentTransaction)
		.where(and(
			eq(paymentTransaction.status, 'paid'),
			gte(paymentTransaction.paidAt, start30d),
			lte(paymentTransaction.paidAt, now)
		))
		.groupBy(paymentTransaction.currency)
	const disputedRows: CountRow[] = await metaDb
		.select({ total: sql<number>`count(*)` })
		.from(paymentTransaction)
		.where(eq(paymentTransaction.status, 'disputed'))
	const claimedCodeRows: CountRow[] = await metaDb
		.select({ total: sql<number>`count(*)` })
		.from(creditRedemptionCode)
		.where(eq(creditRedemptionCode.status, 'claimed'))

	let feedbackTotal: number = 0
	const imageStats: AIStats = { total: 0, completed: 0, failed: 0 }
	const ttsStats: AIStats = { total: 0, completed: 0, failed: 0 }
	const videoStats: AIStats = { total: 0, completed: 0, failed: 0 }
	const shards: TenantShardClient[] = await createTenantShardAccess(metaDb, ctx.env).listShardDbs()
	for (const shard of shards) {
		const shardFeedbackRows: CountRow[] = await shard.db
			.select({ total: sql<number>`count(*)` })
			.from(feedback)
			.where(and(gte(feedback.createdAt, start7d), lte(feedback.createdAt, now)))
		feedbackTotal += Number(shardFeedbackRows[0]?.total ?? 0)

		const shardImageRows: AIStats[] = await shard.db
			.select(aiStatsSelection(aiImageTask.status))
			.from(aiImageTask)
			.where(and(gte(aiImageTask.createdAt, start24h), lte(aiImageTask.createdAt, now)))
		addAiStats(imageStats, shardImageRows[0])

		const shardTtsRows: AIStats[] = await shard.db
			.select(aiStatsSelection(aiTtsTask.status))
			.from(aiTtsTask)
			.where(and(gte(aiTtsTask.createdAt, start24h), lte(aiTtsTask.createdAt, now)))
		addAiStats(ttsStats, shardTtsRows[0])

		const shardVideoRows: AIStats[] = await shard.db
			.select(aiStatsSelection(aiVideoTask.status))
			.from(aiVideoTask)
			.where(and(gte(aiVideoTask.createdAt, start24h), lte(aiVideoTask.createdAt, now)))
		addAiStats(videoStats, shardVideoRows[0])
	}

	const totalTasks: number = imageStats.total + ttsStats.total + videoStats.total
	const completedTasks: number = imageStats.completed + ttsStats.completed + videoStats.completed
	const failedTasks: number = imageStats.failed + ttsStats.failed + videoStats.failed
	const terminalTasks: number = completedTasks + failedTasks
	const paidAmounts: DashboardPaidAmount[] = paidAmountRows
		.map((row: PaidAmountRow): DashboardPaidAmount => {
			return {
				currency: row.currency,
				amount: Number(row.amount)
			}
		})
		.sort((left: DashboardPaidAmount, right: DashboardPaidAmount): number => {
			return left.currency.localeCompare(right.currency)
		})

	return ctx.json({
		generated_at: now,
		windows: {
			last_24_hours: { start_at: start24h, end_at: now },
			last_7_days: { start_at: start7d, end_at: now },
			last_30_days: { start_at: start30d, end_at: now }
		},
		users: {
			total: Number(userTotalRows[0]?.total ?? 0),
			new_7d: Number(newUserRows[0]?.total ?? 0)
		},
		payments: {
			paid_amounts_30d: paidAmounts,
			disputed_count: Number(disputedRows[0]?.total ?? 0)
		},
		feedbacks: { new_7d: feedbackTotal },
		ai_tasks: {
			total_24h: totalTasks,
			terminal_count_24h: terminalTasks,
			completed_count_24h: completedTasks,
			failed_count_24h: failedTasks,
			terminal_completion_rate: terminalTasks === 0 ? 0 : completedTasks / terminalTasks,
			by_type_24h: {
				image: imageStats.total,
				tts: ttsStats.total,
				video: videoStats.total
			}
		},
		redemption_codes: {
			claimed_count: Number(claimedCodeRows[0]?.total ?? 0)
		}
	} as GetDashboardResponse)
}

function aiStatsSelection(statusColumn: AnySQLiteColumn): {
	total: SQL<number>
	completed: SQL<number>
	failed: SQL<number>
} {
	return {
		total: sql<number>`count(*)`,
		completed: sql<number>`coalesce(sum(case when ${statusColumn} = 'completed' then 1 else 0 end), 0)`,
		failed: sql<number>`coalesce(sum(case when ${statusColumn} = 'failed' then 1 else 0 end), 0)`
	}
}

function addAiStats(target: AIStats, source: AIStats | undefined): void {
	target.total += Number(source?.total ?? 0)
	target.completed += Number(source?.completed ?? 0)
	target.failed += Number(source?.failed ?? 0)
}
