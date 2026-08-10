import { describe, expect, test } from 'vitest'
import {
	buildNotificationRequest,
	createNotificationSearchParams,
	parseNotificationComposer,
	parseNotificationListQuery,
	validateNotificationDraft
} from './notifications-page'

describe('admin notifications page', (): void => {
	test('parses history filters from the URL', (): void => {
		const url = new URL(
			'https://example.com/en/admin/notifications?id=n1&target_user_id=u1&type=system&scope=user&created_at_start=100&created_at_end=200&page=2'
		)

		expect({ query: parseNotificationListQuery(url) }).toEqual({
			query: {
				id: 'n1',
				target_user_id: 'u1',
				type: 'system',
				scope: 'user',
				created_at_start: 100,
				created_at_end: 200,
				page: 2,
				page_size: 20
			}
		})
	})

	test('serializes only active history filters', (): void => {
		const params = createNotificationSearchParams({
			scope: 'global',
			page: 1,
			page_size: 20
		})

		expect({ search: params.toString() }).toEqual({ search: 'scope=global' })
	})

	test('prefills a targeted composer from the user directory URL', (): void => {
		const url = new URL(
			'https://example.com/en/admin/notifications?target_user_id=user-1&compose=1'
		)

		expect({ composer: parseNotificationComposer(url) }).toEqual({
			composer: { open: true, scope: 'user', targetUserId: 'user-1' }
		})
	})

	test('builds explicit global and targeted requests', (): void => {
		const content = { title: 'Notice', content: 'Body' }
		expect({ request: buildNotificationRequest('global', '', content) }).toEqual({
			request: { type: 'system', ...content, target_user_id: null }
		})
		expect({ request: buildNotificationRequest('user', 'user-1', content) }).toEqual({
			request: { type: 'system', ...content, target_user_id: 'user-1' }
		})
	})

	test('requires content and a target for user notifications', (): void => {
		expect({ global: validateNotificationDraft('global', '', 'Title', 'Body') }).toEqual({
			global: true
		})
		expect({ missingTarget: validateNotificationDraft('user', '', 'Title', 'Body') }).toEqual({
			missingTarget: false
		})
	})
})
