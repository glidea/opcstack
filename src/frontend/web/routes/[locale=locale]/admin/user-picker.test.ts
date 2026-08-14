import { describe, expect, test } from 'vitest'
import type { ListUsersResponseItem } from '$apiContract/users'
import { findAdminUserById, formatAdminUserIdentity } from './user-picker'

const user: ListUsersResponseItem = {
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

	test('does not repeat the email when the account name matches it', (): void => {
		expect({ identity: formatAdminUserIdentity({ ...user, name: user.email }) }).toEqual({
			identity: 'ada@example.com'
		})
	})

	test('finds the exact user when restoring a user ID from the URL', (): void => {
		expect({ user: findAdminUserById([user], 'user-1') }).toEqual({ user })
	})
})
