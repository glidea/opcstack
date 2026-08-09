import { z } from 'zod'
import type { ApiErrorResult } from './common'

export const GetAdminOverviewRequestSchema = z.object({})
export type GetAdminOverviewRequest = z.infer<typeof GetAdminOverviewRequestSchema>

export const AdminOverviewWindowSchema = z.object({
	start_at: z.number(),
	end_at: z.number()
})
export type AdminOverviewWindow = z.infer<typeof AdminOverviewWindowSchema>

export const AdminOverviewPaidAmountSchema = z.object({
	currency: z.string(),
	amount: z.number()
})
export type AdminOverviewPaidAmount = z.infer<typeof AdminOverviewPaidAmountSchema>

export const GetAdminOverviewResponseSchema = z.object({
	generated_at: z.number(),
	windows: z.object({
		last_24_hours: AdminOverviewWindowSchema,
		last_7_days: AdminOverviewWindowSchema,
		last_30_days: AdminOverviewWindowSchema
	}),
	users: z.object({
		total: z.number(),
		new_7d: z.number()
	}),
	payments: z.object({
		paid_amounts_30d: z.array(AdminOverviewPaidAmountSchema),
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
export type GetAdminOverviewResponse = z.infer<typeof GetAdminOverviewResponseSchema>

export const GetAdminOverviewApi = {
	request: GetAdminOverviewRequestSchema,
	response: GetAdminOverviewResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
			return {
				status: 400,
				body: { code: 'INVALID_REQUEST', message }
			}
		}
	}
}
