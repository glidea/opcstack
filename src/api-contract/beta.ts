import { z } from 'zod'
import { PageRequestSchema, type ApiErrorResult } from './common'

export const BindBetaCodeRequestSchema = z.object({
	beta_code: z.string().min(1)
})
export type BindBetaCodeRequest = z.infer<typeof BindBetaCodeRequestSchema>
export const BindBetaCodeResponseSchema = z.object({})
export type BindBetaCodeResponse = z.infer<typeof BindBetaCodeResponseSchema>

export const GenerateBetaCodesRequestSchema = z.object({
	count: z.number().int().min(1).optional().default(1)
})
export type GenerateBetaCodesRequest = z.infer<typeof GenerateBetaCodesRequestSchema>

export const ListBetaCodesRequestSchema = PageRequestSchema.extend({
	code: z.string().min(1).optional(),
	used_by: z.string().min(1).optional(),
	used: z.boolean().optional(),
	created_at_start: z.number().int().optional(),
	created_at_end: z.number().int().optional()
})
export type ListBetaCodesRequest = z.infer<typeof ListBetaCodesRequestSchema>

export const GenerateBetaCodesResponseCodeSchema = z.object({
	id: z.string(),
	code: z.string()
})
export type GenerateBetaCodesResponseCode = z.infer<typeof GenerateBetaCodesResponseCodeSchema>

export const GenerateBetaCodesResponseSchema = z.object({
	codes: z.array(GenerateBetaCodesResponseCodeSchema)
})
export type GenerateBetaCodesResponse = z.infer<typeof GenerateBetaCodesResponseSchema>

export const ListBetaCodesResponseCodeSchema = z.object({
	id: z.string(),
	code: z.string(),
	used_by: z.string().nullable(),
	used_at: z.number().nullable(),
	created_at: z.number()
})
export type ListBetaCodesResponseCode = z.infer<typeof ListBetaCodesResponseCodeSchema>

export const ListBetaCodesResponseSchema = z.object({
	items: z.array(ListBetaCodesResponseCodeSchema),
	total: z.number()
})
export type ListBetaCodesResponse = z.infer<typeof ListBetaCodesResponseSchema>

export const BindBetaCodeApi = {
	request: BindBetaCodeRequestSchema,
	response: BindBetaCodeResponseSchema,
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
		INVALID_BETA_CODE(): ApiErrorResult<'INVALID_BETA_CODE', 400> {
			return {
				status: 400,
				body: {
					code: 'INVALID_BETA_CODE',
					message: 'Beta code is invalid'
				}
			}
		},
		BETA_CODE_ALREADY_BOUND(): ApiErrorResult<'BETA_CODE_ALREADY_BOUND', 409> {
			return {
				status: 409,
				body: {
					code: 'BETA_CODE_ALREADY_BOUND',
					message: 'Beta code is already bound'
				}
			}
		}
	}
}

export const GenerateBetaCodesApi = {
	request: GenerateBetaCodesRequestSchema,
	response: GenerateBetaCodesResponseSchema,
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

export const ListBetaCodesApi = {
	request: ListBetaCodesRequestSchema,
	response: ListBetaCodesResponseSchema,
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
