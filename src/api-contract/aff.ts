import { z } from 'zod'

export type GetAffSummaryResponse = {
	aff_enabled: boolean
	aff_code: string
	invited_count: number
}

export const BindAffRequestSchema = z.object({
	aff_code: z.string().min(1)
})
export type BindAffRequest = z.infer<typeof BindAffRequestSchema>
