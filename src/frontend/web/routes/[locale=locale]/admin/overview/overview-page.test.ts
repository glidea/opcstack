import { describe, expect, test } from 'vitest'
import type { GetAdminOverviewResponse } from '$apiContract/admin-overview'
import {
	createOverviewDrilldowns,
	createOverviewInitialState,
	createTaskDistribution,
	formatPaidAmount,
	getProcessingTaskCount,
	loadAdminOverview
} from './overview-page'

const overview: GetAdminOverviewResponse = {
	generated_at: 1_786_272_000_000,
	windows: {
		last_24_hours: { start_at: 1_786_185_600_000, end_at: 1_786_272_000_000 },
		last_7_days: { start_at: 1_785_667_200_000, end_at: 1_786_272_000_000 },
		last_30_days: { start_at: 1_783_680_000_000, end_at: 1_786_272_000_000 }
	},
	users: { total: 120, new_7d: 14 },
	payments: {
		paid_amounts_30d: [
			{ currency: 'USD', amount: 1599 },
			{ currency: 'JPY', amount: 3200 }
		],
		disputed_count: 2
	},
	feedbacks: { new_7d: 7 },
	ai_tasks: {
		total_24h: 20,
		terminal_count_24h: 15,
		completed_count_24h: 12,
		failed_count_24h: 3,
		terminal_completion_rate: 0.8,
		by_type_24h: { image: 10, tts: 6, video: 4 }
	},
	redemption_codes: { claimed_count: 4 }
}

describe('admin overview page state', () => {
	test('starts in loading state', (): void => {
		expect(createOverviewInitialState()).toEqual({ status: 'loading' })
	})

	test('returns overview data after a successful request', async (): Promise<void> => {
		const state = await loadAdminOverview(async (): Promise<GetAdminOverviewResponse> => overview)

		expect(state).toEqual({ status: 'loaded', data: overview })
	})

	test('returns an error state after a failed request', async (): Promise<void> => {
		const state = await loadAdminOverview(async (): Promise<GetAdminOverviewResponse> => {
			throw new Error('network failed')
		})

		expect(state).toEqual({ status: 'error' })
	})
})

describe('admin overview presentation', () => {
	test('builds actionable drilldown filters', (): void => {
		expect(createOverviewDrilldowns('en', overview)).toEqual({
		failedTasks:
			'/en/admin/ai-tasks?status=failed&created_at_start=1786185600000&created_at_end=1786272000000',
		claimedCodes: '/en/admin/credit-codes?status=claimed',
		disputedPayments: '/en/admin/payments?status=disputed'
	})
	})

	test('calculates processing tasks and task distribution', (): void => {
		expect({
			processing: getProcessingTaskCount(overview),
			distribution: createTaskDistribution(overview)
		}).toEqual({
			processing: 5,
			distribution: [
				{ type: 'image', count: 10, percentage: 50 },
				{ type: 'tts', count: 6, percentage: 30 },
				{ type: 'video', count: 4, percentage: 20 }
			]
		})
	})

	test('keeps zero task data explicit', (): void => {
		const zeroOverview: GetAdminOverviewResponse = {
			...overview,
			ai_tasks: {
				total_24h: 0,
				terminal_count_24h: 0,
				completed_count_24h: 0,
				failed_count_24h: 0,
				terminal_completion_rate: 0,
				by_type_24h: { image: 0, tts: 0, video: 0 }
			}
		}

		expect(createTaskDistribution(zeroOverview)).toEqual([
			{ type: 'image', count: 0, percentage: 0 },
			{ type: 'tts', count: 0, percentage: 0 },
			{ type: 'video', count: 0, percentage: 0 }
		])
	})

	test('formats provider minor currency units', (): void => {
		expect({
			usd: formatPaidAmount(1599, 'USD', 'en'),
			jpy: formatPaidAmount(3200, 'JPY', 'en')
		}).toEqual({
			usd: '$15.99',
			jpy: '¥3,200'
		})
	})
})
