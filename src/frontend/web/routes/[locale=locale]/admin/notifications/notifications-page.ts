import type {
	CreateNotificationRequest,
	ListAdminNotificationsRequest
} from '$apiContract/notifications'

export type NotificationScope = 'global' | 'user'

export type NotificationComposerState = {
	open: boolean
	scope: NotificationScope
	targetUserId: string
}

export type NotificationContent = {
	title: string
	content: string
}

export function parseNotificationListQuery(url: URL): ListAdminNotificationsRequest {
	const id: string = url.searchParams.get('id')?.trim() ?? ''
	const targetUserId: string = url.searchParams.get('target_user_id')?.trim() ?? ''
	const type: string = url.searchParams.get('type')?.trim() ?? ''
	const scopeValue: string | null = url.searchParams.get('scope')
	const scope: ListAdminNotificationsRequest['scope'] =
		scopeValue === 'global' || scopeValue === 'user' ? scopeValue : undefined
	const rawPage: number = Number(url.searchParams.get('page') ?? '1')
	return {
		...(id === '' ? {} : { id }),
		...(targetUserId === '' ? {} : { target_user_id: targetUserId }),
		...(type === '' ? {} : { type }),
		...(scope === undefined ? {} : { scope }),
		...readTimestamp(url.searchParams, 'created_at_start'),
		...readTimestamp(url.searchParams, 'created_at_end'),
		page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
		page_size: 20
	}
}

export function createNotificationSearchParams(
	input: ListAdminNotificationsRequest
): URLSearchParams {
	const params: URLSearchParams = new URLSearchParams()
	const entries: [string, string | number | undefined][] = [
		['id', input.id],
		['target_user_id', input.target_user_id],
		['type', input.type],
		['scope', input.scope],
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

export function parseNotificationComposer(url: URL): NotificationComposerState {
	const targetUserId: string = url.searchParams.get('target_user_id')?.trim() ?? ''
	return {
		open: url.searchParams.get('compose') === '1',
		scope: targetUserId === '' ? 'global' : 'user',
		targetUserId
	}
}

export function buildNotificationRequest(
	scope: NotificationScope,
	targetUserId: string,
	content: NotificationContent
): CreateNotificationRequest {
	return {
		type: 'system',
		...content,
		target_user_id: scope === 'global' ? null : targetUserId.trim()
	}
}

export function validateNotificationDraft(
	scope: NotificationScope,
	targetUserId: string,
	title: string,
	content: string
): boolean {
	if (title.trim() === '' || content.trim() === '') {
		return false
	}
	return scope === 'global' || targetUserId.trim() !== ''
}

function readTimestamp(params: URLSearchParams, name: string): Record<string, number> {
	const value: string | null = params.get(name)
	if (value === null || value === '') {
		return {}
	}
	const parsed: number = Number(value)
	return Number.isInteger(parsed) ? { [name]: parsed } : {}
}
