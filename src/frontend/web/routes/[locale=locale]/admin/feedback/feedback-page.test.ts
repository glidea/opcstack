import { describe, expect, test } from 'vitest'
import {
	createFeedbackSearchParams,
	createFeedbackUserHref,
	parseFeedbackListQuery,
	summarizeFeedback
} from './feedback-page'

describe('admin feedback page', (): void => {
	test('parses filters and pagination from the URL', (): void => {
		const url = new URL(
			'https://example.com/en/admin/feedback?user_id=user-1&type=bug&created_at_start=100&created_at_end=200&page=2'
		)

		expect({ query: parseFeedbackListQuery(url) }).toEqual({
			query: {
				user_id: 'user-1',
				type: 'bug',
				created_at_start: 100,
				created_at_end: 200,
				page: 2,
				page_size: 20
			}
		})
	})

	test('serializes only active filters', (): void => {
		const params = createFeedbackSearchParams({
			user_id: 'user-1',
			page: 1,
			page_size: 20
		})

		expect({ search: params.toString() }).toEqual({ search: 'user_id=user-1' })
	})

	test('creates a readable summary without changing short content', (): void => {
		expect({ short: summarizeFeedback('Short feedback') }).toEqual({ short: 'Short feedback' })
		expect({ long: summarizeFeedback('a'.repeat(130)) }).toEqual({
			long: `${'a'.repeat(117)}...`
		})
	})

	test('links a feedback user to the filtered user directory', (): void => {
		expect({ href: createFeedbackUserHref('zh', 'user 1') }).toEqual({
			href: '/zh/admin/users?search=user%201'
		})
	})
})
