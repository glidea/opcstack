import { z } from 'zod'

export const PageRequestSchema = z.object({
	page: z.number().int().min(1).optional().default(1),
	page_size: z.number().int().min(1).max(100).optional().default(20)
})
export type PageRequest = z.infer<typeof PageRequestSchema>

export type PageResponse<T> = {
	items: T[]
	total: number
}

export type ApiErrorResponse = {
	code: string
	message: string
}
