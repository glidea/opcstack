import { z } from 'zod'
import type { ApiErrorResult } from './common'

export const GetDashboardRequestSchema = z.object({})
export type GetDashboardRequest = z.infer<typeof GetDashboardRequestSchema>

export const DashboardWindowSchema = z.object({
	start_at: z.number(),
	end_at: z.number()
})
export type DashboardWindow = z.infer<typeof DashboardWindowSchema>

export const DashboardPaidAmountSchema = z.object({
	currency: z.string(),
	amount: z.number()
})
export type DashboardPaidAmount = z.infer<typeof DashboardPaidAmountSchema>

export const GetDashboardResponseSchema = z.object({
	generated_at: z.number(),
	windows: z.object({
		last_24_hours: DashboardWindowSchema,
		last_7_days: DashboardWindowSchema,
		last_30_days: DashboardWindowSchema
	}),
	users: z.object({
		total: z.number(),
		new_7d: z.number()
	}),
	payments: z.object({
		paid_amounts_30d: z.array(DashboardPaidAmountSchema),
		disputed_count: z.number()
	}),
	feedbacks: z.object({
		new_7d: z.number()
	}),
	ai_tasks: z.object({
		total_24h: z.number(),
		terminal_count_24h: z.number(),
		completed_count_24h: z.number(),
		failed_count_24h: z.number(),
		terminal_completion_rate: z.number(),
		by_type_24h: z.object({
			image: z.number(),
			tts: z.number(),
			video: z.number()
		})
	}),
	redemption_codes: z.object({
		claimed_count: z.number()
	})
})
export type GetDashboardResponse = z.infer<typeof GetDashboardResponseSchema>

export const GetDashboardApi = {
	request: GetDashboardRequestSchema,
	response: GetDashboardResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
			return {
				status: 400,
				body: { code: 'INVALID_REQUEST', message }
			}
		}
	}
}
