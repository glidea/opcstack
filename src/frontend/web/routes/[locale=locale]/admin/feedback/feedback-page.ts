import type { ListFeedbacksRequest } from '$apiContract/feedback'

export function parseFeedbackListQuery(url: URL): ListFeedbacksRequest {
	const userId: string = url.searchParams.get('user_id')?.trim() ?? ''
	const type: string = url.searchParams.get('type')?.trim() ?? ''
	const rawPage: number = Number(url.searchParams.get('page') ?? '1')
	return {
		...(userId === '' ? {} : { user_id: userId }),
		...(type === '' ? {} : { type }),
		...readTimestamp(url.searchParams, 'created_at_start'),
		...readTimestamp(url.searchParams, 'created_at_end'),
		page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
		page_size: 20
	}
}

export function createFeedbackSearchParams(input: ListFeedbacksRequest): URLSearchParams {
	const params: URLSearchParams = new URLSearchParams()
	const entries: [string, string | number | undefined][] = [
		['user_id', input.user_id],
		['type', input.type],
		['created_at_start', input.created_at_start],
		['created_at_end', input.created_at_end]
	]
	for (const [name, value] of entries) {
		if (value !== undefined && value !== '') {
			params.set(name, String(value))
		}
	}
	if ((input.page ?? 1) > 1) {
		params.set('page', String(input.page))
	}
	return params
}

export function summarizeFeedback(content: string): string {
	return content.length <= 120 ? content : `${content.slice(0, 117)}...`
}

export function createFeedbackUserHref(locale: string, userId: string): string {
	return `/${locale}/admin/users?search=${encodeURIComponent(userId)}`
}

function readTimestamp(params: URLSearchParams, name: string): Record<string, number> {
	const value: string | null = params.get(name)
	if (value === null || value === '') {
		return {}
	}
	const parsed: number = Number(value)
	return Number.isInteger(parsed) ? { [name]: parsed } : {}
}
