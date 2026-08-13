import type { ListAdminUsersRequest } from '$apiContract/admin-users'
import type { AdminGrantCreditsRequest } from '$apiContract/credits'

export type UserContextLinks = {
	creditTransactions: string
	feedbacks: string
	payments: string
	affiliateReferrals: string
	aiTasks: string
	notification: string
}

export type GrantAttempt = {
	sourceId: string
}

export type GrantExpiryOption = 'never' | 'week' | 'month' | 'custom'

export type GrantCreditsInput = {
	userId: string
	amount: string
	description: string
	expiresAt: number | null
}

export type GrantConfirmation = {
	userId: string
	amount: string
	description: string
	expiresAt: number | null
}

export function parseUserListQuery(url: URL): ListAdminUsersRequest {
	const search: string = url.searchParams.get('search')?.trim() ?? ''
	const rawPage: number = Number(url.searchParams.get('page') ?? '1')
	return {
		...(search === '' ? {} : { search }),
		page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
		page_size: 20
	}
}

export function createUserContextLinks(locale: string, userId: string): UserContextLinks {
	const userParams: URLSearchParams = new URLSearchParams({ user_id: userId })
	const notificationParams: URLSearchParams = new URLSearchParams({
		target_user_id: userId,
		compose: '1'
	})
	return {
		creditTransactions: `/${locale}/admin/credit-transactions?${userParams.toString()}`,
		feedbacks: `/${locale}/admin/feedback?${userParams.toString()}`,
		payments: `/${locale}/admin/payments?${userParams.toString()}`,
		affiliateReferrals: `/${locale}/admin/affiliate-referrals?${userParams.toString()}`,
		aiTasks: `/${locale}/admin/ai-tasks?${userParams.toString()}`,
		notification: `/${locale}/admin/notifications?${notificationParams.toString()}`
	}
}

export function validateCreditAmount(value: string): boolean {
	return /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value) && Number(value) > 0
}

export function resolveGrantExpiry(
	option: GrantExpiryOption,
	now: number = Date.now(),
	customExpiresAt: number | null = null
): number | null {
	switch (option) {
		case 'never':
			return null
		case 'week':
			return now + 7 * 24 * 60 * 60 * 1000
		case 'month':
			return now + 30 * 24 * 60 * 60 * 1000
		case 'custom':
			return customExpiresAt
	}
}

export function createGrantAttempt(
	createId: () => string = (): string => crypto.randomUUID()
): GrantAttempt {
	return { sourceId: createId() }
}

export function buildGrantCreditsRequest(
	attempt: GrantAttempt,
	input: GrantCreditsInput
): AdminGrantCreditsRequest {
	return {
		user_id: input.userId,
		amount: input.amount,
		source_id: attempt.sourceId,
		...(input.description === '' ? {} : { description: input.description }),
		expires_at: input.expiresAt
	}
}

export function createGrantConfirmation(input: GrantCreditsInput): GrantConfirmation {
	return {
		userId: input.userId,
		amount: input.amount,
		description: input.description,
		expiresAt: input.expiresAt
	}
}
