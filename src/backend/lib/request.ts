import type { ZodIssue, ZodType } from 'zod'

export type RequestParseResult<Request> =
	| {
		success: true
		data: Request
	}
	| {
		success: false
		message: string
	}

export type JsonRequestContext = {
	req: {
		json: () => Promise<unknown>
	}
}

export async function parseRequest<Request>(
	ctx: JsonRequestContext,
	schema: ZodType<Request>
): Promise<RequestParseResult<Request>> {
	try {
		const raw = await ctx.req.json()
		const result = schema.safeParse(raw)
		if (!result.success) {
			return {
				success: false,
				message: result.error.issues.map(formatZodIssue).join('; ')
			}
		}
		return {
			success: true,
			data: result.data
		}
	} catch {
		return {
			success: false,
			message: 'Invalid JSON'
		}
	}
}

function formatZodIssue(issue: ZodIssue): string {
	const path: string = issue.path.join('.')
	if (path === '') {
		return issue.message
	}
	return `${path}: ${issue.message}`
}
