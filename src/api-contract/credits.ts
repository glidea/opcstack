import { z } from 'zod'
import { PageRequestSchema, type PageResponse } from './common'

export const ListCreditTransactionsRequestSchema = PageRequestSchema.extend({
	type: z.string().min(1).optional(),
	source_type: z.string().min(1).optional(),
	source_id: z.string().min(1).optional(),
	created_at_start: z.number().int().optional(),
	created_at_end: z.number().int().optional()
})
export type ListCreditTransactionsRequest = z.infer<typeof ListCreditTransactionsRequestSchema>

export type CreditTransactionResponseItem = {
	id: string
	type: string
	amount: string
	balance_after: string
	source_type: string
	source_id: string
	description: string | null
	expires_at: number | null
	created_at: number
}
export type ListCreditTransactionsResponse = PageResponse<CreditTransactionResponseItem>

export type GetCreditSummaryResponse = {
	balance: string
	daily_checked_in: boolean
	daily_checkin_amount: string
}

export type DailyCheckinResponse = {
	balance: string
	checked_in: boolean
	amount: string
}

export const GenerateCreditCodesRequestSchema = z.object({
	count: z.number().int().min(1).max(200).optional().default(1),
	amount: z.string().min(1),
	expires_at: z.number().int().nullable().optional()
})
export type GenerateCreditCodesRequest = z.infer<typeof GenerateCreditCodesRequestSchema>

export type CreditCodeResponseItem = {
	id: string
	code: string
	amount: string
	expires_at: number | null
	created_at: number
}
export type GenerateCreditCodesResponse = {
	codes: CreditCodeResponseItem[]
}

export const ListCreditCodesRequestSchema = PageRequestSchema.extend({
	code: z.string().min(1).optional(),
	claimed_by: z.string().min(1).optional(),
	status: z.enum(['unused', 'claimed', 'granted']).optional(),
	amount: z.string().min(1).optional(),
	created_at_start: z.number().int().optional(),
	created_at_end: z.number().int().optional(),
	expires_at_start: z.number().int().optional(),
	expires_at_end: z.number().int().optional()
})
export type ListCreditCodesRequest = z.infer<typeof ListCreditCodesRequestSchema>

export type CreditCodeListResponseItem = CreditCodeResponseItem & {
	status: string
	claimed_by: string | null
	claimed_at: number | null
	granted_at: number | null
}
export type ListCreditCodesResponse = PageResponse<CreditCodeListResponseItem>

export const RedeemCreditCodeRequestSchema = z.object({
	code: z.string().min(1)
})
export type RedeemCreditCodeRequest = z.infer<typeof RedeemCreditCodeRequestSchema>

export type RedeemCreditCodeResponse = {
	balance: string
	amount: string
}

export const AdminGrantCreditsRequestSchema = z.object({
	user_id: z.string().min(1),
	amount: z.string().min(1),
	source_id: z.string().min(1),
	description: z.string().min(1).optional(),
	expires_at: z.number().int().nullable().optional()
})
export type AdminGrantCreditsRequest = z.infer<typeof AdminGrantCreditsRequestSchema>

export type AdminGrantCreditsResponse = {
	balance: string
}
