import { describe, expect, test } from 'vitest'
import { createAdminPageSearch, readAdminDetailKey } from './admin-detail-state'

describe('admin detail state', (): void => {
	test('reads the selected detail key from the current URL', (): void => {
		expect(
			readAdminDetailKey(new URL('https://example.com/en/admin/users?page=2&detail=user-1'))
		).toBe('user-1')
	})

	test('adds the selected detail without dropping list state', (): void => {
		expect(createAdminPageSearch(new URLSearchParams('status=failed&page=2'), 'task-1')).toBe(
			'status=failed&page=2&detail=task-1'
		)
	})

	test('removes a closed detail without dropping list state', (): void => {
		expect(
			createAdminPageSearch(new URLSearchParams('status=failed&page=2&detail=task-1'), '')
		).toBe('status=failed&page=2')
	})
})
