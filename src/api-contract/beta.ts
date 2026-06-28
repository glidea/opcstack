import { z } from 'zod'
import { PageRequestSchema, type PageResponse } from './common'

export const BindBetaCodeRequestSchema = z.object({
	beta_code: z.string().min(1)
})
export type BindBetaCodeRequest = z.infer<typeof BindBetaCodeRequestSchema>

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

export type GenerateBetaCodesResponseCode = {
	id: string
	code: string
}

export type GenerateBetaCodesResponse = {
	codes: GenerateBetaCodesResponseCode[]
}

export type ListBetaCodesResponseCode = {
	id: string
	code: string
	used_by: string | null
	used_at: number | null
	created_at: number
}

export type ListBetaCodesResponse = PageResponse<ListBetaCodesResponseCode>
