import type { Context } from 'hono'
import type { ZodType } from 'zod'
import type { ApiEnv } from '..'

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
