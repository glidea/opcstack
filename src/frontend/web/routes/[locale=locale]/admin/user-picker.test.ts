import { describe, expect, test } from 'vitest'
import type { ListAdminUsersResponseItem } from '$apiContract/users'
import { findAdminUserById, formatAdminUserIdentity } from './user-picker'

const user: ListAdminUsersResponseItem = {
	id: 'user-1',
	name: 'Ada Lovelace',
	email: 'ada@example.com',
	registration_utm_source: null,
	created_at: 1,
	updated_at: 1,
	credit_balance: '0.000000',
	inviter: null
}

describe('admin user picker', (): void => {
	test('formats the visible identity without exposing the user ID', (): void => {
		expect({ identity: formatAdminUserIdentity(user) }).toEqual({
			identity: 'Ada Lovelace · ada@example.com'
		})
	})

	test('finds the exact user when restoring a user ID from the URL', (): void => {
		expect({ user: findAdminUserById([user], 'user-1') }).toEqual({ user })
	})
})
