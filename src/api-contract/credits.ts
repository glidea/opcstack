import { z } from 'zod'
import { PageRequestSchema, type ApiErrorResult } from './common'

export const GetCreditSummaryRequestSchema = z.object({})
export type GetCreditSummaryRequest = z.infer<typeof GetCreditSummaryRequestSchema>

export const GetCreditSummaryResponseSchema = z.object({
	balance: z.string(),
	daily_checked_in: z.boolean(),
	daily_checkin_amount: z.string()
})
export type GetCreditSummaryResponse = z.infer<typeof GetCreditSummaryResponseSchema>

export const ListCreditTransactionsRequestSchema = PageRequestSchema.extend({
	type: z.string().min(1).optional(),
	source_type: z.string().min(1).optional(),
	source_id: z.string().min(1).optional(),
	created_at_start: z.number().int().optional(),
	created_at_end: z.number().int().optional()
})
export type ListCreditTransactionsRequest = z.infer<typeof ListCreditTransactionsRequestSchema>

export const CreditTransactionResponseItemSchema = z.object({
	id: z.string(),
	type: z.string(),
	amount: z.string(),
	balance_after: z.string(),
	source_type: z.string(),
	source_id: z.string(),
	description: z.string().nullable(),
	expires_at: z.number().nullable(),
	created_at: z.number()
})
export type CreditTransactionResponseItem = z.infer<typeof CreditTransactionResponseItemSchema>

export const ListCreditTransactionsResponseSchema = z.object({
	items: z.array(CreditTransactionResponseItemSchema),
	total: z.number()
})
export type ListCreditTransactionsResponse = z.infer<typeof ListCreditTransactionsResponseSchema>

export const DailyCheckinRequestSchema = z.object({})
export type DailyCheckinRequest = z.infer<typeof DailyCheckinRequestSchema>

export const DailyCheckinResponseSchema = z.object({
	balance: z.string(),
	checked_in: z.boolean(),
	amount: z.string()
})
export type DailyCheckinResponse = z.infer<typeof DailyCheckinResponseSchema>

export const GenerateCreditCodesRequestSchema = z.object({
	count: z.number().int().min(1).max(200).optional().default(1),
	amount: z.string().min(1),
	expires_at: z.number().int().nullable().optional()
})
export type GenerateCreditCodesRequest = z.infer<typeof GenerateCreditCodesRequestSchema>

export const CreditCodeResponseItemSchema = z.object({
	id: z.string(),
	code: z.string(),
	amount: z.string(),
	expires_at: z.number().nullable(),
	created_at: z.number()
})
export type CreditCodeResponseItem = z.infer<typeof CreditCodeResponseItemSchema>

export const GenerateCreditCodesResponseSchema = z.object({
	codes: z.array(CreditCodeResponseItemSchema)
})
export type GenerateCreditCodesResponse = z.infer<typeof GenerateCreditCodesResponseSchema>

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

export const CreditCodeListResponseItemSchema = CreditCodeResponseItemSchema.extend({
	status: z.string(),
	claimed_by: z.string().nullable(),
	claimed_at: z.number().nullable(),
	granted_at: z.number().nullable()
})
export type CreditCodeListResponseItem = z.infer<typeof CreditCodeListResponseItemSchema>

export const ListCreditCodesResponseSchema = z.object({
	items: z.array(CreditCodeListResponseItemSchema),
	total: z.number()
})
export type ListCreditCodesResponse = z.infer<typeof ListCreditCodesResponseSchema>

export const RedeemCreditCodeRequestSchema = z.object({
	code: z.string().min(1)
})
export type RedeemCreditCodeRequest = z.infer<typeof RedeemCreditCodeRequestSchema>

export const RedeemCreditCodeResponseSchema = z.object({
	balance: z.string(),
	amount: z.string()
})
export type RedeemCreditCodeResponse = z.infer<typeof RedeemCreditCodeResponseSchema>

export const AdminGrantCreditsRequestSchema = z.object({
	user_id: z.string().min(1),
	amount: z.string().min(1),
	source_id: z.string().min(1),
	description: z.string().min(1).optional(),
	expires_at: z.number().int().nullable().optional()
})
export type AdminGrantCreditsRequest = z.infer<typeof AdminGrantCreditsRequestSchema>

export const AdminGrantCreditsResponseSchema = z.object({
	balance: z.string()
})
export type AdminGrantCreditsResponse = z.infer<typeof AdminGrantCreditsResponseSchema>

export const GetCreditSummaryApi = {
	request: GetCreditSummaryRequestSchema,
	response: GetCreditSummaryResponseSchema,
	errors: {
		CREDIT_USER_NOT_FOUND(): ApiErrorResult<'CREDIT_USER_NOT_FOUND', 404> {
			return {
				status: 404,
				body: {
					code: 'CREDIT_USER_NOT_FOUND',
					message: 'Credit user not found'
				}
			}
		}
	}
}

export const ListCreditTransactionsApi = {
	request: ListCreditTransactionsRequestSchema,
	response: ListCreditTransactionsResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
			return {
				status: 400,
				body: {
					code: 'INVALID_REQUEST',
					message
				}
			}
		}
	}
}

export const DailyCheckinApi = {
	request: DailyCheckinRequestSchema,
	response: DailyCheckinResponseSchema,
	errors: {
		INVALID_DAILY_CHECKIN_AMOUNT(): ApiErrorResult<'INVALID_DAILY_CHECKIN_AMOUNT', 400> {
			return {
				status: 400,
				body: {
					code: 'INVALID_DAILY_CHECKIN_AMOUNT',
					message: 'Daily check-in amount is invalid'
				}
			}
		},
		DAILY_CHECKIN_ALREADY_DONE(): ApiErrorResult<'DAILY_CHECKIN_ALREADY_DONE', 409> {
			return {
				status: 409,
				body: {
					code: 'DAILY_CHECKIN_ALREADY_DONE',
					message: 'Daily check-in has already been completed'
				}
			}
		}
	}
}

export const GenerateCreditCodesApi = {
	request: GenerateCreditCodesRequestSchema,
	response: GenerateCreditCodesResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
			return {
				status: 400,
				body: {
					code: 'INVALID_REQUEST',
					message
				}
			}
		}
	}
}

export const ListCreditCodesApi = {
	request: ListCreditCodesRequestSchema,
	response: ListCreditCodesResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
			return {
				status: 400,
				body: {
					code: 'INVALID_REQUEST',
					message
				}
			}
		}
	}
}

export const RedeemCreditCodeApi = {
	request: RedeemCreditCodeRequestSchema,
	response: RedeemCreditCodeResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
			return {
				status: 400,
				body: {
					code: 'INVALID_REQUEST',
					message
				}
			}
		},
		INVALID_CREDIT_CODE(): ApiErrorResult<'INVALID_CREDIT_CODE', 400> {
			return {
				status: 400,
				body: {
					code: 'INVALID_CREDIT_CODE',
					message: 'Credit code is invalid'
				}
			}
		},
		CREDIT_CODE_USED(): ApiErrorResult<'CREDIT_CODE_USED', 409> {
			return {
				status: 409,
				body: {
					code: 'CREDIT_CODE_USED',
					message: 'Credit code has already been used'
				}
			}
		},
		CREDIT_GRANT_PENDING(): ApiErrorResult<'CREDIT_GRANT_PENDING', 202> {
			return {
				status: 202,
				body: {
					code: 'CREDIT_GRANT_PENDING',
					message: 'Credit grant is pending'
				}
			}
		}
	}
}

export const AdminGrantCreditsApi = {
	request: AdminGrantCreditsRequestSchema,
	response: AdminGrantCreditsResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
			return {
				status: 400,
				body: {
					code: 'INVALID_REQUEST',
					message
				}
			}
		},
		CREDIT_GRANT_DUPLICATED(): ApiErrorResult<'CREDIT_GRANT_DUPLICATED', 409> {
			return {
				status: 409,
				body: {
					code: 'CREDIT_GRANT_DUPLICATED',
					message: 'Credit grant is duplicated'
				}
			}
		},
		CREDIT_USER_NOT_FOUND(): ApiErrorResult<'CREDIT_USER_NOT_FOUND', 404> {
			return {
				status: 404,
				body: {
					code: 'CREDIT_USER_NOT_FOUND',
					message: 'Credit user not found'
				}
			}
		},
		INVALID_CREDIT_AMOUNT(): ApiErrorResult<'INVALID_CREDIT_AMOUNT', 400> {
			return {
				status: 400,
				body: {
					code: 'INVALID_CREDIT_AMOUNT',
					message: 'Credit amount is invalid'
				}
			}
		}
	}
}
