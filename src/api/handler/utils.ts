import type { Context } from 'hono'
import { z, type ZodType } from 'zod'
import type { ApiEnv } from '..'

export const PageRequestSchema = z.object({
	page: z.number().int().min(1).optional().default(1),
	page_size: z.number().int().min(1).max(100).optional().default(20)
})
export type PageRequest = z.infer<typeof PageRequestSchema>

export async function parse<Request>(
	ctx: Context<ApiEnv>,
	schema: ZodType<Request>
): Promise<Request | null> {
	try {
		const raw = await ctx.req.json<unknown>()
		const result = schema.safeParse(raw)
		if (!result.success) {
			return null
		}
		return result.data
	} catch {
		return null
	}
}
