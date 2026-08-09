import { describe, expect, test } from 'vitest'
import type { ListAdminUsersResponseItem } from '$apiContract/admin-users'
import { findAdminUserById, formatAdminUserIdentity } from './admin-user-picker'

const user: ListAdminUsersResponseItem = {
	id: 'user-1',
	name: 'Ada Lovelace',
	email: 'ada@example.com',
	email_verified: true,
	image: null,
	aff_code: null,
	registration_utm_source: null,
	created_at: 1,
	updated_at: 1,
	beta_access: null,
	shard: null
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
