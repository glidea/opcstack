import { describe, expect, test } from 'vitest'
import {
	buildGrantCreditsRequest,
	createGrantAttempt,
	createGrantConfirmation,
	createUserContextLinks,
	parseUserListQuery,
	resolveGrantExpiry,
	validateCreditAmount
} from './users-page'

describe('admin user list state', () => {
	test('parses search and pagination from the URL', (): void => {
		expect(
			parseUserListQuery(new URL('https://example.com/en/admin/users?search=user%40example.com&page=3'))
		).toEqual({
			search: 'user@example.com',
			page: 3,
			page_size: 20
		})
	})

	test('builds links that preserve user context', (): void => {
		expect(createUserContextLinks('zh', 'user 1')).toEqual({
		feedbacks: '/zh/admin/feedback?user_id=user+1',
		payments: '/zh/admin/payments?user_id=user+1',
		aiTasks: '/zh/admin/ai-tasks?user_id=user+1',
		notification: '/zh/admin/notifications?target_user_id=user+1&compose=1'
	})
	})
})

describe('admin credit grant state', () => {
	test('resolves the three supported expiry choices from one reference time', (): void => {
		const now: number = Date.UTC(2026, 7, 13)

		expect({
			never: resolveGrantExpiry('never', now),
			week: resolveGrantExpiry('week', now),
			month: resolveGrantExpiry('month', now)
		}).toEqual({
			never: null,
			week: now + 7 * 24 * 60 * 60 * 1000,
			month: now + 30 * 24 * 60 * 60 * 1000
		})
	})

	test('accepts positive credit amounts with up to six decimals', (): void => {
		expect([
			validateCreditAmount('10'),
			validateCreditAmount('0.500000'),
			validateCreditAmount('0'),
			validateCreditAmount('-1'),
			validateCreditAmount('1.0000001')
		]).toEqual([true, true, false, false, false])
	})

	test('reuses one internal source id when a request is retried', (): void => {
		const attempt = createGrantAttempt((): string => 'internal-grant-1')
		const input = {
			userId: 'user-1',
			amount: '10',
			description: 'Support adjustment',
			expiresAt: null
		}

		expect({
			first: buildGrantCreditsRequest(attempt, input),
			retry: buildGrantCreditsRequest(attempt, input),
			confirmation: createGrantConfirmation(input)
		}).toEqual({
			first: {
				user_id: 'user-1',
				amount: '10',
				source_id: 'internal-grant-1',
				description: 'Support adjustment',
				expires_at: null
			},
			retry: {
				user_id: 'user-1',
				amount: '10',
				source_id: 'internal-grant-1',
				description: 'Support adjustment',
				expires_at: null
			},
			confirmation: {
				userId: 'user-1',
				amount: '10',
				description: 'Support adjustment',
				expiresAt: null
			}
		})
	})
})
