import { z, type ZodType } from 'zod'

export const PageRequestSchema = z.object({
	page: z.number().int().min(1).optional().default(1),
	page_size: z.number().int().min(1).max(100).optional().default(20)
})
export type PageRequest = z.infer<typeof PageRequestSchema>

export type RequestParseIssue = {
	path: string
	message: string
}

export type RequestParseError =
	| {
		type: 'json'
		message: string
	}
	| {
		type: 'schema'
		issues: RequestParseIssue[]
	}

export type RequestParseResult<Request> =
	| {
		success: true
		data: Request
	}
	| {
		success: false
		error: RequestParseError
	}

export type JsonRequestContext = {
	req: {
		json: () => Promise<unknown>
	}
}

export async function parseRequest<Request>(
	ctx: JsonRequestContext,
	schema: ZodType<Request>
): Promise<Request | null> {
	const result = await parseRequestResult(ctx, schema)
	if (!result.success) {
		return null
	}
	return result.data
}

export async function parseRequestResult<Request>(
	ctx: JsonRequestContext,
	schema: ZodType<Request>
): Promise<RequestParseResult<Request>> {
	try {
		const raw = await ctx.req.json()
		const result = schema.safeParse(raw)
		if (!result.success) {
			return {
				success: false,
				error: {
					type: 'schema',
					issues: result.error.issues.map((issue): RequestParseIssue => {
						return {
							path: issue.path.join('.'),
							message: issue.message
						}
					})
				}
			}
		}
		return {
			success: true,
			data: result.data
		}
	} catch (error) {
		return {
			success: false,
			error: {
				type: 'json',
				message: error instanceof Error ? error.message : 'INVALID_JSON'
			}
		}
	}
}
